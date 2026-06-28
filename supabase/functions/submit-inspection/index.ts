import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public (no-login) inspection submission (Workshop Part 5).
//  - Inserts the checklist_submissions row.
//  - Retread escalation: a retread on a Loadmaster (any wheel) or on a horse steering
//    (front) axle, or an AI "remove from service", is forced to a Critical fail.
//  - Computes failed counts by severity -> result (Grounded / Requires Attention / Roadworthy).
//  - GROUNDING GATE: a Grounded result sets the vehicle status to 'Off the road', which
//    removes it from every dispatch picker (all already filter status === 'On the road').
//  - Auto-creates a job card for each failed item (linked to the submission + checklist item).
//  - Notifies the depot workshop + ops by email, and WhatsApps a workshop manager if one
//    (a profile with access_workshop + a phone) exists.
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORG = "00000000-0000-0000-0000-000000000001";
const OPS = "ops@fbn-transport.co.za";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function rest(path: string, init?: RequestInit) { return fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) } }); }
async function getJson(path: string) { const r = await rest(path); return r.ok ? await r.json() : []; }
async function sendEmail(to: string, subject: string, html: string, cc?: string[]) { try { await fetch(`${URL}/functions/v1/send-email`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, cc, subject, html, fromName: "FBN Workshop" }) }); } catch (e) { console.error("email", e); } }
async function sendWhatsapp(to: string, body: string) { try { await fetch(`${URL}/functions/v1/send-whatsapp`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, body }) }); } catch (e) { console.error("wa", e); } }
const workshopEmail = (depot: string) => /JHB/i.test(depot) ? "workshopjhb@fbn-transport.co.za" : "workshopdbn@fbn-transport.co.za";
// checklist severity (Critical/Urgent/Minor) -> priority_level enum (Critical/High/Medium/Low)
const prio = (sev: string) => sev === "Critical" ? "Critical" : sev === "Urgent" ? "High" : "Medium";
const isTyre = (r: any) => /tyre|tread/i.test(String(r.label || "")) || /-tw-1/.test(String(r.itemId || ""));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const p = await req.json();
    const vehicleType = p.vehicleType || "";
    const results: any[] = Array.isArray(p.results) ? p.results : [];

    // Retread escalation -> force Critical fail on the offending tyre item.
    for (const r of results) {
      const ai = r.ai || null;
      const retread = ai?.retread_detected === true;
      const remove = /remove/i.test(String(ai?.overall_assessment || ""));
      const frontAxle = /front|steer/i.test(String(r.position || ""));
      if (isTyre(r) && (remove || (retread && (vehicleType === "Loadmaster" || frontAxle)))) {
        r.status = "Fail"; r.severity = "Critical";
        r.remarks = `${r.remarks ? r.remarks + " — " : ""}${remove ? "AI: remove from service" : "Retread on prohibited position"}`;
      }
    }

    const failed = results.filter(r => r.status === "Fail");
    const failedCritical = failed.filter(r => r.severity === "Critical").length;
    const failedUrgent = failed.filter(r => r.severity === "Urgent").length;
    const failedMinor = failed.filter(r => r.severity === "Minor").length;
    const result = failedCritical > 0 ? "Grounded" : failedUrgent > 0 ? "Requires Attention" : "Roadworthy";

    const depot = (p.depot || "").toUpperCase();
    const reference = `INS-${depot || "X"}-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.round(Math.random() * 9000 + 1000)}`;
    const driver = p.driver || {};

    const row = {
      organization_id: ORG, template_id: p.templateId || null, template_name: p.templateName || null,
      vehicle_id: p.vehicleId, user_name: driver.name || null, date: new Date().toISOString().slice(0, 10),
      odometer: p.odometer ?? null, hours: p.hours ?? null, results, status: "Submitted",
      reference, depot: p.depot || null, result, driver_id_number: driver.idNumber || null,
      licence_code: driver.licenceCode || null, pdp_expiry: driver.pdpExpiry || null, substituting: !!driver.substituting,
      trailer_ids: Array.isArray(p.trailerIds) ? p.trailerIds : [],
      failed_critical: failedCritical, failed_urgent: failedUrgent, failed_minor: failedMinor, submitted_at: new Date().toISOString(),
    };
    const ir = await rest("checklist_submissions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!ir.ok) { const t = await ir.text(); return json({ error: `Could not save inspection: ${t.slice(0, 200)}` }, 500); }
    const saved = (await ir.json())?.[0];

    // GROUNDING GATE — Grounded -> Off the road (drops it from all dispatch pickers).
    if (p.vehicleId) {
      const patch: Record<string, unknown> = { inspection_status: result, last_inspection_at: new Date().toISOString() };
      if (result === "Grounded") patch.status = "Off the road";
      await rest(`vehicles?id=eq.${p.vehicleId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    }

    // Auto-create a job card per failed item.
    let jobCards = 0;
    if (failed.length && p.vehicleId) {
      const cards = failed.map(r => ({
        organization_id: ORG, vehicle_id: p.vehicleId, submission_id: saved?.id || null,
        checklist_item_id: r.itemId || null,
        item_description: `${r.label || "Defect"}${r.position ? ` (${r.position})` : ""}${r.trailerName ? ` [${r.trailerName}]` : ""}`,
        reporter_notes: r.remarks || null, reporter_attachment_url: r.photoPath || null,
        type: isTyre(r) ? "Tyre Change" : "Repair", status: "Reported",
        priority: prio(r.severity), severity: prio(r.severity), reported_date: new Date().toISOString(),
      }));
      const jr = await rest("job_cards", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(cards) });
      if (jr.ok) jobCards = cards.length; else console.error("job_cards", (await jr.text()).slice(0, 200));
    }

    const failedItems = failed.map(r => ({ label: r.label, severity: r.severity, remarks: r.remarks || "", position: r.position || null }));

    // Notify the workshop on any failure.
    if (failed.length) {
      const reg = esc(p.vehicleReg || p.vehicleId);
      const list = failed.map(r => `<li><strong>${esc(r.severity)}</strong> — ${esc(r.label)}${r.position ? ` (${esc(r.position)})` : ""}${r.remarks ? `: ${esc(r.remarks)}` : ""}</li>`).join("");
      const banner = result === "Grounded" ? `<p style="background:#fee2e2;color:#991b1b;padding:8px;border-radius:6px;font-weight:bold">⛔ VEHICLE GROUNDED — set Off the road, removed from dispatch.</p>` : `<p style="background:#fef3c7;color:#92400e;padding:8px;border-radius:6px;font-weight:bold">⚠️ Requires attention — still on the road.</p>`;
      const html = `<div style="font-family:Arial,sans-serif"><h3 style="color:#13294b">Inspection result — ${reg}</h3><p>Driver: ${esc(driver.name)}${depot ? ` · ${esc(depot)}` : ""} · Ref ${esc(reference)}</p>${banner}<p><strong>${failedCritical} critical · ${failedUrgent} urgent · ${failedMinor} minor</strong> — ${jobCards} job card(s) created.</p><ul>${list}</ul></div>`;
      await sendEmail(workshopEmail(depot), `${result === "Grounded" ? "GROUNDED" : "DEFECTS"} — ${esc(p.vehicleReg || "vehicle")} inspection`, html, [OPS]);
      // WhatsApp a workshop manager if one is configured (profile with access_workshop + phone).
      try {
        const mgrs = await getJson(`profiles?select=phone&is_active=eq.true&permissions=cs.{access_workshop}&phone=not.is.null&limit=1`);
        const phone = mgrs?.[0]?.phone;
        if (phone) await sendWhatsapp(phone, `FBN Workshop: ${p.vehicleReg || "vehicle"} ${result === "Grounded" ? "GROUNDED" : "has defects"} (${failedCritical}C/${failedUrgent}U). ${jobCards} job card(s). Ref ${reference}.`);
      } catch (e) { console.error("mgr-wa", e); }
    }

    return json({ ok: true, id: saved?.id, reference, result, failedCritical, failedUrgent, failedMinor, jobCards, failedItems });
  } catch (e) { console.error("[submit-inspection]", e); return json({ error: String((e as Error)?.message || e) }, 500); }
});
