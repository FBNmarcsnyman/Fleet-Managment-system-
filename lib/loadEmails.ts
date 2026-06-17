// Shared builders/senders for the two load documents, so the manual buttons
// (SubcontractorLoadsView) and the auto-send on create (OperationsContext) use
// the SAME wording, attachment and Drive filing. All sends respect TEST MODE
// (enforced in the send-email edge function).
import { supabase, directInvoke } from './supabase';
import { buildLoadConPdf } from './loadconPdf';
import { brandedEmail, emailButton } from './emailTemplate';

const fmtD = (d?: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? (d || '') : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };
const shortLoc = (a?: string) => { const p = String(a || '').split(',').map(s => s.trim()).filter(Boolean); return p.length ? p[p.length - 1] : (a || ''); };
const mapLink = (a?: string) => a ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}` : '';
const withMap = (a?: string) => a ? `${a} &nbsp;<a href="${mapLink(a)}" style="color:#1d4ed8;font-weight:700;white-space:nowrap">📍 View on map</a>` : '';
const lblTd = 'padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;white-space:nowrap;vertical-align:top';
const valTd = 'padding:5px 0;color:#13294b;font-size:13px;font-weight:700';
const table = (rows: [string, string | undefined][]) => {
    const body = rows.filter(([, v]) => v != null && `${v}`.trim() !== '')
        .map(([k, v]) => `<tr><td style="${lblTd}">${k}</td><td style="${valTd}">${v}</td></tr>`).join('');
    return body ? `<table style="border-collapse:collapse;margin:6px 0 14px">${body}</table>` : '';
};
const subjLoc = (lc: any, a: string) => a ? `${lc.clientName ? lc.clientName + ', ' : ''}${a}` : '';
const base = () => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

type Sent = { ok: boolean; error?: string; pdfFailed?: boolean };

// LoadCon → subcontractor (their copy, with the transport rate + accept link).
export async function sendLoadConToSupplier(lc: any, to?: string): Promise<Sent> {
    const dest = (to ?? lc.subcontractorEmail ?? '').trim();
    if (!dest) return { ok: false, error: 'No transporter email.' };
    let attachments: any[] | undefined; let b64: string | undefined; let pdfFailed = false;
    try { const r = await buildLoadConPdf(lc, 'loadcon'); b64 = r.base64; attachments = [{ filename: r.filename, content: r.base64, contentType: 'application/pdf' }]; }
    catch (e) { console.error('[loadEmails] loadcon pdf', e); pdfFailed = true; }
    const collLoc = shortLoc(lc.collectionPoint), delLoc = shortLoc(lc.deliveryPoint);
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
      <p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      <p>Please find ${attachments ? 'attached ' : ''}your FBN Load Confirmation for the load from <strong>${collLoc}</strong> to <strong>${delLoc}</strong>.</p>
      ${table([['Collection', withMap(lc.collectionPoint)], ['Delivery', withMap(lc.deliveryPoint)], ['Loading date', fmtD(lc.collectionDate)], ['Loading time', lc.loadingTime], ['Load type / size', lc.loadType], ['Weight (kg)', lc.weightKg], ['Commodity', lc.commodity], ['Packaging', lc.packaging], ['Transport rate', lc.supplierRate ? `R ${lc.supplierRate}` : '']])}
      <p>Kindly <strong>confirm acceptance</strong> and send your driver name, vehicle registration and driver cell using the button below. POD to be returned on delivery.</p>
      ${emailButton(`${base()}?accept=${lc.id}`, 'Accept this load &amp; send driver details &rarr;', '#16a34a')}
      <p>Regards,<br>FBN Transport</p>`);
    try {
        const { data, error } = await supabase.functions.invoke('send-email', { body: { to: dest, cc: ['loadcons@fbn-transport.co.za', ...(lc.ccEmail ? [lc.ccEmail] : [])], subject: `FBN Load Confirmation ${lc.loadConNumber} - ${subjLoc(lc, collLoc)} to ${subjLoc(lc, delLoc)}`, html, fromName: 'FBN Transport', attachments } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'send failed' }; }
    if (b64) { void directInvoke('drive-file', { loadId: lc.id, files: [{ base64: b64, name: 'LoadCon.pdf', kind: 'loadcon', contentType: 'application/pdf' }] }); }
    return { ok: true, pdfFailed };
}

// Client Order → client (no rates; thank-you + booked + regular-updates promise).
export async function sendOrderToClient(lc: any, to?: string): Promise<Sent> {
    const dest = (to ?? lc.clientEmail ?? '').trim();
    if (!dest) return { ok: false, error: 'No client email.' };
    let attachments: any[] | undefined; let b64: string | undefined; let pdfFailed = false;
    try { const r = await buildLoadConPdf(lc, 'clientOrder'); b64 = r.base64; attachments = [{ filename: r.filename, content: r.base64, contentType: 'application/pdf' }]; }
    catch (e) { console.error('[loadEmails] order pdf', e); pdfFailed = true; }
    const collLoc = shortLoc(lc.collectionPoint), delLoc = shortLoc(lc.deliveryPoint);
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
      <p>Good day ${lc.clientContact || lc.clientName || ''},</p>
      <p><strong>Thank you for your load.</strong> We have made all the arrangements and booked it accordingly. Please find your order ${attachments ? 'attached, ' : ''}with all the details${attachments ? '' : ' below'}:</p>
      ${table([['Collection', withMap(lc.collectionPoint)], ['Delivery', withMap(lc.deliveryPoint)], ['Loading date', fmtD(lc.collectionDate)], ['Load type / size', lc.loadType], ['Weight (kg)', lc.weightKg], ['Commodity', lc.commodity], ['Packaging', lc.packaging], ['Your reference', lc.customerOrderNumber]])}
      ${emailButton(`${base()}?track=${lc.id}`, 'Track your shipment &rarr;')}
      <p>You'll receive regular updates as we progress through collection and delivery, and the POD as soon as it's available.</p>
      <p>Regards,<br>FBN Transport</p>`);
    try {
        const { data, error } = await supabase.functions.invoke('send-email', { body: { to: dest, cc: lc.ccEmail || undefined, subject: `FBN Transport Order ${lc.loadConNumber} - ${subjLoc(lc, collLoc)} to ${subjLoc(lc, delLoc)}`, html, fromName: 'FBN Transport', attachments } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'send failed' }; }
    if (b64) { void directInvoke('drive-file', { loadId: lc.id, files: [{ base64: b64, name: 'Client-Order.pdf', kind: 'clientorder', contentType: 'application/pdf' }] }); }
    return { ok: true, pdfFailed };
}
