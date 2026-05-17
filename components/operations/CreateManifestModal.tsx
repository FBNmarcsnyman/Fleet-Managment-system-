

import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Vehicle, User } from '../../types';

interface CreateManifestModalProps {
    availableLoads: LoadConfirmation[];
    vehicles: Vehicle[];
    users: User[];
    selectedBranch: 'FBN JHB' | 'FBN DBN';
    onSubmit: (payload: { vehicleId: string, driverId: string, loadConIds: string[] }) => void;
    onCancel: () => void;
}

const CreateManifestModal: React.FC<CreateManifestModalProps> = ({ availableLoads, vehicles, users, selectedBranch, onSubmit, onCancel }) => {
    const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>([]);
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');

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
        if (selectedLoadIds.length === 0 || !vehicleId || !driverId) {
            alert('Please select at least one load, a vehicle, and a driver.');
            return;
        }
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
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className={inputClasses}>
                    <option value="" disabled>-- Select Linehaul Truck --</option>
                    {vehicles.filter(v => v.weightCategory === 'Horse').map(v => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}
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

export default CreateManifestModal;