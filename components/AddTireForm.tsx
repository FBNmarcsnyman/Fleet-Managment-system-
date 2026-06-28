import React, { useState } from 'react';
import { Tire } from '../types';
import DateField from './operations/DateField';

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
        onSubmit({ serialNumber, brand, size, type, purchaseDate, purchasePrice: parseFloat(purchasePrice) });
    };

    const inputClasses = 'w-full bg-white text-slate-800 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f5b700]';

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-black mb-6 text-[#13294b]">Add Tyre to Inventory</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Serial number" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Brand" value={brand} onChange={e => setBrand(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Size (e.g. 315/80R22.5)" value={size} onChange={e => setSize(e.target.value)} required className={inputClasses} />
                <select value={type} onChange={e => setType(e.target.value as any)} className={inputClasses}>
                    <option value="New">New</option>
                    <option value="Retread">Retread</option>
                </select>
                <DateField value={purchaseDate} onChange={setPurchaseDate} className={inputClasses} />
                <input type="number" placeholder="Purchase price (R)" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required step="0.01" className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-4 rounded-lg">Add tyre</button>
            </div>
        </form>
    );
};

export default AddTireForm;
