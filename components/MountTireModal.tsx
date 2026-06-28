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
    
    const inputClasses = "w-full bg-white text-slate-800 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f5b700]";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-black mb-4 text-[#13294b]">Mount Tyre</h2>
            <p className="text-slate-500 mb-6">Tyre S/N: <strong className="font-mono">{tire.serialNumber}</strong></p>
            <div className="space-y-4">
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className={inputClasses}>
                    <option value="" disabled>-- Select Vehicle --</option>
                    {vehicles.filter(v => v.status === 'On the road').map(v => <option key={v.id} value={v.id}>{v.registration}</option>)}
                </select>
                <input type="text" placeholder="Position (e.g., LHF, RRI)" value={position} onChange={e => setPosition(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Current Vehicle Odometer" value={odometer} onChange={e => setOdometer(e.target.value)} required className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg">Mount Tyre</button>
            </div>
        </form>
    );
};

export default MountTireModal;
