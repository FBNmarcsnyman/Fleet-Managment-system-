import React, { useState } from 'react';
import { OtherCost } from '../types';
import { DEFAULT_COST_CATEGORIES } from '../constants';

interface AddCostFormProps {
    onSubmit: (cost: Omit<OtherCost, 'id' | 'vehicleId'>) => void;
    onCancel: () => void;
}

const AddCostForm: React.FC<AddCostFormProps> = ({ onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [amount, setAmount] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalCategory = category === 'Other' ? customCategory : category;
        if (!date || !finalCategory || !amount) {
            alert('Please fill all fields');
            return;
        }
        onSubmit({
            date,
            category: finalCategory,
            amount: parseFloat(amount),
        });
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Other Cost</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Month</label>
                    <input type="month" value={date} onChange={e => setDate(e.target.value)} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className={inputClasses}>
                        <option value="">-- Select Category --</option>
                        {DEFAULT_COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Other">Other (Specify)</option>
                    </select>
                </div>
                {category === 'Other' && (
                    <input type="text" placeholder="Specify Category" value={customCategory} onChange={e => setCustomCategory(e.target.value)} className={inputClasses} />
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Amount (R)</label>
                    <input type="number" placeholder="e.g., 1500.00" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" className={inputClasses} />
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Cost</button>
            </div>
        </form>
    );
};

export default AddCostForm;
