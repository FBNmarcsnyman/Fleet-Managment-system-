import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations, useVehicles } from '../../contexts/AppContexts';
import { invokeFn, directInvoke } from '../../lib/supabase';
import { tripSheetHtml, tripWaText, waNum, opsEmailFor } from '../../lib/linehaulDocs';

// Printable / sendable DELIVERY TRIP SHEET (run sheet). Shows the multi-drop
// list with columns for each client's signature on arrival + arrival/delivery
// times + odometer. Driver gets it on their cell (WhatsApp) or as a printed PDF;
// the depot can email a copy. HTML comes from the shared builder.
const TripSheetDoc: React.FC = () => {
    const { modal, showToast } = useUIState();
    const { loadConfirmations = [], clients = [], users = [] } = useOperations() as any;
    const { vehicles = [], drivers = [] } = useVehicles() as any;
    const t = modal.payload?.tripSheet;
    const [busy, setBusy] = useState<string | null>(null);
    if (!t) return null;

    const veh = (vehicles as any[]).find(v => v.id === t.vehicleId);
    // Driver from the drivers register first (uuid); fall back to login users for older trips.
    const driverRec = (drivers as any[]).find((d: any) => d.id === t.driverId);
    const driverUser = driverRec || (users as any[]).find((u: any) => u.id === t.driverId || u.email === t.driverId);
    const driver = driverUser?.name || '';
    const driverCell = driverUser?.cell || '';
    const vehicleLabel = veh ? `${veh.registration}${veh.name ? ` (${veh.name})` : ''}` : '';
    const loads: LoadConfirmation[] = useMemo(() => (loadConfirmations as LoadConfirmation[]).filter(l => (t.loadConfirmationIds || []).includes(l.id)), [loadConfirmations, t]);
    const clientName = (lc: LoadConfirmation) => (clients as any[]).find(c => c.id === lc.clientId)?.name || lc.clientName || '—';
    const html = () => tripSheetHtml({ trip: t, loads, vehicleLabel, driverName: driver, clientNameOf: clientName });

    const print = () => {
        const w = window.open('', '_blank', 'width=950,height=720');
        if (!w) { showToast('Allow pop-ups to print.'); return; }
        w.document.write(`<html><head><title>${t.tripSheetNumber}</title></head><body>${html()}<script>window.onload=()=>window.print()</script></body></html>`);
        w.document.close();
    };
    const emailDepot = async () => {
        setBusy('email');
        const r = await invokeFn('send-email', { body: { to: opsEmailFor(t.branch), cc: ['ops@fbn-transport.co.za'], subject: `DELIVERY TRIP SHEET ${t.tripSheetNumber} — ${t.branch} (${loads.length} drops)`, html: html(), fromName: 'FBN Transport' } });
        setBusy(null);
        showToast(r.error ? `Email failed: ${r.error.message || r.error}` : `Trip sheet emailed to ${t.branch} ops.`);
    };
    const sendDriver = async () => {
        const to = waNum(driverCell);
        if (!to) { showToast('No cell number on file for this driver — add it under Team, or print the sheet.'); return; }
        setBusy('wa');
        const r = await directInvoke('send-whatsapp', { to: `whatsapp:${to}`, body: tripWaText(t, loads, vehicleLabel, clientName), party: 'FBN' });
        setBusy(null);
        showToast(r.error ? `WhatsApp failed: ${r.error.message || r.error}` : `Trip sheet sent to ${driver} (${driverCell}).`);
    };

    return (
        <div className="text-slate-800">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">Trip sheet {t.tripSheetNumber}</h2>
                <div className="flex gap-2">
                    <button onClick={print} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Print PDF</button>
                    <button onClick={sendDriver} disabled={busy === 'wa'} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">Send to driver</button>
                    <button onClick={emailDepot} disabled={busy === 'email'} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">✉ Email depot</button>
                </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: html() }} />
        </div>
    );
};

export default TripSheetDoc;
