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

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Dismount Tire</h2>
            <p className="text-gray-400 mb-6">Tire S/N: <strong className="font-mono">{tire.serialNumber}</strong></p>
            <div className="space-y-4">
                <input type="number" placeholder="Current Vehicle Odometer" value={odometer} onChange={e => setOdometer(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-md" />
            </div>
            <p className="text-xs text-gray-400 mt-2">This will return the tire to 'In Storage' status.</p>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-yellow-600 py-2 px-4 rounded-lg">Dismount</button>
            </div>
        </form>
    );
};

export default DismountTireModal;
