import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public (no-login) inspection submission (Workshop Parts 5/7).
//  - Inserts the checklist_submissions row.
//  - Retread escalation: a retread on a Loadmaster (any wheel) or a horse steering axle,
//    or an AI "remove from service", is forced to a Critical fail.
//  - result: Grounded (any Critical) / Requires Attention (any Urgent) / Roadworthy.
//  - GROUNDING GATE: a Grounded result sets the vehicle to 'Off the road' (drops it from
//    every dispatch picker, all of which filter status === 'On the road').
//  - Creates ONE job card per inspection holding all defects as line items (resolve each
//    in the job card; it closes when all are done).
//  - Notifies the depot workshop + ops; plain-English driver instruction is returned.
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
const prio = (sev: string) => sev === "Critical" ? "Critical" : sev === "Urgent" ? "High" : "Medium";
const isTyre = (r: any) => /tyre|tread/i.test(String(r.label || "")) || /-tw-1/.test(String(r.itemId || ""));
// Driver-facing plain English for each outcome.
const OUTCOME: Record<string, { label: string; instruction: string }> = {
  Roadworthy: { label: "Roadworthy — cleared to drive", instruction: "All good. You're cleared to drive." },
  "Requires Attention": { label: "Defects found — workshop notified", instruction: "You may drive, but defects were logged and the workshop has been notified to book it in." },
  Grounded: { label: "DO NOT DRIVE — book into workshop", instruction: "This vehicle has a critical defect. Do NOT drive it. Report to the workshop to book it in." },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const p = await req.json();
    const vehicleType = p.vehicleType || "";
    const results: any[] = Array.isArray(p.results) ? p.results : [];

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
    const outcome = OUTCOME[result];

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

    // ONE job card per inspection, all defects as line items.
    let jobCardId: string | null = null;
    if (failed.length && p.vehicleId) {
      const topSeverity = failedCritical ? "Critical" : failedUrgent ? "Urgent" : "Minor";
      const anyTyre = failed.some(isTyre);
      const defects = failed.map(r => ({ itemId: r.itemId || null, label: r.label || "Defect", section: r.section || null, severity: r.severity || "Minor", position: r.position || null, remarks: r.remarks || null, photoPath: r.photoPath || null, trailerName: r.trailerName || null, resolved: false }));
      const card = {
        organization_id: ORG, vehicle_id: p.vehicleId, submission_id: saved?.id || null,
        item_description: `${failed.length} defect${failed.length > 1 ? "s" : ""} — ${p.vehicleReg || "inspection"} (${reference})`,
        defects, type: anyTyre && failed.length === 1 ? "Tyre Change" : "Repair", status: "Reported",
        priority: prio(topSeverity), severity: prio(topSeverity), reported_date: new Date().toISOString(),
      };
      const jr = await rest("job_cards", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(card) });
      if (jr.ok) jobCardId = (await jr.json())?.[0]?.id || null; else console.error("job_cards", (await jr.text()).slice(0, 200));
    }

    const failedItems = failed.map(r => ({ label: r.label, severity: r.severity, remarks: r.remarks || "", position: r.position || null }));

    if (failed.length) {
      const reg = esc(p.vehicleReg || p.vehicleId);
      const list = failed.map(r => `<li><strong>${esc(r.severity)}</strong> — ${esc(r.label)}${r.position ? ` (${esc(r.position)})` : ""}${r.remarks ? `: ${esc(r.remarks)}` : ""}</li>`).join("");
      const banner = result === "Grounded"
        ? `<p style="background:#fee2e2;color:#991b1b;padding:8px;border-radius:6px;font-weight:bold">⛔ DO NOT DRIVE — vehicle grounded (Off the road) and must be booked into the workshop.</p>`
        : `<p style="background:#fef3c7;color:#92400e;padding:8px;border-radius:6px;font-weight:bold">⚠️ Defects logged — book the vehicle in. It may still operate for now.</p>`;
      const html = `<div style="font-family:Arial,sans-serif"><h3 style="color:#13294b">Inspection result — ${reg}</h3><p>Driver: ${esc(driver.name)}${depot ? ` · ${esc(depot)}` : ""} · Ref ${esc(reference)}</p>${banner}<p><strong>${failedCritical} critical · ${failedUrgent} urgent · ${failedMinor} minor</strong> — 1 job card created with ${failed.length} item(s).</p><ul>${list}</ul></div>`;
      await sendEmail(workshopEmail(depot), `${result === "Grounded" ? "GROUNDED" : "DEFECTS"} — ${esc(p.vehicleReg || "vehicle")} inspection`, html, [OPS]);
      try {
        const mgrs = await getJson(`profiles?select=phone&is_active=eq.true&permissions=cs.{access_workshop}&phone=not.is.null&limit=1`);
        const phone = mgrs?.[0]?.phone;
        if (phone) await sendWhatsapp(phone, `FBN Workshop: ${p.vehicleReg || "vehicle"} ${result === "Grounded" ? "GROUNDED — book in" : "has defects"} (${failedCritical}C/${failedUrgent}U). Job card created. Ref ${reference}.`);
      } catch (e) { console.error("mgr-wa", e); }
    }

    return json({ ok: true, id: saved?.id, reference, result, resultLabel: outcome.label, instruction: outcome.instruction, failedCritical, failedUrgent, failedMinor, jobCardId, failedItems });
  } catch (e) { console.error("[submit-inspection]", e); return json({ error: String((e as Error)?.message || e) }, 500); }
});
