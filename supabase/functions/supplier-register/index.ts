import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1?target=deno";

// Public subcontractor registration (POST from /supplier-register). Uploads cert
// docs to the supplier-applications bucket, captures IP + timestamp SERVER-SIDE,
// generates the signed-agreement PDF, inserts a PENDING supplier_applications row
// (lands in the onboarding queue), and emails the applicant + admins. If the
// applicant came from an invite link (?invite=<token>), the matching
// subcontractor_invites row is advanced to 'Applied' so the campaign funnel moves.
const URL = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORG = "00000000-0000-0000-0000-000000000001";
const BUCKET = "supplier-applications";
const OPS = "ops@fbn-transport.co.za", LOADCONS = "loadcons@fbn-transport.co.za";
const NAVY = rgb(0.075, 0.16, 0.294);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'doc';
const b64bytes = (b64: string) => { const raw = String(b64 || '').split(',').pop() || ''; const bin = atob(raw); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const extOf = (name: string, ct: string) => { const m = String(name || '').match(/\.([a-z0-9]{2,5})$/i); if (m) return m[1].toLowerCase(); if (/pdf/.test(ct)) return 'pdf'; if (/png/.test(ct)) return 'png'; return 'jpg'; };

async function rest(path: string, init?: RequestInit) { return fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) } }); }
async function upload(path: string, bytes: Uint8Array, ct: string): Promise<string | null> {
  const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": ct, "x-upsert": "true" }, body: bytes });
  return r.ok ? `${BUCKET}/${path}` : null;
}
async function sendEmail(to: string, subject: string, html: string, cc?: string[]) { try { await fetch(`${URL}/functions/v1/send-email`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, cc: cc && cc.length ? cc : undefined, subject, html, fromName: "FBN Transport" }) }); } catch (e) { console.error('email', e); } }

