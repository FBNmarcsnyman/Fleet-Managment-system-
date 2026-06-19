import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations, useVehicles } from '../../contexts/AppContexts';

// Assign a load to FBN's OWN fleet (driver + vehicle + ETA) — not a subcontractor.
// It then follows the normal status + email/WhatsApp flow (no subbie LoadCon).
const AssignFbnModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { handleUpdateLoadConfirmation } = useOperations() as any;
    const { vehicles = [], users = [] } = useVehicles() as any;
    const lc: LoadConfirmation = modal.payload?.loadCon;

    const [driver, setDriver] = useState(lc?.subcontractorDriverName || '');
    const [reg, setReg] = useState(lc?.subcontractorVehicleReg || '');
    const [cell, setCell] = useState(lc?.subcontractorDriverCell || '');
    const [eta, setEta] = useState(lc?.loadingEta || '');
    const [busy, setBusy] = useState(false);

    const drivers = useMemo(() => (users as any[]).filter(u => u.role === 'Driver' || u.role === 'Staff').map(u => u.name).filter(Boolean), [users]);
    const regs = useMemo(() => (vehicles as any[]).map(v => v.registration).filter(Boolean), [vehicles]);

    if (!lc) return null;

    const save = async () => {
        if (!driver && !reg) { showToast('Add at least a driver or a vehicle.'); return; }
        setBusy(true);
        const vehicleId = (vehicles as any[]).find(v => (v.registration || '').toUpperCase() === reg.toUpperCase())?.id;
        const res = await handleUpdateLoadConfirmation(lc.id, {
            subcontractorName: 'FBN TRANSPORT',
            subcontractorDriverName: driver ? driver.toUpperCase() : undefined,
            subcontractorVehicleReg: reg ? reg.toUpperCase() : undefined,
            subcontractorDriverCell: cell || undefined,
            loadingEta: eta || undefined,
            vehicleId: vehicleId || undefined,
            status: lc.status === 'Booked' ? 'Driver Assigned' : lc.status,
        } as any);
        setBusy(false);
        if (res && res.ok === false) { showToast(`Could not assign: ${res.error}`); return; }
        hideModal();
        showToast(`${lc.loadConNumber} assigned to FBN fleet${cell ? ' — driver notified' : ''}.`);
    };

    const inp = 'w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 text-base focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <h2 className="text-xl font-black text-white mb-1">Assign to FBN fleet — {lc.loadConNumber}</h2>
            <p className="text-xs text-gray-400 mb-4">Own driver &amp; vehicle. Follows the normal status + client-update flow (no subcontractor LoadCon).</p>
            <div className="space-y-3.5">
                <div><label className={lbl}>Driver</label><input list="fbnDrivers" value={driver} onChange={e => setDriver(e.target.value)} className={inp} placeholder="driver name" /><datalist id="fbnDrivers">{drivers.map(d => <option key={d} value={d} />)}</datalist></div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Vehicle reg</label><input list="fbnRegs" value={reg} onChange={e => setReg(e.target.value)} className={inp} placeholder="e.g. ND 123 456" /><datalist id="fbnRegs">{regs.map(r => <option key={r} value={r} />)}</datalist></div>
                    <div><label className={lbl}>Driver cell (WhatsApp)</label><input value={cell} onChange={e => setCell(e.target.value)} className={inp} placeholder="0__ ___ ____" /></div>
                </div>
                <div><label className={lbl}>Collection ETA</label><input type="datetime-local" value={eta} onChange={e => setEta(e.target.value)} className={inp} /></div>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={busy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : 'Assign to FBN'}</button>
            </div>
        </div>
    );
};

export default AssignFbnModal;
