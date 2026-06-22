import { invokeFn } from './supabase';
import { brandedEmail, emailButton } from './emailTemplate';
import { FBN_LOADCONS, branchOpsCc, ccForClient } from './loadEmails';
import { daysToDeadline, deadlineRelevant } from './depotShipments';

// Client-facing phrasing for each depot-shipment status (mirrors the load
// phase-email engine, but for the import/LCL depot flow).
const DEPOT_CLIENT_MSG: Record<string, string> = {
    'Waiting for Vessel': 'is booked — we are awaiting the vessel',
    'Vessel Arrived': 'the vessel has arrived in port',
    'Received at Depot': 'the container has been received at the unpack depot',
    'Unpacked': 'your cargo has been unpacked and is ready for collection',
    'Collection Booked': 'collection has been booked',
    'Collected': 'your cargo has been collected from the depot',
    'Received at FBN DBN': 'your cargo has been received at our Durban depot',
    'In Transit (Inter-depot)': 'your cargo is on the line-haul to the destination depot',
    'Received at FBN JHB': 'your cargo has arrived at our Johannesburg depot',
    'Loaded for Delivery': 'your cargo is loaded and out for delivery',
    'Delivered': 'your cargo has been delivered',
    'Empty Turned In': 'the empty has been turned in — this shipment is complete',
};

const base = () => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
const fmtDate = (s?: string) => { if (!s) return ''; const d = new Date(s); return isNaN(d.getTime()) ? (s || '') : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };

// Send the client a branded status update for an LCL depot shipment. Tracked by
// loadcons@ + the handling branch ops (same routing rule as load emails). There
// is no subcontractor on the depot flow, so no cross-party stripping is needed,
// but we still route the cc through ccForClient for one consistent path.
export async function sendDepotClientUpdate(s: any, to: string): Promise<{ ok: boolean; error?: string }> {
    const dest = (to || '').trim();
    if (!dest) return { ok: false, error: 'No client email on file.' };
    const msg = DEPOT_CLIENT_MSG[s.status] || `is now: ${s.status}`;
    const ref = [s.house_bill, s.client_ref].filter(Boolean).join(' · ');
    const rows: [string, string][] = [
        ['House bill', s.house_bill || ''],
        ['Your reference', s.client_ref || ''],
        ['Vessel', s.vessel_name || ''],
        ['ETA', fmtDate(s.eta_port)],
        ['Commodity', s.commodity || ''],
        ['Packages', s.packages ? String(s.packages) : ''],
        ['Weight (kg)', s.weight ? String(s.weight) : ''],
        ['Cube (m³)', s.cube ? String(s.cube) : ''],
        ['Delivery', s.delivery_point || ''],
    ].filter(([, v]) => v && `${v}`.trim() !== '') as [string, string][];
    const table = `<table style="border-collapse:collapse;margin:6px 0 14px">${rows.map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">${v}</td></tr>`).join('')}</table>`;

    // If cargo is sitting at the depot, remind the client of the collection
    // deadline so storage charges are avoided.
    let deadlineNote = '';
    if (deadlineRelevant(s)) {
        const d = daysToDeadline(s);
        if (d !== null) {
            deadlineNote = d < 0
                ? `<p style="color:#b91c1c;font-weight:700">Please note this cargo is now ${Math.abs(d)} day(s) past the free-storage period — storage charges may apply.</p>`
                : `<p style="color:#b45309;font-weight:700">Free storage ends in ${d === 0 ? 'today' : `${d} day(s)`} — we are arranging collection to avoid storage charges.</p>`;
        }
    }

    const greet = String(s.client_name || '').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    const html = brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${ref || s.client_name || ''}</div>
      <p>Good day ${greet || ''},</p>
      <p>Update on your import shipment${ref ? ` (<strong>${ref}</strong>)` : ''}: ${msg}.</p>
      ${table}
      ${deadlineNote}
      ${emailButton(`${base()}?track=${s.id}`, 'Track your shipment &rarr;')}
      <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`);

    const cc = ccForClient(s, [FBN_LOADCONS, ...branchOpsCc(s)]);
    try {
        const { data, error } = await invokeFn('send-email', { body: { to: dest, cc, subject: `FBN Import Update — ${ref || s.client_name || ''}`, html, fromName: 'FBN Transport' } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message };
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'send failed' }; }
    return { ok: true };
}
