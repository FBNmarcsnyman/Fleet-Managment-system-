

import React, { useState } from 'react';
import { LoadConfirmation, Vehicle, User } from '../../types';

interface CreateTripSheetModalProps {
    availableLoads: LoadConfirmation[];
    vehicles: Vehicle[];
    users: User[];
    selectedBranch: 'FBN JHB' | 'FBN DBN';
    onSubmit: (payload: { vehicleId: string, driverId: string, loadConIds: string[], branch: 'FBN JHB' | 'FBN DBN' }) => void;
    onCancel: () => void;
}

const CreateTripSheetModal: React.FC<CreateTripSheetModalProps> = ({ availableLoads, vehicles, users, selectedBranch, onSubmit, onCancel }) => {
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

    const localVehicles = vehicles.filter(v => ['BAKKIE', '1 TONNER', '2 TONNER', '5 TONNER', '8 TONNER', '12 TONNER', '15 TONNER'].includes(v.weightCategory));
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
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className={inputClasses}>
                    <option value="" disabled>-- Select Local Vehicle --</option>
                    {localVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}
                </select>
                <select value={driverId} onChange={e => setDriverId(e.target.value)} required className={inputClasses}>
                    <option value="" disabled>-- Select Driver --</option>
                    {users.filter(u => u.role === 'Staff').map(d => <option key={d.email} value={d.email}>{d.name}</option>)}
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