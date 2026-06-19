import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import DateField from './DateField';

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
        hideModal();
        showToast(`${lc.loadConNumber} dispatched to ${area} — client notified of planned delivery.`);
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
