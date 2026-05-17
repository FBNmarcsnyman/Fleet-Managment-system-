import React, { useState, useMemo } from 'react';
import { Tire, Vehicle } from '../types';

interface MountTireModalProps {
    tire: Tire;
    vehicles: Vehicle[];
    onMount: (tireId: string, vehicleId: string, position: string, odometer: number) => void;
    onCancel: () => void;
}

const MountTireModal: React.FC<MountTireModalProps> = ({ tire, vehicles, onMount, onCancel }) => {
    const [vehicleId, setVehicleId] = useState('');
    const [position, setPosition] = useState('');
    const [odometer, setOdometer] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId || !position || !odometer) {
            alert('Please fill all fields.');
            return;
        }
        onMount(tire.id, vehicleId, position, parseFloat(odometer));
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Mount Tire</h2>
            <p className="text-gray-400 mb-6">Tire S/N: <strong className="font-mono">{tire.serialNumber}</strong></p>
            <div className="space-y-4">
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className={inputClasses}>
                    <option value="" disabled>-- Select Vehicle --</option>
                    {vehicles.filter(v => v.status === 'On the road').map(v => <option key={v.id} value={v.id}>{v.registration}</option>)}
                </select>
                <input type="text" placeholder="Position (e.g., LHF, RRI)" value={position} onChange={e => setPosition(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Current Vehicle Odometer" value={odometer} onChange={e => setOdometer(e.target.value)} required className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Mount Tire</button>
            </div>
        </form>
    );
};

export default MountTireModal;
