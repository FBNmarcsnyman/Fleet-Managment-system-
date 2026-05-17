import React, { useState } from 'react';
import { Tire } from '../types';

interface AddTireFormProps {
    onSubmit: (tire: Omit<Tire, 'id' | 'status' | 'assignedVehicleId' | 'assignedPosition' | 'mountHistory'>) => void;
    onCancel: () => void;
}

const AddTireForm: React.FC<AddTireFormProps> = ({ onSubmit, onCancel }) => {
    const [serialNumber, setSerialNumber] = useState('');
    const [brand, setBrand] = useState('');
    const [size, setSize] = useState('');
    const [type, setType] = useState<'New' | 'Retread'>('New');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [purchasePrice, setPurchasePrice] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            serialNumber,
            brand,
            size,
            type,
            purchaseDate,
            purchasePrice: parseFloat(purchasePrice),
        });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add New Tire to Inventory</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Serial Number" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Brand" value={brand} onChange={e => setBrand(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Size (e.g., 315/80R22.5)" value={size} onChange={e => setSize(e.target.value)} required className={inputClasses} />
                <select value={type} onChange={e => setType(e.target.value as any)} className={inputClasses}>
                    <option value="New">New</option>
                    <option value="Retread">Retread</option>
                </select>
                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className={inputClasses} />
                <input type="number" placeholder="Purchase Price (R)" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required step="0.01" className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Tire</button>
            </div>
        </form>
    );
};

export default AddTireForm;
