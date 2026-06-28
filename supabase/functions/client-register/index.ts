import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Public client self-registration (POST from /client-register). Inserts a PENDING
// client row (registration_status='pending', cod + unvetted) and emails admin/ops to
// approve from the Clients tab. No login is created until an admin approves.
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORG = "00000000-0000-0000-0000-000000000001";
const OPS = "ops@fbn-transport.co.za", LOADCONS = "loadcons@fbn-transport.co.za";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function rest(path: string, init?: RequestInit) { return fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) } }); }
async function sendEmail(to: string, subject: string, html: string, cc?: string[]) { try { await fetch(`${URL}/functions/v1/send-email`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, cc: cc && cc.length ? cc : undefined, subject, html, fromName: "FBN Transport" }) }); } catch (e) { console.error("email", e); } }
const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="background:#13294b;padding:18px 24px;color:#f5b700;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-size:12px">FBN Transport</div><div style="height:4px;background:#f5b700"></div><div style="padding:22px 24px;color:#1f2937;font-size:14px;line-height:1.6">${inner}</div></div>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const b = await req.json();
    const c = b.company || b;
    if (!String(c.companyName || "").trim()) return json({ error: "Company name is required." }, 400);
    if (!String(c.contactEmail || "").trim()) return json({ error: "Contact email is required." }, 400);

    const id = crypto.randomUUID();
    const row = {
      id, organization_id: ORG, name: c.companyName, registration_number: c.registrationNumber || null,
      vat_no: c.vatNumber || null, industry: c.industry || null,
      contact_person: c.contactName || null, contact_email: c.contactEmail, contact_phone: c.contactMobile || null,
      address: c.address || null, billing_address: c.billingAddress || null,
      preferred_routes: Array.isArray(b.preferredRoutes) ? b.preferredRoutes : [],
      cargo_types: Array.isArray(b.cargoTypes) ? b.cargoTypes : [],
      typical_load_sizes: c.typicalLoadSizes || null,
      marketing_email_optin: !!b.marketingEmailOptin, marketing_whatsapp_optin: !!b.marketingWhatsappOptin,
      account_status: "cod", vetted: false, registration_status: "pending", is_active: true,
    };
    const ir = await rest("clients", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
    if (!ir.ok) { const t = await ir.text(); return json({ error: `Could not save registration: ${t.slice(0, 200)}` }, 500); }

    // Confirmation to the applicant.
    await sendEmail(c.contactEmail, `FBN Transport - registration received (${esc(c.companyName)})`, wrap(`<p>Good day ${esc(c.contactName || "")},</p><p>Thank you for registering <strong>${esc(c.companyName)}</strong> with FBN Transport. Our team will review your details and activate your account — you'll get a welcome email with your login once approved.</p><p>Reference: <strong>${id.slice(0, 8)}</strong></p><p>Regards,<br>FBN Transport</p>`));
    // Notify admins.
    let admins: string[] = [];
    try { const ar = await rest(`profiles?role=in.(Admin,%22Super%20Admin%22)&is_active=eq.true&select=email`); const aj = await ar.json(); admins = (Array.isArray(aj) ? aj : []).map((a: any) => a.email).filter(Boolean); } catch (_e) { /* */ }
    const to = admins.length ? admins.join(",") : OPS;
    await sendEmail(to, `New client registration - ${esc(c.companyName)}`, wrap(`<p>A new client has registered and is <strong>pending approval</strong> in the Clients tab.</p><ul><li><strong>${esc(c.companyName)}</strong> (Reg ${esc(c.registrationNumber || "-")}, VAT ${esc(c.vatNumber || "-")}, ${esc(c.industry || "-")})</li><li>Contact: ${esc(c.contactName)} - ${esc(c.contactEmail)} - ${esc(c.contactMobile)}</li><li>Routes: ${esc((b.preferredRoutes || []).join(", ") || "-")}</li><li>Cargo: ${esc((b.cargoTypes || []).join(", ") || "-")}</li></ul><p>Open Operations &rarr; Clients to approve and create their login.</p>`), [LOADCONS]);

    return json({ ok: true, id, reference: id.slice(0, 8) });
  } catch (e) {
    console.error("[client-register]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
