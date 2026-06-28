import React, { useState } from 'react';
import { TireInspection } from '../types';
import DateField from './operations/DateField';

interface AddTireInspectionFormProps {
    tireId: string;
    onSubmit: (inspection: Omit<TireInspection, 'id' | 'tireId'>) => void;
    onCancel: () => void;
}

const AddTireInspectionForm: React.FC<AddTireInspectionFormProps> = ({ onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [vehicleOdometer, setVehicleOdometer] = useState('');
    const [treadDepth, setTreadDepth] = useState('');
    const [pressure, setPressure] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ date, vehicleOdometer: parseFloat(vehicleOdometer), treadDepth: parseFloat(treadDepth), pressure: parseFloat(pressure), notes: notes || undefined });
    };

    const inputClasses = 'w-full bg-white text-slate-800 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f5b700]';

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-black mb-6 text-[#13294b]">New Tyre Inspection</h2>
            <div className="space-y-4">
                <DateField value={date} onChange={setDate} className={inputClasses} />
                <input type="number" placeholder="Vehicle odometer" value={vehicleOdometer} onChange={e => setVehicleOdometer(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Tread depth (mm)" value={treadDepth} onChange={e => setTreadDepth(e.target.value)} required step="0.1" className={inputClasses} />
                <input type="number" placeholder="Pressure (PSI)" value={pressure} onChange={e => setPressure(e.target.value)} required className={inputClasses} />
                <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClasses} style={{ textTransform: 'none' }} />
            </div>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-4 rounded-lg">Log inspection</button>
            </div>
        </form>
    );
};

export default AddTireInspectionForm;
