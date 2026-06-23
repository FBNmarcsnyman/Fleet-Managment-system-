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

// Short city code for email subjects (CPT / JHB / DBN …). Prefers the FBN branch
// code, then a recognised city in the address, then the last address part.
const CITY_CODE = (s?: string): string => {
    const u = String(s || '').toUpperCase();
    if (/CAPE TOWN|\bCPT\b/.test(u)) return 'CPT';
    if (/DURBAN|\bDBN\b|PINETOWN|WESTMEAD|MOBENI|PROSPECTON|CONGELLA/.test(u)) return 'DBN';
    if (/JOHANNESBURG|\bJHB\b|MIDRAND|RANDJES|WADEVILLE|GERMISTON|SANDTON|KEMPTON|BOKSBURG|ISANDO|GAUTENG|PRETORIA|CENTURION|CHLOORKOP|JET PARK/.test(u)) return 'JHB';
    if (/PORT ELIZABETH|GQEBERHA/.test(u)) return 'PE';
    if (/EAST LONDON/.test(u)) return 'EL';
    if (/BLOEMFONTEIN/.test(u)) return 'BFN';
    return '';
};
const branchCode = (b?: string): string => { const m = String(b || '').toUpperCase().match(/FBN\s+([A-Z]+)/); return m ? m[1] : ''; };
// City from an ADDRESS (not the arranging branch) so origin/dest reflect the real
// pickup/delivery and stay consistent with the edge function (for email threading).
const placeAddr = (addr?: string): string => CITY_CODE(addr) || shortLoc(addr);
// Routing label for subjects, e.g. "CPT to DBN" (collection → FINAL destination).
export const routeLabel = (lc: any): string => `${placeAddr(lc?.collectionPoint)} to ${placeAddr(lc?.deliveryPoint)}`;
// Client email subject — identical across order + updates + POD so they thread.
export const clientSubject = (lc: any): string => `FBN Transport Client Order ${lc.loadConNumber} - ${routeLabel(lc)}`;
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

// Is this load ALREADY delivered when we send the doc? A LoadCon/Order created or
// resent after the trip is done must NOT ask the subbie to "accept & send driver
// details" or tell the client it's "booked". We check the STATUS and — because the
// status may not have been updated — also treat a past delivery date as delivered.
const isDelivered = (lc: any): boolean => {
    const s = String(lc?.status || '');
    if (['Delivered', 'POD Submitted', 'Invoiced'].includes(s)) return true;
    if (lc?.backDated || lc?.back_dated) return true;
    const dd = lc?.deliveryDate; if (dd) { const d = new Date(dd); const t = new Date(); t.setHours(0, 0, 0, 0); if (!isNaN(d.getTime()) && d < t) return true; }
    return false;
};

type Sent = { ok: boolean; error?: string; pdfFailed?: boolean };

// FBN depot addresses for transit-depot legs (subbie drops here, FBN runs onward).
const DEPOT_ADDR: Record<string, string> = {
    'FBN JHB': 'FBN TRANSPORT, 307 KREUPELHOUT STREET, WADEVILLE, GERMISTON',
    'FBN DBN': 'FBN TRANSPORT, 463 SYDNEY ROAD, CONGELLA, DURBAN',
    'FBN CPT': 'FBN TRANSPORT, CAPE TOWN',
};
// Where the SUBBIE delivers: the transit depot when routing via one, else the final door.
const subbieDeliveryPoint = (lc: any): string => lc.transitDepot ? (DEPOT_ADDR[lc.transitDepot] || `${lc.transitDepot} DEPOT`) : (lc.deliveryPoint || '');

