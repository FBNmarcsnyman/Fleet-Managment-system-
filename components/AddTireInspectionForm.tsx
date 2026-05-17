import React, { useState } from 'react';
import { TireInspection } from '../types';

interface AddTireInspectionFormProps {
    tireId: string;
    onSubmit: (inspection: Omit<TireInspection, 'id' | 'tireId'>) => void;
    onCancel: () => void;
}

const AddTireInspectionForm: React.FC<AddTireInspectionFormProps> = ({ tireId, onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [vehicleOdometer, setVehicleOdometer] = useState('');
    const [treadDepth, setTreadDepth] = useState('');
    const [pressure, setPressure] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            date,
            vehicleOdometer: parseFloat(vehicleOdometer),
            treadDepth: parseFloat(treadDepth),
            pressure: parseFloat(pressure),
            notes: notes || undefined,
        });
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">New Tire Inspection</h2>
            <div className="space-y-4">
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClasses} />
                <input type="number" placeholder="Vehicle Odometer" value={vehicleOdometer} onChange={e => setVehicleOdometer(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Tread Depth (mm)" value={treadDepth} onChange={e => setTreadDepth(e.target.value)} required step="0.1" className={inputClasses} />
                <input type="number" placeholder="Pressure (PSI)" value={pressure} onChange={e => setPressure(e.target.value)} required className={inputClasses} />
                <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Log Inspection</button>
            </div>
        </form>
    );
};

export default AddTireInspectionForm;