async function buildPdf(app: any, sla: { intro: string; clauses: { t: string; b: string }[] }, acceptedAt: string, ip: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const A4: [number, number] = [595.28, 841.89]; const margin = 50; const width = A4[0] - margin * 2;
  let page = pdf.addPage(A4); let y = A4[1] - margin;
  const ensure = (sp: number) => { if (y - sp < margin) { page = pdf.addPage(A4); y = A4[1] - margin; } };
  const para = (t: string, opt: { size?: number; bold?: boolean; gap?: number } = {}) => { const f = opt.bold ? bold : font; const s = opt.size || 9.5; const lh = s * 1.35; for (const rawLine of String(t).split('\n')) { const words = rawLine.split(/\s+/); let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (f.widthOfTextAtSize(test, s) > width && line) { ensure(lh); page.drawText(line, { x: margin, y: y - s, size: s, font: f, color: NAVY }); y -= lh; line = w; } else line = test; } ensure(lh); page.drawText(line, { x: margin, y: y - s, size: s, font: f, color: NAVY }); y -= lh; } y -= (opt.gap ?? 4); };
  // Header
  page.drawText('FBN TRANSPORT CC', { x: margin, y: y - 16, size: 16, font: bold, color: NAVY }); y -= 22;
  para('Subcontractor Service Level Agreement & Standard Terms and Conditions', { bold: true, size: 11, gap: 2 });
  para(`Registration No 1989/001182/23  |  Agreement ref: ${app.id}`, { size: 8, gap: 10 });
  // Sub details
  para('SUBCONTRACTOR DETAILS', { bold: true, size: 10, gap: 2 });
  para(`Company: ${app.company_name || ''}    Reg No: ${app.registration_number || '-'}    VAT: ${app.vat_number || '-'}`);
  para(`Address: ${app.address || '-'}`);
  para(`Contact: ${app.contact_person || ''}  |  ${app.contact_email || ''}  |  ${app.contact_phone || ''}`, { gap: 10 });
  // Agreement text
  para(sla.intro, { gap: 6 });
  sla.clauses.forEach((c, i) => para(`${i + 1}. ${c.t}: ${c.b}`, { gap: 5 }));
  // Acceptance block
  y -= 6; ensure(90);
  para('ELECTRONIC ACCEPTANCE', { bold: true, size: 10, gap: 2 });
  para(`Accepted by: ${app.agreement_full_name || ''}    ID No: ${app.agreement_id_number || ''}    Position: ${app.agreement_position || ''}`);
  para(`Company: ${app.company_name || ''}`);
  para(`Date & time (server): ${acceptedAt}    IP address: ${ip}`);
  para('Accepted electronically via the FBN Transport supplier portal. This electronic acceptance constitutes a valid signature in terms of the Electronic Communications and Transactions Act 25 of 2002.', { size: 8, gap: 4 });
  return await pdf.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const body = await req.json();
    const c = body.company || {};
    if (!String(c.companyName || '').trim()) return json({ error: 'Company name is required.' }, 400);
    if (!String(c.contactEmail || '').trim()) return json({ error: 'Contact email is required.' }, 400);
    if (!body.agreement || !body.agreement.accepted || !String(body.agreement.fullName || '').trim()) return json({ error: 'You must accept the agreement and provide your full name.' }, 400);
    const docs: any[] = Array.isArray(body.documents) ? body.documents : [];
    if (!docs.some(d => /git/i.test(d.type || '') && d.base64)) return json({ error: 'The Goods-in-Transit (GIT) document is required.' }, 400);

    const id = crypto.randomUUID();
    const acceptedAt = new Date().toISOString();
    // 1. Upload documents.
    const storedDocs: any[] = [];
    for (const d of docs) {
      if (!d.base64) continue;
      const path = `applications/${id}/${slug(d.type)}.${extOf(d.fileName, d.contentType || '')}`;
      const url = await upload(path, b64bytes(d.base64), d.contentType || 'application/octet-stream');
      if (url) storedDocs.push({ type: d.type, path: url, expiry: d.expiry || null });
    }
    const gitPath = storedDocs.find(d => /git/i.test(d.type))?.path || null;

    // 2. Build + upload the agreement PDF.
    const appForPdf = { id, company_name: c.companyName, registration_number: c.registrationNumber, vat_number: c.vatNumber, address: c.address, contact_person: c.contactName, contact_email: c.contactEmail, contact_phone: c.contactMobile, agreement_full_name: body.agreement.fullName, agreement_id_number: body.agreement.idNumber, agreement_position: body.agreement.position };
    let pdfPath: string | null = null;
    try { const pdfBytes = await buildPdf(appForPdf, { intro: body.slaIntro || '', clauses: Array.isArray(body.slaClauses) ? body.slaClauses : [] }, acceptedAt, ip); pdfPath = await upload(`applications/${id}/agreement.pdf`, pdfBytes, 'application/pdf'); } catch (e) { console.error('pdf', e); }

    // 3. Insert the pending application.
    const vehicles: any[] = Array.isArray(body.vehicles) ? body.vehicles : [];
    const vehicleTypes = [...new Set(vehicles.map(v => v.vehicleType).filter(Boolean))];
    const row = {
      id, organization_id: ORG, status: 'Pending', submitted_date: acceptedAt.slice(0, 10),
      company_name: c.companyName, contact_person: c.contactName || null, contact_email: c.contactEmail, contact_phone: c.contactMobile || null,
      address: c.address || null, registration_number: c.registrationNumber || null, vat_number: c.vatNumber || null,
      years_operating: c.yearsOperating ? Number(String(c.yearsOperating).replace(/[^0-9.]/g, '')) || null : null,
      bee_status: c.beeLevel || null, vehicle_types: vehicleTypes, vehicles, routes_detail: Array.isArray(body.routes) ? body.routes : [],
      cross_border_countries: Array.isArray(body.crossBorderCountries) ? body.crossBorderCountries : [],
      routes: (Array.isArray(body.routes) ? body.routes.map((r: any) => r.route).join(', ') : '') || null,
      haz_compliant: vehicles.some(v => v.hazmat), documents: storedDocs, insurance_url: gitPath,
      agreement_full_name: body.agreement.fullName, agreement_id_number: body.agreement.idNumber || null, agreement_position: body.agreement.position || null,
      agreement_accepted_at: acceptedAt, agreement_ip: ip, agreement_pdf_url: pdfPath, invite_token: body.inviteToken || null,
    };
    const ir = await rest('supplier_applications', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (!ir.ok) { const t = await ir.text(); return json({ error: `Could not save application: ${t.slice(0, 200)}` }, 500); }

    // 3b. Invite funnel: if they came from an invite link, advance it to Applied.
    if (body.inviteToken) {
      try {
        await rest(`subcontractor_invites?token=eq.${encodeURIComponent(body.inviteToken)}&status=in.(Pending,Invited)`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'Applied', application_id: id, applied_at: acceptedAt, updated_at: acceptedAt }),
        });
      } catch (e) { console.error('invite-applied', e); }
    }

    // 4. Emails: applicant confirmation + admin notification.
    const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><div style="background:#13294b;padding:18px 24px;color:#f5b700;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-size:12px">FBN Transport - Carrier Network</div><div style="height:4px;background:#f5b700"></div><div style="padding:22px 24px;color:#1f2937;font-size:14px;line-height:1.6">${inner}</div></div>`;
    await sendEmail(c.contactEmail, `FBN Transport - Subcontractor application received (${esc(c.companyName)})`, wrap(`<p>Good day ${esc(c.contactName || '')},</p><p>Thank you for applying to join the FBN Transport carrier network. We have received <strong>${esc(c.companyName)}</strong>'s application and signed agreement.</p><p>Our compliance team will review your details and certifications and be in touch once vetted. Reference: <strong>${id.slice(0, 8)}</strong>.</p><p>Regards,<br>FBN Transport</p>`));
    let admins: string[] = [];
    try { const ar = await rest(`profiles?role=in.(Admin,%22Super%20Admin%22)&is_active=eq.true&select=email`); const aj = await ar.json(); admins = (Array.isArray(aj) ? aj : []).map((a: any) => a.email).filter(Boolean); } catch (_e) { /* */ }
    const to = admins.length ? admins.join(',') : OPS;
    await sendEmail(to, `New subcontractor application - ${esc(c.companyName)}`, wrap(`<p>A new subcontractor application has been submitted and is in the <strong>Onboarding queue</strong>.</p><ul><li><strong>${esc(c.companyName)}</strong> (Reg ${esc(c.registrationNumber || '-')}, VAT ${esc(c.vatNumber || '-')})</li><li>Contact: ${esc(c.contactName)} - ${esc(c.contactEmail)} - ${esc(c.contactMobile)}</li><li>Fleet: ${vehicles.length} vehicle(s); ${vehicleTypes.join(', ') || '-'}</li><li>Documents: ${storedDocs.map(d => esc(d.type)).join(', ') || '-'}</li><li>Agreement accepted by ${esc(body.agreement.fullName)} (${esc(body.agreement.position || '')}) at ${acceptedAt} from IP ${ip}</li></ul><p>Open the Partners - Onboarding queue to vet and approve.</p>`), [LOADCONS]);

    return json({ ok: true, id, reference: id.slice(0, 8), pdf: pdfPath });
  } catch (e) {
    console.error("[supplier-register]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
