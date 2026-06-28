import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Logged-in client submits a quote request. Resolves the client from the caller's
// JWT (never the body), inserts a quotes row with status 'Requested' + request_data
// (so it lands in the staff Quotes "Requested" pipeline and "Quote It" pre-fills),
// and notifies ops. Returns a reference number.
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORG = "00000000-0000-0000-0000-000000000001";
const OPS = "ops@fbn-transport.co.za";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function subOf(auth: string | null): string | null { try { const t = (auth || "").replace(/^Bearer\s+/i, ""); const p = t.split(".")[1]; if (!p) return null; return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))).sub || null; } catch { return null; } }
async function rest(path: string, init?: RequestInit) { return fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) } }); }
async function sendEmail(to: string, subject: string, html: string) { try { await fetch(`${URL}/functions/v1/send-email`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, html, fromName: "FBN Client Portal" }) }); } catch (e) { console.error("email", e); } }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const sub = subOf(req.headers.get("Authorization"));
    if (!sub) return json({ error: "Not authenticated" }, 401);
    const pr = await rest(`profiles?id=eq.${sub}&select=client_id,is_active`); const prof = (await pr.json())?.[0];
    if (!prof || prof.is_active === false || !prof.client_id) return json({ error: "Not authorised" }, 403);
    const cr = await rest(`clients?id=eq.${prof.client_id}&select=name,contact_email`); const client = (await cr.json())?.[0] || {};

    const f = await req.json();
    const requestData = {
      collect_from: f.collectionAddress || null, collection_area: f.collectionAddress || null,
      deliver_to: f.deliveryAddress || null, delivery_area: f.deliveryAddress || null,
      collection_date: f.collectionDate || null, commodity: f.commodity || null, load_type: f.loadType || null,
      total_weight: f.weightKg || null, total_cube: f.volumeCbm || null, cargo_type: f.cargoType || null,
      hazardous: f.cargoType === "HAZMAT", un_number: f.unNumber || null, haz_class: f.hazClass || null,
      special_requirements: f.specialRequirements || null, urgency: f.urgency || null, description: f.cargoDescription || null,
      source: "client-portal",
    };
    const id = crypto.randomUUID();
    const quoteNumber = `QU-${Date.now()}`;
    const row = {
      id, organization_id: ORG, quote_number: quoteNumber, status: "Requested", date: new Date().toISOString().slice(0, 10),
      client_id: prof.client_id, commodity: f.commodity || null, request_data: requestData,
      items: [], legs: [{ collectionPoint: f.collectionAddress || "", deliveryPoint: f.deliveryAddress || "", movementType: "Internal" }],
      total_amount: 0, sent_to_client: false,
    };
    const ir = await rest("quotes", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    if (!ir.ok) { const t = await ir.text(); return json({ error: `Could not submit request: ${t.slice(0, 200)}` }, 500); }

    const wrap = (inner: string) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="background:#13294b;padding:16px 22px;color:#f5b700;font-weight:800;text-transform:uppercase;font-size:12px;letter-spacing:2px">FBN Transport - Quote Request</div><div style="height:4px;background:#f5b700"></div><div style="padding:20px 22px;color:#1f2937;font-size:14px;line-height:1.6">${inner}</div></div>`;
    await sendEmail(OPS, `Client quote request - ${esc(client.name || "Client")} (${quoteNumber})`, wrap(`<p>A logged-in client has requested a quote.</p><ul><li><strong>${esc(client.name)}</strong></li><li>${esc(f.collectionAddress)} &rarr; ${esc(f.deliveryAddress)}</li><li>${esc(f.commodity || "")} · ${esc(f.cargoType || "")} · ${esc(f.weightKg || "?")}kg · ${esc(f.loadType || "")}${f.urgency ? ` · ${esc(f.urgency)}` : ""}</li>${f.unNumber ? `<li>HAZMAT UN ${esc(f.unNumber)} class ${esc(f.hazClass || "")}</li>` : ""}${f.specialRequirements ? `<li>${esc(f.specialRequirements)}</li>` : ""}</ul><p>Open Quotes &rarr; Requested to price it.</p>`));
    return json({ ok: true, id, reference: quoteNumber });
  } catch (e) { console.error("[client-quote-request]", e); return json({ error: String((e as Error)?.message || e) }, 500); }
});
