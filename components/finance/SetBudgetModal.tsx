import React, { useState } from 'react';
import { Budget, Vehicle } from '../../types';

interface SetBudgetModalProps {
    vehicles: Vehicle[];
    onSubmit: (budget: Omit<Budget, 'id'>) => void;
    onCancel: () => void;
}

const SetBudgetModal: React.FC<SetBudgetModalProps> = ({ vehicles, onSubmit, onCancel }) => {
    const [targetId, setTargetId] = useState('');
    const [amount, setAmount] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetId || !amount) {
            alert('Please select a vehicle and enter an amount.');
            return;
        }
        onSubmit({
            targetId,
            amount: parseFloat(amount),
            startDate,
            period: 'monthly',
        });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Set Monthly Budget</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle</label>
                    <select value={targetId} onChange={e => setTargetId(e.target.value)} required className={inputClasses}>
                        <option value="">-- Select Vehicle --</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Month</label>
                    <input type="month" value={startDate} onChange={e => setStartDate(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Budget Amount (R)</label>
                    <input type="number" placeholder="e.g. 35000" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" className={inputClasses} />
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Set Budget</button>
            </div>
        </form>
    );
};

export default SetBudgetModal;