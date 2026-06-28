import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public (no-login) inspection photo upload → PRIVATE inspections bucket. Returns the
// stored path; staff view later via short-lived signed URLs (inspection-doc-url).
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "inspections";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const b64bytes = (b64: string) => { const raw = String(b64 || "").split(",").pop() || ""; const bin = atob(raw); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const extOf = (ct: string) => /png/.test(ct) ? "png" : /webp/.test(ct) ? "webp" : /pdf/.test(ct) ? "pdf" : "jpg";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { base64, vehicleId, contentType } = await req.json();
    if (!base64) return json({ error: "No image" }, 400);
    const ct = contentType || "image/jpeg";
    const path = `${vehicleId || "misc"}/${Date.now()}_${Math.round(Math.random() * 1e6)}.${extOf(ct)}`;
    const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": ct, "x-upsert": "true" }, body: b64bytes(base64),
    });
    if (!r.ok) { const t = await r.text(); return json({ error: `Upload failed: ${t.slice(0, 160)}` }, 500); }
    return json({ ok: true, path: `${BUCKET}/${path}` });
  } catch (e) { console.error("[inspection-upload]", e); return json({ error: String((e as Error)?.message || e) }, 500); }
});
