import React, { useState } from 'react';
import { Part, Supplier } from '../types';

interface AddPartFormProps {
    suppliers: Supplier[];
    onSubmit: (part: Omit<Part, 'id'>) => void;
    onCancel: () => void;
}

const AddPartForm: React.FC<AddPartFormProps> = ({ suppliers, onSubmit, onCancel }) => {
    const [name, setName] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [quantityInStock, setQuantityInStock] = useState(0);
    const [minStockLevel, setMinStockLevel] = useState(0);
    const [cost, setCost] = useState(0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ name, partNumber, supplierId, quantityInStock, minStockLevel, cost });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add New Part</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Part Name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Part Number (Optional)" value={partNumber} onChange={e => setPartNumber(e.target.value)} className={inputClasses} />
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputClasses}>
                    <option value="">-- Select Preferred Supplier (Optional) --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Initial Stock" value={quantityInStock} onChange={e => setQuantityInStock(Number(e.target.value))} required className={inputClasses} />
                    <input type="number" placeholder="Reorder Point" value={minStockLevel} onChange={e => setMinStockLevel(Number(e.target.value))} required className={inputClasses} />
                </div>
                <input type="number" placeholder="Last Cost (R)" value={cost} onChange={e => setCost(Number(e.target.value))} required step="0.01" className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Part</button>
            </div>
        </form>
    );
};

export default AddPartForm;