// LoadCon → subcontractor (their copy, with the transport rate + accept link).
export async function sendLoadConToSupplier(lc: any, to?: string): Promise<Sent> {
    const dest = (to ?? lc.subcontractorEmail ?? '').trim();
    if (!dest) return { ok: false, error: 'No transporter email.' };
    // For a transit-depot leg the subbie's job ENDS at the depot — show that as
    // their delivery on both the email and the attached LoadCon PDF.
    const subDel = subbieDeliveryPoint(lc);
    const lcForPdf = lc.transitDepot ? { ...lc, deliveryPoint: subDel } : lc;
    let attachments: any[] | undefined; let b64: string | undefined; let pdfFailed = false;
    try { const r = await buildLoadConPdf(lcForPdf, 'loadcon'); b64 = r.base64; attachments = [{ filename: r.filename, content: r.base64, contentType: 'application/pdf' }]; }
    catch (e) { console.error('[loadEmails] loadcon pdf', e); pdfFailed = true; }
    const collLoc = shortLoc(lc.collectionPoint), delLoc = shortLoc(subDel);
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${lc.loadConNumber}</div>
      <p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>
      <p>Please find ${attachments ? 'attached ' : ''}your FBN Load Confirmation for the load from <strong>${collLoc}</strong> to <strong>${delLoc}</strong>.</p>
      ${lc.transitDepot ? `<p style="background:#eef2ff;border-radius:8px;padding:10px;color:#3730a3;font-size:13px"><strong>Delivery is to our ${lc.transitDepot} depot</strong> — FBN arranges the onward leg from there. Please offload at the depot and obtain a receipt.</p>` : ''}
      ${table([['Collection', withMap(lc.collectionPoint)], ['Delivery', withMap(subDel)], ['Loading date', fmtD(lc.collectionDate)], ['Loading time', lc.loadingTime], ['Load type / size', lc.loadType], ['Weight (kg)', lc.weightKg], ['Commodity', lc.commodity], ['Packaging', lc.packaging], ['Transport rate', lc.supplierRate ? money(lc.supplierRate) : '']])}
      ${isDelivered(lc)
        ? `<p>This load has already been <strong>delivered</strong>. Please view the Load Confirmation above for your records and <strong>upload the signed POD</strong> to close it off.</p>
      ${emailButton(`${base()}?pod=${lc.id}`, 'Upload signed POD &rarr;', '#16a34a')}
      <p style="font-size:13px;color:#5b6573">Tap the button on your phone to snap a photo of the signed POD — no login needed. Or reply to this email with the POD attached.</p>`
        : `<p>Kindly <strong>confirm acceptance</strong> and send your driver name, vehicle registration and driver cell using the button below. POD to be returned on delivery.</p>
      ${emailButton(`${base()}?accept=${lc.id}`, 'Accept this load &amp; send driver details &rarr;', '#16a34a')}`}
      <p>Regards,<br>FBN Transport</p>`);
    try {
        // Subbie LoadCon: cc the subbie docs team + ops — strip any CLIENT address.
        const cc = dropAddrs(['loadcons@fbn-transport.co.za', ...splitEmails(lc.ccEmail)], lc_clientAddrs(lc));
        const legDest = lc.transitDepot ? (branchCode(lc.transitDepot) || placeAddr(subDel)) : placeAddr(lc.deliveryPoint);
        const { data, error } = await invokeFn('send-email', { body: { to: dest, cc, subject: `FBN Load Confirmation ${lc.loadConNumber} - ${placeAddr(lc.collectionPoint)} to ${legDest}`, html, fromName: 'FBN Transport', attachments } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'send failed' }; }
    if (b64) { void directInvoke('drive-file', { loadId: lc.id, files: [{ base64: b64, name: 'LoadCon.pdf', kind: 'loadcon', contentType: 'application/pdf' }] }); }
    return { ok: true, pdfFailed };
}

// Grouped LoadCon → ONE subbie that's carrying SEVERAL trucks on a single client
// waybill. One email lists every vehicle they're allocated, each with its own
// "accept & send driver details" link, so they enter each truck's reg/driver.
export async function sendGroupLoadConToSupplier(loads: any[], to?: string): Promise<Sent> {
    if (!loads || loads.length === 0) return { ok: false, error: 'No loads.' };
    if (loads.length === 1) return sendLoadConToSupplier(loads[0], to); // single truck → normal loadcon (with PDF)
    const lc0 = loads[0];
    const dest = (to ?? lc0.subcontractorEmail ?? '').trim();
    if (!dest) return { ok: false, error: 'No transporter email.' };
    const collLoc = shortLoc(lc0.collectionPoint), delLoc = shortLoc(lc0.deliveryPoint);
    const waybill = lc0.loadRefNo || lc0.loadConNumber;
    const blocks = loads.map((lc, i) => `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:10px 0">
        <div style="font-weight:800;color:#13294b;margin-bottom:6px">Vehicle ${i + 1} of ${loads.length} — ${lc.loadConNumber}</div>
        ${table([['Loading date', fmtD(lc.collectionDate)], ['Weight (kg)', lc.weightKg], ['Packages', lc.loadedPackages], ['Commodity', lc.commodity], ['Rate', lc.supplierRate ? money(lc.supplierRate) : '']])}
        ${emailButton(`${base()}?accept=${lc.id}`, 'Accept &amp; send this vehicle&rsquo;s driver details &rarr;', '#16a34a')}
      </div>`).join('');
    const html = brandedEmail(`<p>Good day ${lc0.forAttention || lc0.subcontractorName || ''},</p>
      <p>Please find your FBN Load Confirmation for <strong>${loads.length} vehicles</strong> on the load from <strong>${collLoc}</strong> to <strong>${delLoc}</strong> (our waybill <strong>${waybill}</strong>).</p>
      <p>For <strong>each vehicle</strong> please confirm acceptance and send the driver name, vehicle registration and cell using its button below:</p>
      ${blocks}
      <p>A signed POD is to be returned on delivery for each vehicle.</p>
      <p>Regards,<br>FBN Transport</p>`);
    try {
        const cc = dropAddrs(['loadcons@fbn-transport.co.za', ...splitEmails(lc0.ccEmail)], lc_clientAddrs(lc0));
        const { data, error } = await invokeFn('send-email', { body: { to: dest, cc, subject: `FBN Load Confirmation ${waybill} - ${loads.length} vehicles - ${placeAddr(lc0.collectionPoint)} to ${placeAddr(lc0.deliveryPoint)}`, html, fromName: 'FBN Transport' } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'send failed' }; }
    return { ok: true };
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
      ${isDelivered(lc)
        ? `<p><strong>Thank you for your load.</strong> Please note this shipment has been <strong>delivered</strong> — we are now awaiting the signed POD, which we will send through as soon as it is received. Your order details are below${attachments ? ' and attached for your records' : ''}:</p>`
        : `<p><strong>Thank you for your load — we are pleased to confirm it is booked</strong> and all arrangements are in place. Your order details are set out below${attachments ? ' and attached for your records' : ''}:</p>`}
      ${table([
        ['FBN order no.', lc.loadConNumber],
        ['Your reference', lc.customerOrderNumber],
        ['Collection', withMap(lc.collectionPoint)],
        ['Delivery', withMap(lc.deliveryPoint)],
        ['Loading date', fmtD(lc.collectionDate)],
        ['Loading time', lc.loadingTime],
        ['Planned delivery', lc.transitDepot && lc.onwardPlannedDate ? `${fmtD(lc.onwardPlannedDate)}${lc.onwardPlannedTime ? ' ' + lc.onwardPlannedTime : ''}` : ''],
        ['Offloading date', fmtD(lc.deliveryDate)],
        ['Load type / size', lc.loadType],
        ['Weight (kg)', lc.weightKg],
        ['Commodity', lc.commodity],
        ['Packaging', lc.packaging],
      ])}
      ${emailButton(`${base()}?track=${lc.id}`, isDelivered(lc) ? 'Track &amp; view POD &rarr;' : 'Track your shipment &rarr;')}
      ${isDelivered(lc)
        ? `<p>You can follow the shipment and <strong>download the signed POD from the tracking link above as soon as it is uploaded</strong>. Should you need anything in the meantime, simply reply to this email.</p>`
        : `<p>You'll receive regular updates as the load progresses through collection and delivery, and the signed POD as soon as it is available. Should you need anything in the meantime, simply reply to this email.</p>`}
      <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);
    try {
        // Client Order goes to the client + the full CLIENT team (lc.clientCc) +
        // operations. NEVER the subcontractor's list — strip any SUBBIE address.
        const cc = dropAddrs([...splitEmails(lc.clientCc), 'loadcons@fbn-transport.co.za'], lc_subbieAddrs(lc));
        const { data, error } = await invokeFn('send-email', { body: { to: dest, cc, subject: clientSubject(lc), html, fromName: 'FBN Transport', attachments } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'send failed' }; }
    if (b64) { void directInvoke('drive-file', { loadId: lc.id, files: [{ base64: b64, name: 'Client-Order.pdf', kind: 'clientorder', contentType: 'application/pdf' }] }); }
    return { ok: true, pdfFailed };
}
