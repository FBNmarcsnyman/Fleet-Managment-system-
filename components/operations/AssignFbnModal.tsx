import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Driver } from '../../types';
import { useUIState, useOperations, useVehicles } from '../../contexts/AppContexts';
import DateField from './DateField';

// Assign a load to FBN's OWN fleet. Driver + vehicle are pick-lists scoped to the
// collecting branch + the line-haul (LOADMASTER) fleet. Picking a driver pulls
// their cell and their assigned truck; picking a truck pulls its driver. The
// collection date is pre-filled from the load — you just set the ETA time.
// Branch comes in several spellings — the load carries the CODE ("FBN JHB")
// while drivers/vehicles carry the NAME ("FBN Johannesburg") or "Loadmaster".
// Normalise everything to a token so the scoping actually matches.
const branchToken = (s?: string): string => {
    const t = String(s || '').toUpperCase();
    if (t.includes('LOADMASTER') || t === 'LM') return 'LM';
    if (t.includes('DURBAN') || t.includes('DBN')) return 'DBN';
    if (t.includes('JOHANNES') || t.includes('JHB') || t.includes('JBG')) return 'JHB';
    if (t.includes('CAPE') || t.includes('CPT')) return 'CPT';
    return t;
};

const AssignFbnModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { handleUpdateLoadConfirmation } = useOperations() as any;
    const { vehicles = [], drivers = [] } = useVehicles() as any;
    const lc: LoadConfirmation = modal.payload?.loadCon;
    const collBranch = lc?.collectionBranch;
    const collTok = branchToken(collBranch);
    const [allBranches, setAllBranches] = useState(false); // show every branch's fleet (e.g. a DBN truck sitting in JHB)
    // Branch-scoped if we recognise the collecting branch; LM (line-haul) is
    // always offered. If we don't recognise it, fall back to the whole fleet so
    // the list is never empty.
    const inScope = (b?: string) => {
        if (!collTok) return true;
        const t = branchToken(b);
        return !b || t === collTok || t === 'LM';
    };

    const sizeOf = (v: any) => {
        if (typeof v.payloadKg === 'number' && v.payloadKg > 0) return v.payloadKg;
        const n = parseFloat(String(v.weightCategory || '').replace(/[^0-9.]/g, ''));
        return isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
    };
    const fleetVehicles = useMemo(() => {
        const all = (vehicles as any[]).filter(v => v.registration && v.status !== 'Sold');
        const scoped = allBranches ? all : all.filter(v => inScope(v.branch));
        return (scoped.length ? scoped : all).sort((a, b) => sizeOf(a) - sizeOf(b));
    }, [vehicles, collTok, allBranches]);
    const fleetDrivers = useMemo(() => {
        const all = (drivers as Driver[]).filter(d => d.isActive !== false && d.name);
        const scoped = allBranches ? all : all.filter(d => inScope(d.branch));
        return (scoped.length ? scoped : all).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }, [drivers, collTok, allBranches]);

    const initDriver = useMemo(() => fleetDrivers.find(d => (d.name || '').toUpperCase() === (lc?.subcontractorDriverName || '').toUpperCase()), [fleetDrivers, lc]);
    const [driverId, setDriverId] = useState(initDriver?.id || '');
    const [driverName, setDriverName] = useState(lc?.subcontractorDriverName || '');
    const [reg, setReg] = useState(lc?.subcontractorVehicleReg || '');
    const [cell, setCell] = useState(lc?.subcontractorDriverCell || '');
    const [collDate, setCollDate] = useState(lc?.collectionDate || '');
    const [etaTime, setEtaTime] = useState(lc?.loadingEta && lc.loadingEta.includes('T') ? lc.loadingEta.split('T')[1]?.slice(0, 5) : '');
    const [busy, setBusy] = useState(false);

    if (!lc) return null;

    const onPickDriver = (id: string) => {
        setDriverId(id);
        const d = fleetDrivers.find(x => x.id === id);
        if (!d) { setDriverName(''); return; }
        setDriverName(d.name);
        if (d.cell) setCell(d.cell);
        if (d.assignedVehicleId) { const v = (vehicles as any[]).find(x => x.id === d.assignedVehicleId); if (v?.registration) setReg(v.registration); }
    };
    const onPickVehicle = (r: string) => {
        setReg(r);
        const v = (vehicles as any[]).find(x => (x.registration || '') === r);
        if (!v) return;
        // Pull the truck's usual driver if none chosen yet.
        const d = fleetDrivers.find(x => x.assignedVehicleId === v.id) || fleetDrivers.find(x => x.id === v.assignedDriverId);
        if (d && !driverId) { setDriverId(d.id); setDriverName(d.name); if (d.cell) setCell(d.cell); }
    };

    const save = async () => {
        if (!driverName && !reg) { showToast('Choose a driver or a vehicle.'); return; }
        // ETA is required so the collection is trackable and the 30-min on-track
        // check can fire — a driver should never be assigned without a time.
        if (!collDate) { showToast('Set the collection date.'); return; }
        if (!etaTime) { showToast('Set the collection ETA time before assigning.'); return; }
        setBusy(true);
        const vehicleId = (vehicles as any[]).find(v => (v.registration || '').toUpperCase() === reg.toUpperCase())?.id;
        const eta = collDate && etaTime ? `${collDate}T${etaTime}` : (lc.loadingEta || undefined);
        const res = await handleUpdateLoadConfirmation(lc.id, {
            subcontractorName: 'FBN TRANSPORT',
            subcontractorDriverName: driverName ? driverName.toUpperCase() : undefined,
            subcontractorVehicleReg: reg ? reg.toUpperCase() : undefined,
            subcontractorDriverCell: cell || undefined,
            collectionDate: collDate || lc.collectionDate,
            loadingEta: eta,
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
    const branchLabel = collBranch ? `${String(collBranch).replace('FBN ', '')} + LM` : 'all';

    return (
        <div>
            <h2 className="text-xl font-black text-white mb-1">Assign to FBN fleet — {lc.loadConNumber}</h2>
            <p className="text-xs text-gray-400 mb-3">Own driver &amp; vehicle ({branchLabel}). Pick a driver and their truck + cell fill in automatically.</p>
            <label className="flex items-center gap-2 mb-3 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={allBranches} onChange={e => setAllBranches(e.target.checked)} className="h-4 w-4 rounded" />
                Show all branches' vehicles &amp; drivers (e.g. a {collBranch ? String(collBranch).replace('FBN ', '') : 'DBN'} truck sitting in another depot)
            </label>
            <div className="space-y-3.5">
                <div>
                    <label className={lbl}>Driver</label>
                    <select value={driverId} onChange={e => onPickDriver(e.target.value)} className={inp}>
                        <option value="">— Select driver —</option>
                        {fleetDrivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.branch ? ` (${String(d.branch).replace('FBN ', '')})` : ''}</option>)}
                    </select>
                    {!fleetDrivers.length && <p className="text-[11px] text-amber-300 mt-1">No drivers on file for this branch — add them under Fleet › Drivers.</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>Vehicle</label>
                        <select value={reg} onChange={e => onPickVehicle(e.target.value)} className={inp}>
                            <option value="">— Select vehicle —</option>
                            {fleetVehicles.map(v => <option key={v.id} value={v.registration}>{v.registration}{v.name ? ` · ${v.name}` : ''}</option>)}
                        </select>
                    </div>
                    <div><label className={lbl}>Driver cell (WhatsApp)</label><input value={cell} onChange={e => setCell(e.target.value)} className={inp} placeholder="0__ ___ ____" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Collection date</label><DateField value={collDate} onChange={setCollDate} className={inp} /></div>
                    <div><label className={lbl}>ETA time <span className="text-rose-400">*required</span></label><input type="time" value={etaTime} onChange={e => setEtaTime(e.target.value)} className={`${inp} ${!etaTime ? 'ring-2 ring-rose-500/60' : ''}`} /></div>
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={busy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : 'Assign to FBN'}</button>
            </div>
        </div>
    );
};

export default AssignFbnModal;
