import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Lets a logged-in carrier update ONLY their own safe profile fields. The suppliers
// table's RLS reserves writes for staff (so a carrier can't self-vet or change their
// compliance status); this service-role fn enforces a strict column whitelist and
// resolves the supplier from the caller's JWT (never from the request body).
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function subOf(auth: string | null): string | null {
  try { const t = (auth || "").replace(/^Bearer\s+/i, ""); const p = t.split(".")[1]; if (!p) return null;
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))).sub || null; } catch { return null; }
}

// Domain key -> safe DB column. Anything not listed here is ignored.
const ALLOWED: Record<string, string> = {
  contactPerson: "contact_person", contactEmail: "contact_email", contactPhone: "contact_phone",
  controllerContact: "controller_contact", accountsContact: "accounts_contact", address: "address",
  regions: "regions", vehicleTypes: "vehicle_types", trailerTypes: "trailer_types", name: "name",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const sub = subOf(req.headers.get("Authorization"));
    if (!sub) return json({ error: "Not authenticated" }, 401);
    // Resolve the caller's supplier_id from their profile — never trust the body.
    const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${sub}&select=supplier_id,is_active`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const prof = (await pr.json())?.[0];
    if (!prof || prof.is_active === false || !prof.supplier_id) return json({ error: "Not authorised" }, 403);

    const body = await req.json();
    const fields = body.fields || {};
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, col] of Object.entries(ALLOWED)) {
      if (fields[k] !== undefined) row[col] = fields[k];
    }
    if (Object.keys(row).length === 1) return json({ error: "No editable fields supplied." }, 400);

    const r = await fetch(`${URL}/rest/v1/suppliers?id=eq.${prof.supplier_id}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!r.ok) { const t = await r.text(); return json({ error: `Could not save: ${t.slice(0, 160)}` }, 500); }
    const updated = (await r.json())?.[0];
    return json({ ok: true, supplier: updated });
  } catch (e) {
    console.error("[supplier-self-update]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
