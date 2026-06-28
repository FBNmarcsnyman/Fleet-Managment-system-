import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public (no-login) inspection submission. Inserts the checklist_submissions row,
// computes failed counts by severity, sets the vehicle's inspection_status, and
// returns a reference + summary. (Rich notifications + job-card creation arrive in
// Part 5 / Part 7; here we persist the result and flag the vehicle.)
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORG = "00000000-0000-0000-0000-000000000001";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
async function rest(path: string, init?: RequestInit) { return fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) } }); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const p = await req.json();
    const results: any[] = Array.isArray(p.results) ? p.results : [];
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
      odometer: p.odometer ?? null, hours: p.hours ?? null, results, status: "Completed",
      reference, depot: p.depot || null, result, driver_id_number: driver.idNumber || null,
      licence_code: driver.licenceCode || null, pdp_expiry: driver.pdpExpiry || null, substituting: !!driver.substituting,
      trailer_ids: Array.isArray(p.trailerIds) ? p.trailerIds : [],
      failed_critical: failedCritical, failed_urgent: failedUrgent, failed_minor: failedMinor, submitted_at: new Date().toISOString(),
    };
    const ir = await rest("checklist_submissions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!ir.ok) { const t = await ir.text(); return json({ error: `Could not save inspection: ${t.slice(0, 200)}` }, 500); }
    const saved = (await ir.json())?.[0];

    // Flag the vehicle's inspection status (assignment-gating wiring comes in Part 5).
    if (p.vehicleId) {
      await rest(`vehicles?id=eq.${p.vehicleId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ inspection_status: result, last_inspection_at: new Date().toISOString() }) });
    }

    const failedItems = failed.map(r => ({ label: r.label, severity: r.severity, remarks: r.remarks || "", position: r.position || null }));
    return json({ ok: true, id: saved?.id, reference, result, failedCritical, failedUrgent, failedMinor, failedItems });
  } catch (e) { console.error("[submit-inspection]", e); return json({ error: String((e as Error)?.message || e) }, 500); }
});
