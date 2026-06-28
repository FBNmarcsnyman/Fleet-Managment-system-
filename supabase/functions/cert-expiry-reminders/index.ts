import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Daily cron: emails carriers (and FBN admin) 30 days before a compliance cert
// expires and again on/after expiry. Idempotent via reminder_*_sent_at columns.
// When a GIT cert expires, flags the carrier (complianceStatus='Expired') and tells
// admin to review the carrier's RFQ access.
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPS = "ops@fbn-transport.co.za";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function rest(path: string, init?: RequestInit) {
  return fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) } });
}
async function sendEmail(to: string, subject: string, html: string, cc?: string[]) {
  try { await fetch(`${URL}/functions/v1/send-email`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, cc, subject, html, fromName: "FBN Transport" }) }); } catch (e) { console.error("email", e); }
}
const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="background:#13294b;padding:18px 24px;color:#f5b700;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-size:12px">FBN Transport - Carrier Compliance</div><div style="height:4px;background:#f5b700"></div><div style="padding:22px 24px;color:#1f2937;font-size:14px;line-height:1.6">${inner}</div></div>`;
const portalLink = `<p><a href="https://fleet-managment-system.marcsnyman.workers.dev/?portal=supplier" style="color:#13294b;font-weight:bold">Log in to the FBN carrier portal</a> to upload your renewal.</p>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const preview = !!body.preview;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);

    const r = await rest(`supplier_compliance_docs?select=id,type,name,expiry_date,supplier_id,reminder_30_sent_at,reminder_expiry_sent_at,suppliers(name,contact_email)&expiry_date=not.is.null`);
    const docs: any[] = await r.json();
    const out = { scanned: docs.length, warned: 0, expired: 0, gitFlagged: 0, skipped: 0 };

    for (const d of docs) {
      const exp = new Date(d.expiry_date); exp.setUTCHours(0, 0, 0, 0);
      const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
      const sup = d.suppliers || {};
      const to = sup.contact_email;
      const dateStr = exp.toLocaleDateString("en-ZA");

      // Expired (on/after expiry) — once.
      if (days < 0 && !d.reminder_expiry_sent_at) {
        out.expired++;
        if (!preview) {
          if (to) await sendEmail(to, `FBN - your ${esc(d.type)} certificate has EXPIRED`, wrap(`<p>Good day ${esc(sup.name || "")},</p><p>Your <strong>${esc(d.type)}</strong> certificate <strong>expired on ${dateStr}</strong>. Please renew it as soon as possible to keep receiving load offers.</p>${portalLink}<p>Kind regards,<br>FBN Transport</p>`));
          const gitNote = /git/i.test(d.type || "") ? ` GIT has expired — REVIEW RFQ ACCESS for this carrier.` : "";
          await sendEmail(OPS, `Carrier cert EXPIRED - ${esc(sup.name || "")} (${esc(d.type)})`, wrap(`<p><strong>${esc(sup.name || "Carrier")}</strong>'s <strong>${esc(d.type)}</strong> certificate expired on ${dateStr}.${gitNote}</p>`));
          await rest(`supplier_compliance_docs?id=eq.${d.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ reminder_expiry_sent_at: new Date().toISOString(), status: "Expired" }) });
          // GIT expiry flags the carrier account.
          if (/git/i.test(d.type || "")) { out.gitFlagged++; await rest(`suppliers?id=eq.${d.supplier_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ compliance_status: "Expired" }) }); }
        }
        continue;
      }
      // 30-day warning — once.
      if (days >= 0 && days <= 30 && !d.reminder_30_sent_at) {
        out.warned++;
        if (!preview) {
          if (to) await sendEmail(to, `FBN - your ${esc(d.type)} certificate expires in ${days} day${days === 1 ? "" : "s"}`, wrap(`<p>Good day ${esc(sup.name || "")},</p><p>Your <strong>${esc(d.type)}</strong> certificate expires on <strong>${dateStr}</strong> (in ${days} day${days === 1 ? "" : "s"}). Please upload a renewal so there's no gap in your compliance.</p>${portalLink}<p>Kind regards,<br>FBN Transport</p>`));
          await sendEmail(OPS, `Carrier cert expiring - ${esc(sup.name || "")} (${esc(d.type)}, ${days}d)`, wrap(`<p><strong>${esc(sup.name || "Carrier")}</strong>'s <strong>${esc(d.type)}</strong> certificate expires on ${dateStr} (${days} days).</p>`));
          await rest(`supplier_compliance_docs?id=eq.${d.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ reminder_30_sent_at: new Date().toISOString() }) });
        }
        continue;
      }
      out.skipped++;
    }
    return json({ ok: true, preview, ...out });
  } catch (e) {
    console.error("[cert-expiry-reminders]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
