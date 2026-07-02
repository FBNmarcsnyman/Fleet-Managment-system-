

import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Vehicle, User } from '../../types';
import { useVehicles } from '../../contexts/AppContexts';

// Normalise a branch (code OR name OR "Loadmaster") to a token so scoping matches.
const branchToken = (s?: string): string => {
    const t = String(s || '').toUpperCase();
    if (t.includes('LOADMASTER') || t === 'LM') return 'LM';
    if (t.includes('DURBAN') || t.includes('DBN')) return 'DBN';
    if (t.includes('JOHANNES') || t.includes('JHB') || t.includes('JBG')) return 'JHB';
    if (t.includes('CAPE') || t.includes('CPT')) return 'CPT';
    return t;
};

interface CreateManifestModalProps {
    availableLoads: LoadConfirmation[];
    vehicles: Vehicle[];
    users: User[];
    selectedBranch: 'FBN JHB' | 'FBN DBN';
    onSubmit: (payload: { vehicleId: string, driverId: string, loadConIds: string[] }) => void;
    onCancel: () => void;
}

const CreateManifestModal: React.FC<CreateManifestModalProps> = ({ availableLoads, vehicles, users, selectedBranch, onSubmit, onCancel }) => {
    const { drivers = [] } = useVehicles() as any;
    const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>([]);
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');

    // Depot's line-haul HORSES first, then other depots' horses below. Drivers from the
    // fleet register, depot first. Picking a horse fills its driver (and vice-versa), editable.
    const tok = branchToken(selectedBranch);
    const depotLabel = selectedBranch.replace('FBN ', '');
    // Manifest = line-haul, so the LOADMASTER fleet is offered FIRST, then the creating
    // depot's horses, then other branches. (Marc's rule.)
    const grp = (b?: string): 'lm' | 'depot' | 'other' => { const t = branchToken(b); return t === 'LM' ? 'lm' : (!b || t === tok) ? 'depot' : 'other'; };
    const horses = useMemo(() => (vehicles as any[]).filter(v => v.weightCategory === 'Horse' && v.status === 'On the road'), [vehicles]);
    const lmHorses = useMemo(() => horses.filter(v => grp(v.branch) === 'lm'), [horses, tok]);
    const depotHorses = useMemo(() => horses.filter(v => grp(v.branch) === 'depot'), [horses, tok]);
    const otherHorses = useMemo(() => horses.filter(v => grp(v.branch) === 'other'), [horses, tok]);
    const fleetDrivers = useMemo(() => (drivers as any[]).filter(d => d.isActive !== false && d.name).sort((a, b) => String(a.name).localeCompare(String(b.name))), [drivers]);
    const lmDrivers = useMemo(() => fleetDrivers.filter(d => grp(d.branch) === 'lm'), [fleetDrivers, tok]);
    const depotDrivers = useMemo(() => fleetDrivers.filter(d => grp(d.branch) === 'depot'), [fleetDrivers, tok]);
    const otherDrivers = useMemo(() => fleetDrivers.filter(d => grp(d.branch) === 'other'), [fleetDrivers, tok]);
    // Subcontractor (external carrier) alternative to an own-fleet horse.
    const [useSubbie, setUseSubbie] = useState(false);
    const [carrier, setCarrier] = useState({ name: '', reg: '', driver: '', cell: '', email: '' });

    const onPickVehicle = (id: string) => {
        setVehicleId(id);
        const v = (vehicles as any[]).find(x => x.id === id); if (!v) return;
        const d = fleetDrivers.find(x => x.assignedVehicleId === v.id) || fleetDrivers.find(x => x.id === v.assignedDriverId);
        if (d && !driverId) setDriverId(d.id);
    };
    const onPickDriver = (id: string) => {
        setDriverId(id);
        const d = fleetDrivers.find(x => x.id === id); if (!d) return;
        if (d.assignedVehicleId && !vehicleId && horses.some(v => v.id === d.assignedVehicleId)) setVehicleId(d.assignedVehicleId);
    };

    const destinationBranch = useMemo(() => {
        return selectedBranch === 'FBN JHB' ? 'FBN DBN' : 'FBN JHB';
    }, [selectedBranch]);

    const loadsForDestination = availableLoads.filter(lc => lc.destinationBranch === destinationBranch);

    const handleToggleLoad = (id: string) => {
        setSelectedLoadIds(prev => 
            prev.includes(id) ? prev.filter(loadId => loadId !== id) : [...prev, id]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedLoadIds.length === 0) { alert('Select at least one load for the manifest.'); return; }
        if (useSubbie) {
            if (!carrier.name.trim()) { alert('Enter the subcontractor / carrier name.'); return; }
            onSubmit({ vehicleId: '', driverId: '', loadConIds: selectedLoadIds, carrierName: carrier.name, carrierVehicleReg: carrier.reg, carrierDriver: carrier.driver, carrierCell: carrier.cell, carrierEmail: carrier.email } as any);
            return;
        }
        if (!vehicleId || !driverId) { alert('Select a vehicle and a driver — or switch to a subcontractor.'); return; }
        onSubmit({ vehicleId, driverId, loadConIds: selectedLoadIds });
    };

    const getGoodsSummary = (lc: LoadConfirmation) => {
        if (!lc.items || lc.items.length === 0) return 'No goods description.';
        const firstItem = lc.items[0];
        let summary = `${firstItem.quantity}x ${firstItem.description}`;
        if (lc.items.length > 1) {
            summary += ` + ${lc.items.length - 1} more`;
        }
        return summary;
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Create Linehaul Manifest</h2>
            <p className="text-gray-400 mb-6">From <strong className="text-white">{selectedBranch}</strong> to <strong className="text-white">{destinationBranch}</strong></p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Select Cargo</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-900/50 p-2 rounded-lg">
                        {loadsForDestination.map(lc => (
                            <label key={lc.id} className="flex items-center space-x-3 p-2 bg-gray-700 rounded-md cursor-pointer">
                                <input type="checkbox" checked={selectedLoadIds.includes(lc.id)} onChange={() => handleToggleLoad(lc.id)} className="form-checkbox h-5 w-5 text-brand-primary" />
                                <span>{lc.loadConNumber} - <span className="text-gray-300 text-xs">{getGoodsSummary(lc)}</span></span>
                            </label>
                        ))}
                    </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={useSubbie} onChange={e => setUseSubbie(e.target.checked)} className="h-4 w-4 rounded" />
                    Use a <strong className="text-white">subcontractor</strong> (external carrier) instead of an own-fleet horse
                </label>
                {!useSubbie ? (
                    <>
                        <select value={vehicleId} onChange={e => onPickVehicle(e.target.value)} className={inputClasses}>
                            <option value="">-- Select Linehaul Truck (horse) --</option>
                            {lmHorses.length > 0 && <optgroup label="Loadmaster (line-haul)">{lmHorses.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}</optgroup>}
                            {depotHorses.length > 0 && <optgroup label={`${depotLabel} depot`}>{depotHorses.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}</optgroup>}
                            {otherHorses.length > 0 && <optgroup label="Other branches">{otherHorses.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}</optgroup>}
                        </select>
                        <select value={driverId} onChange={e => onPickDriver(e.target.value)} className={inputClasses}>
                            <option value="">-- Select Driver --</option>
                            {lmDrivers.length > 0 && <optgroup label="Loadmaster drivers">{lmDrivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.branch ? ` (${String(d.branch).replace('FBN ', '')})` : ''}</option>)}</optgroup>}
                            {depotDrivers.length > 0 && <optgroup label={`${depotLabel} drivers`}>{depotDrivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.branch ? ` (${String(d.branch).replace('FBN ', '')})` : ''}</option>)}</optgroup>}
                            {otherDrivers.length > 0 && <optgroup label="Other branches">{otherDrivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.branch ? ` (${String(d.branch).replace('FBN ', '')})` : ''}</option>)}</optgroup>}
                        </select>
                    </>
                ) : (
                    <div className="grid grid-cols-2 gap-3 bg-gray-900/40 p-3 rounded-lg border border-gray-700">
                        <input value={carrier.name} onChange={e => setCarrier(c => ({ ...c, name: e.target.value }))} placeholder="Carrier / subcontractor name *" className={inputClasses} />
                        <input value={carrier.reg} onChange={e => setCarrier(c => ({ ...c, reg: e.target.value }))} placeholder="Vehicle registration" className={inputClasses} />
                        <input value={carrier.driver} onChange={e => setCarrier(c => ({ ...c, driver: e.target.value }))} placeholder="Driver name" className={inputClasses} />
                        <input value={carrier.cell} onChange={e => setCarrier(c => ({ ...c, cell: e.target.value }))} placeholder="Driver cell" className={inputClasses} />
                        <input value={carrier.email} onChange={e => setCarrier(c => ({ ...c, email: e.target.value }))} placeholder="Carrier email" type="email" className={inputClasses + ' col-span-2'} style={{ textTransform: 'none' }} />
                    </div>
                )}
            </div>

            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Create & Dispatch</button>
            </div>
        </form>
    );
};

export default CreateManifestModal;