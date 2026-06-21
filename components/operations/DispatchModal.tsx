import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import DateField from './DateField';
import { invokeFn } from '../../lib/supabase';
import { brandedEmail } from '../../lib/emailTemplate';

// Depot ops inbox for a branch (handles both code "FBN DBN" and name "FBN Durban").
const opsEmailFor = (b?: string): string => {
    const t = (b || '').toLowerCase();
    if (t.includes('dbn') || t.includes('durban')) return 'opsdbn@fbn-transport.co.za';
    if (t.includes('jhb') || t.includes('johannesburg')) return 'opsjhb@fbn-transport.co.za';
    return 'ops@fbn-transport.co.za';
};
const fmtDate = (d?: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? (d || '') : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };

// "Dispatch to area" — the onward leg leaves our depot. In one click it sets the
// load In Transit, records the PLANNED DELIVERY date/time, and the client is
// auto-emailed "on route, delivery planned for <date>" (via the In-Transit phase
// email). Reuses the same load record — just advances it on the Broking board.
const deliveryArea = (addr?: string): string => {
    if (!addr) return '';
    const parts = String(addr).split(',').map(s => s.trim()).filter(Boolean).filter(s => !/south africa/i.test(s));
    for (let i = 0; i < parts.length; i++) if (/^\d{4}$/.test(parts[i])) return (parts[i - 1] || '').toUpperCase();
    return (parts[parts.length - 1] || '').toUpperCase();
};

const DispatchModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { handleUpdateLoadConfirmation } = useOperations() as any;
    const lc: LoadConfirmation | undefined = modal.payload?.loadCon;
    const [date, setDate] = useState((lc?.deliveryDate || '').slice(0, 10));
    const [time, setTime] = useState(lc?.deliveryEta && lc.deliveryEta.includes('T') ? lc.deliveryEta.split('T')[1]?.slice(0, 5) : '');
    const [busy, setBusy] = useState(false);

    if (!lc) return null;
    const area = deliveryArea(lc.deliveryPoint) || lc.destinationBranch || 'the delivery area';

    const dispatch = async () => {
        if (!date) { showToast('Set the planned delivery date.'); return; }
        setBusy(true);
        const eta = time ? `${date}T${time}` : undefined;
        const res = await handleUpdateLoadConfirmation(lc.id, {
            status: 'In Transit',
            deliveryDate: date,
            deliveryEta: eta || lc.deliveryEta,
        } as any);
        setBusy(false);
        if (res && res.ok === false) { showToast(`Could not dispatch: ${res.error}`); return; }

        // Inter-depot line haul: hand the load over to the RECEIVING depot and cc
        // the collecting (origin) depot, so the destination branch expects it.
        const interDepot = lc.collectionBranch && lc.destinationBranch && lc.collectionBranch !== lc.destinationBranch;
        if (interDepot) {
            const to = opsEmailFor(lc.destinationBranch);
            const cc = [opsEmailFor(lc.collectionBranch)].filter(e => e && e !== to);
            const row = (k: string, v?: string) => v ? `<tr><td style="padding:4px 14px 4px 0;color:#13294b;font-weight:700;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0;color:#13294b;font-weight:700">${v}</td></tr>` : '';
            const html = brandedEmail(`<p><strong>Line-haul inbound — please receive on arrival.</strong></p>
              <p>Load <strong>${lc.loadConNumber}</strong> has been dispatched from <strong>${lc.collectionBranch}</strong> to <strong>${lc.destinationBranch}</strong>.</p>
              <table style="border-collapse:collapse;margin:6px 0 12px">
                ${row('Client', lc.clientName)}
                ${row('Collection', lc.collectionPoint)}
                ${row('Delivery', lc.deliveryPoint)}
                ${row('Commodity', lc.commodity)}
                ${row('Packaging', lc.packaging)}
                ${row('Weight (kg)', (lc as any).weightKg)}
                ${row('Planned delivery', fmtDate(date))}
              </table>
              <p>Regards,<br>FBN Transport</p>`);
            void invokeFn('send-email', { body: { to, cc, subject: `LINE-HAUL INBOUND ${lc.loadConNumber} — ${lc.collectionBranch} → ${lc.destinationBranch}`, html, fromName: 'FBN Transport' } });
        }

        hideModal();
        showToast(`${lc.loadConNumber} dispatched to ${area}${interDepot ? ` — ${lc.destinationBranch} depot notified` : ''}, client updated.`);
    };

    const inp = 'w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 text-base focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <h2 className="text-xl font-black text-white mb-1">Dispatch — {lc.loadConNumber}</h2>
            <p className="text-xs text-gray-400 mb-4">Mark on route to <strong className="text-gray-200">{area}</strong> and set the planned delivery date. The client is told automatically.</p>
            <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Planned delivery date</label><DateField value={date} onChange={setDate} className={inp} /></div>
                <div><label className={lbl}>Time (optional)</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={inp} /></div>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={dispatch} disabled={busy} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Dispatching…' : '🚚 Dispatch & notify client'}</button>
            </div>
        </div>
    );
};

export default DispatchModal;
