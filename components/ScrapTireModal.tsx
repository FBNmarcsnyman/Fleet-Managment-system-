import React, { useState } from 'react';
import { Tire } from '../types';

interface ScrapTireModalProps {
    tire: Tire;
    onScrap: (tireId: string, reason: string, costToRecover: number) => void;
    onCancel: () => void;
}

const ScrapTireModal: React.FC<ScrapTireModalProps> = ({ tire, onScrap, onCancel }) => {
    const [reason, setReason] = useState('');
    const [cost, setCost] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onScrap(tire.id, reason, parseFloat(cost));
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Scrap Tire</h2>
            <p className="text-gray-400 mb-6">Tire S/N: <strong className="font-mono">{tire.serialNumber}</strong></p>
            <div className="space-y-4">
                <input type="text" placeholder="Reason for Scrapping" value={reason} onChange={e => setReason(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-md" />
                <input type="number" placeholder="Cost to Recover (R)" value={cost} onChange={e => setCost(e.target.value)} required step="0.01" className="w-full bg-gray-700 p-3 rounded-md" />
            </div>
            <p className="text-xs text-yellow-400 mt-2">Note: This will create a case for HR to review for driver accountability.</p>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-red-600 py-2 px-4 rounded-lg">Confirm Scrap</button>
            </div>
        </form>
    );
};

export default ScrapTireModal;
