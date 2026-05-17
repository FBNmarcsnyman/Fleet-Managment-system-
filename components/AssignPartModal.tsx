import React, { useState, useMemo } from 'react';
import { Part, Vehicle, JobCard } from '../types';

interface AssignPartModalProps {
    part: Part;
    vehicles: Vehicle[];
    jobCards: JobCard[];
    onSubmit: (vehicleId: string, partId: string, quantity: number, jobCardId?: string) => void;
    onCancel: () => void;
}

const AssignPartModal: React.FC<AssignPartModalProps> = ({ part, vehicles, jobCards, onSubmit, onCancel }) => {
    const [vehicleId, setVehicleId] = useState('');
    const [jobCardId, setJobCardId] = useState('');
    const [quantity, setQuantity] = useState(1);
    
    const relevantJobCards = useMemo(() => {
        if (!vehicleId) return [];
        return jobCards.filter(jc => jc.vehicleId === vehicleId && jc.status !== 'Resolved');
    }, [vehicleId, jobCards]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId) {
            alert("Please select a vehicle.");
            return;
        }
        if (quantity > part.quantityInStock) {
            alert(`Not enough stock. Only ${part.quantityInStock} available.`);
            return;
        }
        onSubmit(vehicleId, part.id, quantity, jobCardId || undefined);
        onCancel();
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Assign Part</h2>
            <p className="text-gray-400 mb-6">Assigning: <strong className="text-white">{part.name}</strong> ({part.quantityInStock} in stock)</p>
            <div className="space-y-4">
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className={inputClasses}>
                    <option value="">-- Select Vehicle --</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>)}
                </select>
                <select value={jobCardId} onChange={e => setJobCardId(e.target.value)} disabled={!vehicleId} className={`${inputClasses} disabled:opacity-50`}>
                    <option value="">-- Link to Job Card (Optional) --</option>
                    {relevantJobCards.map(jc => <option key={jc.id} value={jc.id}>{jc.itemDescription}</option>)}
                </select>
                <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" max={part.quantityInStock} className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-blue-600 py-2 px-4 rounded-lg">Assign Part</button>
            </div>
        </form>
    );
};

export default AssignPartModal;
