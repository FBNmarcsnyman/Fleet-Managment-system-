import React, { useState } from 'react';
import { Bowser } from '../types';

interface AddBowserFormProps {
    onSubmit: (bowser: Omit<Bowser, 'id'>) => void;
    onCancel: () => void;
}

const AddBowserForm: React.FC<AddBowserFormProps> = ({ onSubmit, onCancel }) => {
    const [name, setName] = useState('');
    const [capacity, setCapacity] = useState('');
    const [currentStock, setCurrentStock] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !capacity || !currentStock) {
            alert("Please fill all fields.");
            return;
        }
        onSubmit({
            name,
            capacity: parseFloat(capacity),
            currentStock: parseFloat(currentStock),
        });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add New Bowser</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Bowser Name (e.g., CPT Bowser)" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Total Capacity (Liters)" value={capacity} onChange={e => setCapacity(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Initial Stock (Liters)" value={currentStock} onChange={e => setCurrentStock(e.target.value)} required className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Bowser</button>
            </div>
        </form>
    );
};

export default AddBowserForm;