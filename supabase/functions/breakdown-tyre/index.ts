import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public (no-login) road breakdown tyre-change logging (/breakdown/tyre).
//   op:'meta'    -> vehicles + suppliers for the dropdowns
//   op:'log'     -> insert breakdown, flag vehicle 'Breakdown in Progress', notify workshop
//   op:'resolve' -> mark resolved, attach waybill, restore vehicle status
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const p = await req.json();
    const op = p.op || "log";

    if (op === "meta") {
      const vehicles = await getJson(`vehicles?select=id,name,registration&is_active=eq.true&order=name.asc`);
      const suppliers = await getJson(`suppliers?select=id,name&is_active=eq.true&order=name.asc`);
      return json({ ok: true, vehicles, suppliers });
    }

    if (op === "resolve") {
      if (!p.id) return json({ error: "Missing breakdown id" }, 400);
      const rows = await getJson(`tyre_breakdowns?id=eq.${p.id}&select=vehicle_id,status_before&limit=1`);
      const bd = rows?.[0];
      await rest(`tyre_breakdowns?id=eq.${p.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "Resolved", resolved_at: new Date().toISOString(), waybill_url: p.waybillPath || null }) });
      if (bd?.vehicle_id) await rest(`vehicles?id=eq.${bd.vehicle_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: bd.status_before || "On the road" }) });
      return json({ ok: true });
    }

    // op === 'log'
    if (!p.vehicleId && !p.vehicleReg) return json({ error: "Select your vehicle." }, 400);
    let depot = "";
    let statusBefore = "On the road";
    if (p.vehicleId) {
      const vr = await getJson(`vehicles?id=eq.${p.vehicleId}&select=status,branch_id&limit=1`);
      const v = vr?.[0];
      statusBefore = v?.status || "On the road";
      if (v?.branch_id) { const b = await getJson(`branches?id=eq.${v.branch_id}&select=name`); depot = b?.[0]?.name || ""; }
    }
    const reference = `BRK-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.round(Math.random() * 9000 + 1000)}`;
    const row = {
      organization_id: ORG, reference, vehicle_id: p.vehicleId || null, vehicle_reg: p.vehicleReg || null,
      driver_name: p.driverName || null, driver_contact: p.driverContact || null, location: p.location || null,
      lat: p.lat ?? null, lng: p.lng ?? null, description: p.description || null, photos: Array.isArray(p.photos) ? p.photos : [],
      tyre_position: p.tyrePosition || null, replacement_fitted: !!p.replacementFitted, replacement_type: p.replacementType || null,
      service_provider: p.serviceProvider || null, eta_back: p.etaBack || null, depot, status: "In Progress", status_before: statusBefore,
    };
    const ir = await rest("tyre_breakdowns", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!ir.ok) { const t = await ir.text(); return json({ error: `Could not log breakdown: ${t.slice(0, 200)}` }, 500); }
    const saved = (await ir.json())?.[0];
    if (p.vehicleId) await rest(`vehicles?id=eq.${p.vehicleId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "Breakdown in Progress" }) });

    const wsTo = workshopEmail(depot);
    const html = `<div style="font-family:Arial,sans-serif"><h3 style="color:#13294b">Road breakdown — tyre</h3><p><strong>${esc(p.vehicleReg || "")}</strong>${depot ? ` (${esc(depot)})` : ""}</p><ul><li>Driver: ${esc(p.driverName)} — ${esc(p.driverContact)}</li><li>Location: ${esc(p.location)}</li><li>Tyre position: ${esc(p.tyrePosition)}</li><li>Replacement fitted: ${p.replacementFitted ? esc(p.replacementType || "Yes") : "No"}</li><li>Service provider: ${esc(p.serviceProvider)}</li><li>ETA back on road: ${esc(p.etaBack)}</li></ul><p>${esc(p.description)}</p><p>Ref ${reference}. Vehicle flagged Breakdown in Progress.</p></div>`;
    await sendEmail(wsTo, `BREAKDOWN — ${esc(p.vehicleReg || "vehicle")} — tyre`, html, [OPS]);
    if (p.driverContact) await sendWhatsapp(p.driverContact, `FBN: breakdown logged for ${p.vehicleReg || "your vehicle"} (ref ${reference}). Workshop notified.`);

    return json({ ok: true, id: saved?.id, reference });
  } catch (e) { console.error("[breakdown-tyre]", e); return json({ error: String((e as Error)?.message || e) }, 500); }
});
