import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations, useVehicles } from '../../contexts/AppContexts';
import { invokeFn } from '../../lib/supabase';

// Printable / emailable line-haul manifest for a created manifest. Lists the
// loads on the trip with packages + weight + destination and the totals, plus a
// Receive-at-destination action.
const opsEmailFor = (b?: string) => b === 'FBN DBN' ? 'opsdbn@fbn-transport.co.za' : b === 'FBN JHB' ? 'opsjhb@fbn-transport.co.za' : 'ops@fbn-transport.co.za';
const kg = (n: number) => Math.round(n).toLocaleString('en-ZA');

const ManifestDoc: React.FC = () => {
    const { modal, hideModal, showToast } = useUIState();
    const { loadConfirmations = [], clients = [], suppliers = [], users = [], handleReceiveManifest } = useOperations() as any;
    const { vehicles = [] } = useVehicles() as any;
    const m = modal.payload?.manifest;
    const [busy, setBusy] = useState(false);
    if (!m) return null;

    const veh = (vehicles as any[]).find(v => v.id === m.vehicleId);
    const driver = (users as any[]).find((u: any) => u.id === m.driverId)?.name || '';
    const loads: LoadConfirmation[] = useMemo(() => (loadConfirmations as LoadConfirmation[]).filter(l => (m.loadConfirmationIds || []).includes(l.id)), [loadConfirmations, m]);
    const clientName = (lc: LoadConfirmation) => (clients as any[]).find(c => c.id === lc.clientId)?.name || lc.clientName || '—';
    const totals = loads.reduce((t, l) => ({ pkgs: t.pkgs + (Number(l.loadedPackages) || 0), kg: t.kg + (Number(l.weightKg) || 0) }), { pkgs: 0, kg: 0 });

    const buildHtml = () => {
        const rows = loads.map(l => `<tr>
            <td style="border:1px solid #cbd5e1;padding:5px 8px;font-family:monospace">${l.loadConNumber}</td>
            <td style="border:1px solid #cbd5e1;padding:5px 8px">${clientName(l)}</td>
            <td style="border:1px solid #cbd5e1;padding:5px 8px">${l.deliveryPoint || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right">${Number(l.loadedPackages) || ''}</td>
            <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right">${l.weightKg ? kg(Number(l.weightKg)) : ''}</td>
        </tr>`).join('');
        return `<div style="font-family:Arial,sans-serif;color:#13294b;max-width:800px">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f5a623;padding-bottom:8px;margin-bottom:14px">
              <div><div style="font-size:20px;font-weight:800">FBN TRANSPORT</div><div style="font-size:11px;color:#5b6573;letter-spacing:2px">LINE-HAUL MANIFEST</div></div>
              <div style="text-align:right"><div style="font-size:18px;font-weight:800">${m.manifestNumber}</div><div style="font-size:12px">${m.dispatchDate || ''}</div></div>
            </div>
            <table style="border-collapse:collapse;margin-bottom:12px;font-size:13px">
              <tr><td style="padding:2px 14px 2px 0;font-weight:700">Route</td><td>${m.originBranch || ''} &rarr; ${m.destinationBranch || ''}</td></tr>
              <tr><td style="padding:2px 14px 2px 0;font-weight:700">Vehicle</td><td>${veh ? `${veh.registration}${veh.name ? ` (${veh.name})` : ''}` : '—'}</td></tr>
              <tr><td style="padding:2px 14px 2px 0;font-weight:700">Driver</td><td>${driver || '—'}</td></tr>
            </table>
            <table style="border-collapse:collapse;width:100%;font-size:12px">
              <thead><tr style="background:#13294b;color:#fff">
                <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">LoadCon</th>
                <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">Client</th>
                <th style="border:1px solid #13294b;padding:6px 8px;text-align:left">Deliver to</th>
                <th style="border:1px solid #13294b;padding:6px 8px;text-align:right">Pkgs</th>
                <th style="border:1px solid #13294b;padding:6px 8px;text-align:right">Kg</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="font-weight:800;background:#f1f5f9">
                <td style="border:1px solid #cbd5e1;padding:6px 8px" colspan="3">TOTAL — ${loads.length} load${loads.length !== 1 ? 's' : ''}</td>
                <td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right">${totals.pkgs}</td>
                <td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right">${kg(totals.kg)}</td>
              </tr></tfoot>
            </table>
            <p style="font-size:11px;color:#5b6573;margin-top:16px">Received in good order at destination depot — Name __________________  Signature __________________  Date ________</p>
        </div>`;
    };

    const print = () => {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) { showToast('Allow pop-ups to print.'); return; }
        w.document.write(`<html><head><title>${m.manifestNumber}</title></head><body>${buildHtml()}<script>window.onload=()=>window.print()</script></body></html>`);
        w.document.close();
    };
    const email = async () => {
        setBusy(true);
        const to = opsEmailFor(m.destinationBranch);
        const r = await invokeFn('send-email', { body: { to, cc: [opsEmailFor(m.originBranch), 'ops@fbn-transport.co.za'], subject: `LINE-HAUL MANIFEST ${m.manifestNumber} — ${m.originBranch} to ${m.destinationBranch}`, html: buildHtml(), fromName: 'FBN Transport' } });
        setBusy(false);
        showToast(r.error ? `Email failed: ${r.error.message || r.error}` : `Manifest emailed to ${m.destinationBranch} ops.`);
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
