import React, { useState } from 'react';
import { Tire } from '../types';

interface DismountTireModalProps {
    tire: Tire;
    onDismount: (tireId: string, odometer: number) => void;
    onCancel: () => void;
}

const DismountTireModal: React.FC<DismountTireModalProps> = ({ tire, onDismount, onCancel }) => {
    const [odometer, setOdometer] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onDismount(tire.id, parseFloat(odometer));
    };

    const inputClasses = 'w-full bg-white text-slate-800 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f5b700]';

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-black mb-4 text-[#13294b]">Dismount Tyre</h2>
            <p className="text-slate-500 mb-6">Tyre S/N: <strong className="font-mono">{tire.serialNumber}</strong></p>
            <div className="space-y-4">
                <input type="number" placeholder="Current vehicle odometer" value={odometer} onChange={e => setOdometer(e.target.value)} required className={inputClasses} />
            </div>
            <p className="text-xs text-slate-500 mt-2">This returns the tyre to 'In Storage' status.</p>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg">Dismount</button>
            </div>
        </form>
    );
};

export default DismountTireModal;
