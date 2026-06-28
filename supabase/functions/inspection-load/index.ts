import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public (no-login) loader for the mobile inspection page. Given the QR uuid
// (?checklist=<uuid>), returns the vehicle, its matched checklist template, the
// trailer template (Horse/Loadmaster, so the trailer checklist can run), the
// trailer list, the assigned driver, and the last inspection.
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
async function rest(path) { const r = await fetch(`${URL}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }); return r.ok ? await r.json() : []; }

function vtype(cat, name) {
  cat = (cat || "").toUpperCase(); name = (name || "").toUpperCase();
  if (/SUPERLINK|TRIAXLE|TRI-AXLE|SKELETON|TRAILER/.test(cat)) return "Trailer";
  if (/FORKLIFT/.test(cat)) return "Forklift";
  if (cat === "HORSE") return name.startsWith("LM") ? "Loadmaster" : "Horse";
  if (/^RIGID/.test(cat) || /TONNER/.test(cat)) return "Rigid";
  return "Light";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { uuid } = await req.json();
    if (!uuid) return json({ error: "Missing checklist id" }, 400);
    const vrows = await rest(`vehicles?or=(checklist_uuid.eq.${uuid},id.eq.${uuid})&select=*&limit=1`);
    const v = vrows?.[0];
    if (!v) return json({ error: "Vehicle not found for this QR code." }, 404);
    const type = vtype(v.weight_category, v.name);
    const depotMap = {};
    const branches = await rest(`branches?select=id,name`);
    (branches || []).forEach((b) => { depotMap[b.id] = b.name; });
    const depotName = depotMap[v.branch_id] || "";
    const depot = /JHB|JOHAN/i.test(depotName) ? "JHB" : /DBN|DURBAN/i.test(depotName) ? "DBN" : (depotName || "");
    const tmpls = await rest(`checklist_templates?vehicle_types=cs.{${type}}&is_active=eq.true&select=*&limit=1`);
    const template = tmpls?.[0] || null;
    let trailerTemplate = null;
    if (type === "Horse" || type === "Loadmaster") { const tt = await rest(`checklist_templates?vehicle_types=cs.{Trailer}&is_active=eq.true&select=*&limit=1`); trailerTemplate = tt?.[0] || null; }
    const drv = await rest(`drivers?assigned_vehicle_id=eq.${v.id}&select=name,cell,pdp_expiry&limit=1`);
    const assignedDriver = drv?.[0] || null;
    const trailerRows = await rest(`vehicles?select=id,name,registration,weight_category&is_active=eq.true&order=name.asc`);
    const trailers = (trailerRows || []).filter((t) => vtype(t.weight_category, t.name) === "Trailer").map((t) => ({ id: t.id, name: t.name, registration: t.registration || "" }));
    const last = await rest(`checklist_submissions?vehicle_id=eq.${v.id}&select=date,result,created_at&order=created_at.desc&limit=1`);
    return json({ ok: true, vehicle: { id: v.id, name: v.name, registration: v.registration || v.reg || "", type, depot, status: v.status || "", crossBorder: !!v.cross_border, linkedVehicleId: v.linked_vehicle_id || null }, template, trailerTemplate, trailers, assignedDriver, lastInspection: last?.[0] || null });
  } catch (e) { console.error("[inspection-load]", e); return json({ error: String(e?.message || e) }, 500); }
});
