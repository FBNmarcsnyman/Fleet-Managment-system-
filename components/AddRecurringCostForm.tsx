import React, { useState } from 'react';
import { RecurringCost } from '../types';
import { DEFAULT_COST_CATEGORIES } from '../constants';
import DateField from './operations/DateField';

interface AddRecurringCostFormProps {
    onSubmit: (cost: Omit<RecurringCost, 'id' | 'vehicleId'>) => void;
    onCancel: () => void;
}

const AddRecurringCostForm: React.FC<AddRecurringCostFormProps> = ({ onSubmit, onCancel }) => {
    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [frequency, setFrequency] = useState<'monthly' | 'annually'>('monthly');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalCategory = category === 'Other' ? customCategory : category;
        if (!finalCategory || !amount || !startDate) {
            alert('Please fill all fields');
            return;
        }
        onSubmit({
            category: finalCategory,
            amount: parseFloat(amount),
            frequency,
            startDate,
            endDate: null,
        });
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Recurring Cost</h2>
            <div className="space-y-4">
                <select value={category} onChange={e => setCategory(e.target.value)} className={inputClasses}>
                    <option value="">-- Select Category --</option>
                    {DEFAULT_COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Other">Other (Specify)</option>
                </select>
                {category === 'Other' && (
                    <input type="text" placeholder="Specify Category" value={customCategory} onChange={e => setCustomCategory(e.target.value)} className={inputClasses} />
                )}
                <input type="number" placeholder="Amount (R)" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" className={inputClasses} />
                <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className={inputClasses}>
                    <option value="monthly">Monthly</option>
                    <option value="annually">Annually</option>
                </select>
                <DateField value={startDate} onChange={setStartDate} className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Cost</button>
            </div>
        </form>
    );
};

export default AddRecurringCostForm;
