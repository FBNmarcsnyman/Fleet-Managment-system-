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
        onScrap(tire.id, reason, parseFloat(cost || '0'));
    };

    const inputClasses = 'w-full bg-white text-slate-800 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f5b700]';

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-black mb-4 text-[#13294b]">Scrap Tyre</h2>
            <p className="text-slate-500 mb-6">Tyre S/N: <strong className="font-mono">{tire.serialNumber}</strong></p>
            <div className="space-y-4">
                <input type="text" placeholder="Reason for scrapping" value={reason} onChange={e => setReason(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Cost to recover (R) — optional" value={cost} onChange={e => setCost(e.target.value)} step="0.01" className={inputClasses} />
            </div>
            <p className="text-xs text-slate-500 mt-2">The scrap reason is recorded against the tyre.</p>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Confirm scrap</button>
            </div>
        </form>
    );
};

export default ScrapTireModal;
