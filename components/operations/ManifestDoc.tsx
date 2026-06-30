import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations, useVehicles } from '../../contexts/AppContexts';
import { invokeFn } from '../../lib/supabase';
import { manifestHtml, opsEmailFor } from '../../lib/linehaulDocs';

// Printable / emailable line-haul manifest. HTML comes from the shared builder
// (lib/linehaulDocs) so the on-screen doc and the auto-send email are identical
// — packages + weight + cubes + totals + trailer size.

const ManifestDoc: React.FC = () => {
    const { modal, hideModal, showToast } = useUIState();
    const { loadConfirmations = [], clients = [], suppliers = [], users = [], handleReceiveManifest } = useOperations() as any;
    const { vehicles = [], drivers = [] } = useVehicles() as any;
    const m = modal.payload?.manifest;
    const [busy, setBusy] = useState(false);
    if (!m) return null;

    const veh = (vehicles as any[]).find(v => v.id === m.vehicleId);
    // Driver now lives in the drivers register (uuid id); fall back to login users
    // for older manifests that stored a user id/email.
    const driver = (drivers as any[]).find((d: any) => d.id === m.driverId)?.name
        || (users as any[]).find((u: any) => u.id === m.driverId || u.email === m.driverId)?.name
        || '';
    const loads: LoadConfirmation[] = useMemo(() => (loadConfirmations as LoadConfirmation[]).filter(l => (m.loadConfirmationIds || []).includes(l.id)), [loadConfirmations, m]);
    const clientName = (lc: LoadConfirmation) => (clients as any[]).find(c => c.id === lc.clientId)?.name || lc.clientName || '—';
    // Brokered line-haul leg → show the carrier's truck/driver instead of own fleet.
    const vehicleLabel = m.carrierName
        ? `${m.carrierName}${m.carrierVehicleReg ? ` · ${m.carrierVehicleReg}` : ''} (broker)`
        : (veh ? `${veh.registration}${veh.name ? ` (${veh.name})` : ''}` : '');
    const driverName = m.carrierName ? (m.carrierDriver || '') : driver;
    const buildHtml = () => manifestHtml({ manifest: m, loads, vehicleLabel, driverName, clientNameOf: clientName });

    const print = () => {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) { showToast('Allow pop-ups to print.'); return; }
        w.document.write(`<html><head><title>${m.manifestNumber}</title></head><body>${buildHtml()}<script>window.onload=()=>window.print()</script></body></html>`);
        w.document.close();
    };
    const email = async () => {
        setBusy(true);
        // Always to the receiving depot ops; if a broker runs it, send it to them too.
        const to = m.carrierEmail ? m.carrierEmail : opsEmailFor(m.destinationBranch);
        const cc = [opsEmailFor(m.destinationBranch), opsEmailFor(m.originBranch), 'ops@fbn-transport.co.za'].filter((e, i, a) => e && a.indexOf(e) === i && e !== to);
        const r = await invokeFn('send-email', { body: { to, cc, subject: `LINE-HAUL MANIFEST ${m.manifestNumber} — ${m.originBranch} to ${m.destinationBranch}`, html: buildHtml(), fromName: 'FBN Transport' } });
        setBusy(false);
        showToast(r.error ? `Email failed: ${r.error.message || r.error}` : `Manifest emailed${m.carrierEmail ? ' to the carrier + ' : ' to '}${m.destinationBranch} ops.`);
    };
    const receive = async () => {
        if (!confirm(`Mark manifest ${m.manifestNumber} received at ${m.destinationBranch}? All its loads move to "At destination depot".`)) return;
        setBusy(true);
        const r = await handleReceiveManifest(m.id);
        setBusy(false);
        if (r?.ok === false) { showToast(`Could not receive: ${r.error}`); return; }
        showToast(`Manifest received — ${loads.length} loads at ${m.destinationBranch}.`);
        hideModal();
    };

    return (
        <div className="text-slate-800">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">Manifest {m.manifestNumber}</h2>
                <div className="flex gap-2">
                    <button onClick={print} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg text-sm">🖨 Print</button>
                    <button onClick={email} disabled={busy} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50">✉ Email depot</button>
                    {m.status !== 'Arrived' && <button onClick={receive} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-4 rounded-lg text-sm disabled:opacity-50">✓ Receive</button>}
                </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: buildHtml() }} />
        </div>
    );
};

export default ManifestDoc;
