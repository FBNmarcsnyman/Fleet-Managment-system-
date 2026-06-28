import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Mints a short-lived signed URL for an inspection photo in the PRIVATE inspections
// bucket so workshop/management staff can view it from the Checklist Review screen.
// Gated: caller must be a logged-in staff member with a management role or the
// access_workshop / access_fleet permission. Runs with verify_jwt=true.
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "inspections";
const ALLOWED = new Set(["Super Admin", "Admin", "Manager", "Operations"]);
const PERMS = new Set(["access_workshop", "access_fleet", "access_fleet_management"]);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function subOf(auth: string | null): string | null {
  try { const t = (auth || "").replace(/^Bearer\s+/i, ""); const p = t.split(".")[1]; if (!p) return null;
    const j = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))); return j.sub || null; } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const sub = subOf(req.headers.get("Authorization"));
    if (!sub) return json({ error: "Not authenticated" }, 401);
    const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${sub}&select=role,is_active,permissions`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const prof = (await pr.json())?.[0];
    const perms: string[] = Array.isArray(prof?.permissions) ? prof.permissions : [];
    const ok = prof && prof.is_active !== false && (ALLOWED.has(prof.role) || perms.some((p) => PERMS.has(p)));
    if (!ok) return json({ error: "Not authorised" }, 403);

    let p = String((await req.json())?.path || "").trim();
    if (!p) return json({ error: "path required" }, 400);
    if (p.startsWith(`${BUCKET}/`)) p = p.slice(BUCKET.length + 1);
    if (p.includes("..")) return json({ error: "Invalid path" }, 400);

    const sr = await fetch(`${URL}/storage/v1/object/sign/${BUCKET}/${p}`, {
      method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!sr.ok) { const t = await sr.text(); return json({ error: `Could not sign: ${t.slice(0, 160)}` }, 500); }
    const { signedURL } = await sr.json();
    return json({ url: `${URL}/storage/v1${signedURL}` });
  } catch (e) {
    console.error("[inspection-doc-url]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
