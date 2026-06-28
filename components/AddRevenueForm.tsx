import React, { useState } from 'react';
import { RevenueEntry } from '../types';
import DateField from './operations/DateField';

interface AddRevenueFormProps {
    onSubmit: (revenue: Omit<RevenueEntry, 'id' | 'vehicleId'>) => void;
    onCancel: () => void;
}

const AddRevenueForm: React.FC<AddRevenueFormProps> = ({ onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !description || !amount) {
            alert('Please fill all fields');
            return;
        }
        onSubmit({
            date,
            description,
            amount: parseFloat(amount),
        });
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Revenue Entry</h2>
            <div className="space-y-4">
                <DateField value={date} onChange={setDate} className={inputClasses} />
                <input type="text" placeholder="Description (e.g., Load LCN-001)" value={description} onChange={e => setDescription(e.target.value)} className={inputClasses} />
                <input type="number" placeholder="Amount (R)" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Entry</button>
            </div>
        </form>
    );
};

export default AddRevenueForm;
