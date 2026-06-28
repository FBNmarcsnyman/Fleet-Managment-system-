import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public (no-login) Driver Hub backend.
//   op:'meta'     -> vehicle list for the picker
//   op:'logs'     -> recent inspections + breakdowns + incidents for a vehicle
//   op:'incident' -> log an incident (insert incident_reports + notify ops)
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORG = "00000000-0000-0000-0000-000000000001";
const OPS = "ops@fbn-transport.co.za";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function rest(path: string, init?: RequestInit) { return fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) } }); }
async function getJson(path: string) { const r = await rest(path); return r.ok ? await r.json() : []; }
async function sendEmail(to: string, subject: string, html: string, cc?: string[]) { try { await fetch(`${URL}/functions/v1/send-email`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, cc, subject, html, fromName: "FBN Driver Hub" }) }); } catch (e) { console.error("email", e); } }
const workshopEmail = (depot: string) => /JHB/i.test(depot) ? "workshopjhb@fbn-transport.co.za" : "workshopdbn@fbn-transport.co.za";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const p = await req.json();
    const op = p.op || "meta";

    if (op === "meta") {
      const vehicles = await getJson(`vehicles?select=id,name,registration,weight_category,branch_id&order=name.asc`);
      const branches = await getJson(`branches?select=id,name`);
      const depotMap: Record<string, string> = {};
      (branches || []).forEach((b: any) => { depotMap[b.id] = /JHB|JOHAN/i.test(b.name) ? "JHB" : /DBN|DURBAN/i.test(b.name) ? "DBN" : b.name; });
      const list = (vehicles || []).filter((v: any) => v.status !== "Sold").map((v: any) => ({ id: v.id, name: v.name, registration: v.registration || "", depot: depotMap[v.branch_id] || "" }));
      return json({ ok: true, vehicles: list });
    }

    if (op === "logs") {
      if (!p.vehicleId) return json({ error: "Pick your vehicle." }, 400);
      const vid = p.vehicleId;
      const [inspections, breakdowns, incidents] = await Promise.all([
        getJson(`checklist_submissions?vehicle_id=eq.${vid}&select=date,result,reference,status,submitted_at&order=submitted_at.desc&limit=8`),
        getJson(`tyre_breakdowns?vehicle_id=eq.${vid}&select=reference,status,created_at,tyre_position,location&order=created_at.desc&limit=8`),
        getJson(`incident_reports?vehicle_id=eq.${vid}&select=date,incident_type,status,description&order=date.desc&limit=8`),
      ]);
      return json({ ok: true, inspections, breakdowns, incidents });
    }

    if (op === "incident") {
      if (!p.vehicleId) return json({ error: "Pick your vehicle." }, 400);
      const reg = p.vehicleReg || "";
      let depot = "";
      const vr = await getJson(`vehicles?id=eq.${p.vehicleId}&select=branch_id`);
      if (vr?.[0]?.branch_id) { const b = await getJson(`branches?id=eq.${vr[0].branch_id}&select=name`); depot = b?.[0]?.name || ""; }
      const notes = [p.driverName ? `Driver: ${p.driverName}` : "", p.driverContact ? `Contact: ${p.driverContact}` : "", p.location ? `Location: ${p.location}` : ""].filter(Boolean).join(" | ");
      const row = {
        organization_id: ORG, vehicle_id: p.vehicleId, date: p.date || new Date().toISOString().slice(0, 10),
        incident_type: p.incidentType || "Other", description: p.description || "", third_party_involved: !!p.thirdParty,
        attachment_urls: Array.isArray(p.photos) ? p.photos : [], status: "Reported", notes: notes || null,
      };
      const ir = await rest("incident_reports", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
      if (!ir.ok) { const t = await ir.text(); return json({ error: `Could not log incident: ${t.slice(0, 200)}` }, 500); }
      const saved = (await ir.json())?.[0];
      const reference = `INC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${(saved?.id || "").slice(0, 4).toUpperCase()}`;
      const html = `<div style="font-family:Arial,sans-serif"><h3 style="color:#13294b">Incident reported — ${esc(reg)}</h3><p>${esc(notes)}</p><ul><li>Type: ${esc(p.incidentType)}</li><li>Third party involved: ${p.thirdParty ? "Yes" : "No"}</li><li>Date: ${esc(row.date)}</li></ul><p>${esc(p.description)}</p>${(row.attachment_urls || []).length ? `<p>${row.attachment_urls.length} photo(s) attached.</p>` : ""}</div>`;
      await sendEmail(OPS, `INCIDENT — ${esc(reg || "vehicle")} (${esc(p.incidentType || "Other")})`, html, [workshopEmail(depot)]);
      return json({ ok: true, id: saved?.id, reference });
    }

    return json({ error: "Unknown op" }, 400);
  } catch (e) { console.error("[driver-hub]", e); return json({ error: String((e as Error)?.message || e) }, 500); }
});
