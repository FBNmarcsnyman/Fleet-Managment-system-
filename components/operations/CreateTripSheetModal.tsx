

import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Vehicle, User } from '../../types';
import { useVehicles } from '../../contexts/AppContexts';

const branchToken = (s?: string): string => {
    const t = String(s || '').toUpperCase();
    if (t.includes('LOADMASTER') || t === 'LM') return 'LM';
    if (t.includes('DURBAN') || t.includes('DBN')) return 'DBN';
    if (t.includes('JOHANNES') || t.includes('JHB') || t.includes('JBG')) return 'JHB';
    if (t.includes('CAPE') || t.includes('CPT')) return 'CPT';
    return t;
};

interface CreateTripSheetModalProps {
    availableLoads: LoadConfirmation[];
    vehicles: Vehicle[];
    users: User[];
    selectedBranch: 'FBN JHB' | 'FBN DBN';
    onSubmit: (payload: { vehicleId: string, driverId: string, loadConIds: string[], branch: 'FBN JHB' | 'FBN DBN' }) => void;
    onCancel: () => void;
}

const CreateTripSheetModal: React.FC<CreateTripSheetModalProps> = ({ availableLoads, vehicles, users, selectedBranch, onSubmit, onCancel }) => {
    const { drivers = [] } = useVehicles() as any;
    const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>([]);
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');

    const handleToggleLoad = (id: string) => {
        setSelectedLoadIds(prev => 
            prev.includes(id) ? prev.filter(loadId => loadId !== id) : [...prev, id]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedLoadIds.length === 0 || !vehicleId || !driverId) {
            alert('Please select at least one load, a vehicle, and a driver.');
            return;
        }
        onSubmit({ vehicleId, driverId, loadConIds: selectedLoadIds, branch: selectedBranch });
    };

    // Local DELIVERY vehicles (smallest first). This depot's vehicles are offered first,
    // then the rest of the fleet below. Drivers from the fleet register, depot first.
    // Picking a vehicle fills its driver (and vice-versa), editable.
    const SIZE_ORDER = ['BAKKIE', '1 TONNER', '2 TONNER', '5 TONNER', '8 TONNER', '12 TONNER', '15 TONNER'];
    const sizeOf = (v: any) => {
        if (typeof v.payloadKg === 'number' && v.payloadKg > 0) return v.payloadKg;
        const i = SIZE_ORDER.indexOf(v.weightCategory);
        return i >= 0 ? i : Number.MAX_SAFE_INTEGER;
    };
    const tok = branchToken(selectedBranch);
    const depotLabel = selectedBranch.replace('FBN ', '');
    const localAll = useMemo(() => (vehicles as any[]).filter(v => v.status === 'On the road' && SIZE_ORDER.includes(v.weightCategory)).sort((a, b) => sizeOf(a) - sizeOf(b)), [vehicles]);
    const depotVehicles = useMemo(() => localAll.filter(v => branchToken((v as any).branch) === tok), [localAll, tok]);
    const otherVehicles = useMemo(() => localAll.filter(v => branchToken((v as any).branch) !== tok), [localAll, tok]);
    const fleetDrivers = useMemo(() => (drivers as any[]).filter(d => d.isActive !== false && d.name).sort((a, b) => String(a.name).localeCompare(String(b.name))), [drivers]);
    const depotDrivers = useMemo(() => fleetDrivers.filter(d => { const t = branchToken(d.branch); return !d.branch || t === tok || t === 'LM'; }), [fleetDrivers, tok]);
    const otherDrivers = useMemo(() => fleetDrivers.filter(d => { const t = branchToken(d.branch); return d.branch && t !== tok && t !== 'LM'; }), [fleetDrivers, tok]);
    const onPickVehicle = (id: string) => {
        setVehicleId(id);
        const v = (vehicles as any[]).find(x => x.id === id); if (!v) return;
        const d = fleetDrivers.find(x => x.assignedVehicleId === v.id) || fleetDrivers.find(x => x.id === v.assignedDriverId);
        if (d && !driverId) setDriverId(d.id);
    };
    const onPickDriver = (id: string) => {
        setDriverId(id);
        const d = fleetDrivers.find(x => x.id === id); if (!d) return;
        if (d.assignedVehicleId && !vehicleId && localAll.some(v => v.id === d.assignedVehicleId)) setVehicleId(d.assignedVehicleId);
    };
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    const getGoodsSummary = (lc: LoadConfirmation) => {
        if (!lc.items || lc.items.length === 0) return 'No goods description.';
        const firstItem = lc.items[0];
        let summary = `${firstItem.quantity}x ${firstItem.description}`;
        if (lc.items.length > 1) {
            summary += ` + ${lc.items.length - 1} more`;
        }
        return summary;
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Create Local Trip Sheet</h2>
            <p className="text-gray-400 mb-6">For deliveries in <strong className="text-white">{selectedBranch}</strong></p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Select Deliveries</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-900/50 p-2 rounded-lg">
                        {availableLoads.map(lc => (
                            <label key={lc.id} className="flex items-center space-x-3 p-2 bg-gray-700 rounded-md cursor-pointer">
                                <input type="checkbox" checked={selectedLoadIds.includes(lc.id)} onChange={() => handleToggleLoad(lc.id)} className="form-checkbox h-5 w-5 text-brand-primary" />
                                <span className="text-sm">{lc.loadConNumber} - {lc.deliveryPoint} <span className="text-gray-400 text-xs">({getGoodsSummary(lc)})</span></span>
                            </label>
                        ))}
                    </div>
                </div>
                <select value={vehicleId} onChange={e => onPickVehicle(e.target.value)} required className={inputClasses}>
                    <option value="">-- Select Local Vehicle --</option>
                    {depotVehicles.length > 0 && <optgroup label={`${depotLabel} depot`}>{depotVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}</optgroup>}
                    {otherVehicles.length > 0 && <optgroup label="Other branches">{otherVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}</optgroup>}
                </select>
                <select value={driverId} onChange={e => onPickDriver(e.target.value)} required className={inputClasses}>
                    <option value="">-- Select Driver --</option>
                    {depotDrivers.length > 0 && <optgroup label={`${depotLabel} drivers`}>{depotDrivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.branch ? ` (${String(d.branch).replace('FBN ', '')})` : ''}</option>)}</optgroup>}
                    {otherDrivers.length > 0 && <optgroup label="Other branches">{otherDrivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.branch ? ` (${String(d.branch).replace('FBN ', '')})` : ''}</option>)}</optgroup>}
                </select>
            </div>

            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Create & Dispatch</button>
            </div>
        </form>
    );
};

export default CreateTripSheetModal;