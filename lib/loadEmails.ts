// Shared builders/senders for the two load documents, so the manual buttons
// (SubcontractorLoadsView) and the auto-send on create (OperationsContext) use
// the SAME wording, attachment and Drive filing. All sends respect TEST MODE
// (enforced in the send-email edge function).
import { directInvoke, invokeFn } from './supabase';
import { buildLoadConPdf } from './loadconPdf';
import { brandedEmail, emailButton } from './emailTemplate';

const fmtD = (d?: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? (d || '') : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };
// Money always shows 2 decimals: R5000 → R 5 000.00, R5000.50 → R 5 000.50.
const money = (n?: number | string) => { const v = Number(n); return isNaN(v) ? '' : 'R ' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
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
// Split a comma/semicolon list of CC emails into clean array entries.
export const splitEmails = (s?: string): string[] => String(s || '').split(/[,;]/).map(t => t.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// HARD RULE — client/subcontractor separation. A client must NEVER receive the
// subcontractor's LoadCon or transport rate, and a subcontractor must NEVER
// receive the client's identity or client rate. These helpers strip the other
// party's addresses from any recipient list as a last line of defence, on top
// of the docs being built separately. Do not remove.
const lc_subbieAddrs = (lc: any): string[] => [lc?.subcontractorEmail, ...splitEmails(lc?.ccEmail), ...splitEmails(lc?.updateCc)].filter(Boolean).map((e: string) => e.toLowerCase());
const lc_clientAddrs = (lc: any): string[] => [lc?.clientEmail, ...splitEmails(lc?.clientCc)].filter(Boolean).map((e: string) => e.toLowerCase());
const dropAddrs = (list: string[], forbidden: string[]): string[] => list.filter(e => e && !forbidden.includes(e.toLowerCase()));
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
    // Status-aware: an already-delivered load asks for the POD (no accept link).
    const delivered = ['Delivered', 'POD Submitted', 'Invoiced'].includes(lc.status);
    const intro = delivered
      ? `<p>This load has been <strong>delivered</strong>. Please see the updated Load Confirmation${attachments ? ' attached' : ' below'} for the load from <strong>${collLoc}</strong> to <strong>${delLoc}</strong>.</p>`
      : `<p>Please find ${attachments ? 'attached ' : ''}your FBN Load Confirmation for the load from <strong>${collLoc}</strong> to <strong>${delLoc}</strong>.</p>`;
    const callToAction = delivered
      ? (lc.podPhoto
          ? `<p>The signed POD is already on file — thank you. The attached copy is for your records.</p>`
          : `<p>Kindly <strong>upload the signed POD</strong> against this load using the button below.</p>
      ${emailButton(`${base()}?pod=${lc.id}`, 'Upload POD &rarr;', '#16a34a')}`)
      : `<p>Kindly <strong>confirm acceptance</strong> and send your driver name, vehicle registration and driver cell using the button below. POD to be returned on delivery.</p>
      ${emailButton(`${base()}?accept=${lc.id}`, 'Accept this load &amp; send driver details &rarr;', '#16a34a')}`;
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
      <p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      ${intro}
      ${table([['Collection', withMap(lc.collectionPoint)], ['Delivery', withMap(lc.deliveryPoint)], ['Loading date', fmtD(lc.collectionDate)], ['Loading time', lc.loadingTime], ['Load type / size', lc.loadType], ['Weight (kg)', lc.weightKg], ['Commodity', lc.commodity], ['Packaging', lc.packaging], ['Transport rate', lc.supplierRate ? money(lc.supplierRate) : '']])}
      ${callToAction}
      <p>Regards,<br>FBN Transport</p>`);
    try {
        // Subbie LoadCon: cc the subbie docs team + ops — strip any CLIENT address.
        const cc = dropAddrs(['loadcons@fbn-transport.co.za', ...splitEmails(lc.ccEmail)], lc_clientAddrs(lc));
        const { data, error } = await invokeFn('send-email', { body: { to: dest, cc, subject: `FBN Load Confirmation ${lc.loadConNumber} - ${subjLoc(lc, collLoc)} to ${subjLoc(lc, delLoc)}`, html, fromName: 'FBN Transport', attachments } });
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
    // Status-aware: a delivered load confirms delivery + POD, not "updates coming".
    const delivered = ['Delivered', 'POD Submitted', 'Invoiced'].includes(lc.status);
    const podUrl = lc.podPhoto?.data || '';
    const intro = delivered
      ? `<p>This load has been <strong>delivered</strong>. Your order details are set out below${attachments ? ' and attached for your records' : ''}:</p>`
      : `<p><strong>Thank you for your load — we are pleased to confirm it is booked</strong> and all arrangements are in place. Your order details are set out below${attachments ? ' and attached for your records' : ''}:</p>`;
    const footer = delivered
      ? (podUrl
          ? `${emailButton(podUrl, 'View / download POD &rarr;', '#16a34a')}
      <p>The signed POD for your delivery is available above. Should you need anything further, simply reply to this email.</p>`
          : `${emailButton(`${base()}?track=${lc.id}`, 'Track your shipment &rarr;')}
      <p>The signed POD will follow as soon as it is received. Should you need anything in the meantime, simply reply to this email.</p>`)
      : `${emailButton(`${base()}?track=${lc.id}`, 'Track your shipment &rarr;')}
      <p>You'll receive regular updates as the load progresses through collection and delivery, and the signed POD as soon as it is available. Should you need anything in the meantime, simply reply to this email.</p>`;
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
      <p>Good day ${lc.clientContact || lc.clientName || ''},</p>
      ${intro}
      ${table([
        ['FBN order no.', lc.loadConNumber],
        ['Your reference', lc.customerOrderNumber],
        ['Collection', withMap(lc.collectionPoint)],
        ['Delivery', withMap(lc.deliveryPoint)],
        ['Loading date', fmtD(lc.collectionDate)],
        ['Loading time', lc.loadingTime],
        ['Offloading date', fmtD(lc.deliveryDate)],
        ['Load type / size', lc.loadType],
        ['Weight (kg)', lc.weightKg],
        ['Commodity', lc.commodity],
        ['Packaging', lc.packaging],
      ])}
      ${footer}
      <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);
    try {
        // Client Order goes to the client + the full CLIENT team (lc.clientCc) +
        // operations. NEVER the subcontractor's list — strip any SUBBIE address.
        const cc = dropAddrs([...splitEmails(lc.clientCc), 'loadcons@fbn-transport.co.za'], lc_subbieAddrs(lc));
        const { data, error } = await invokeFn('send-email', { body: { to: dest, cc, subject: `FBN Transport Order ${lc.loadConNumber}`, html, fromName: 'FBN Transport', attachments } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'send failed' }; }
    if (b64) { void directInvoke('drive-file', { loadId: lc.id, files: [{ base64: b64, name: 'Client-Order.pdf', kind: 'clientorder', contentType: 'application/pdf' }] }); }
    return { ok: true, pdfFailed };
}
