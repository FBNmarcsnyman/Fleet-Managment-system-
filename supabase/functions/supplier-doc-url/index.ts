import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Mints a short-lived signed URL for a document in the PRIVATE supplier-applications
// bucket so management can view a subcontractor's uploaded certs + signed-agreement
// PDF from the onboarding/vetting screen. Gated: caller must be a logged-in staff
// member with a management role (Super Admin / Admin / Manager / Operations).
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "supplier-applications";
const ALLOWED = new Set(["Super Admin", "Admin", "Manager", "Operations"]);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Decode the `sub` (user id) out of the caller's JWT without verifying signature
// (the function runs with verify_jwt=true, so the gateway already validated it).
function subOf(auth: string | null): string | null {
  try { const t = (auth || "").replace(/^Bearer\s+/i, ""); const p = t.split(".")[1]; if (!p) return null;
    const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))); return json.sub || null; } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const sub = subOf(req.headers.get("Authorization"));
    if (!sub) return json({ error: "Not authenticated" }, 401);
    // Role check.
    const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${sub}&select=role,is_active`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    const prof = (await pr.json())?.[0];
    if (!prof || prof.is_active === false || !ALLOWED.has(prof.role)) return json({ error: "Not authorised" }, 403);

    const { path } = await req.json();
    // Accept either "applications/<id>/file.pdf" or the stored "supplier-applications/applications/...".
    let p = String(path || "").trim();
    if (!p) return json({ error: "path required" }, 400);
    if (p.startsWith(`${BUCKET}/`)) p = p.slice(BUCKET.length + 1);
    if (p.includes("..") || !p.startsWith("applications/")) return json({ error: "Invalid path" }, 400);

    const sr = await fetch(`${URL}/storage/v1/object/sign/${BUCKET}/${p}`, {
      method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!sr.ok) { const t = await sr.text(); return json({ error: `Could not sign: ${t.slice(0, 160)}` }, 500); }
    const { signedURL } = await sr.json();
    return json({ url: `${URL}/storage/v1${signedURL}` });
  } catch (e) {
    console.error("[supplier-doc-url]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
