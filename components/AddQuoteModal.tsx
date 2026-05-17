
import React, { useState } from 'react';

interface AddQuoteModalProps {
    onSubmit: (quote: { vendor: string, amount: number }, file: File) => void;
    onCancel: () => void;
}

const AddQuoteModal: React.FC<AddQuoteModalProps> = ({ onSubmit, onCancel }) => {
    const [vendor, setVendor] = useState('');
    const [amount, setAmount] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendor || !amount || !file) {
            alert("Please fill all fields and select a file.");
            return;
        }
        onSubmit({ vendor, amount: parseFloat(amount) }, file);
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Repair Quote</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Vendor Name" value={vendor} onChange={e => setVendor(e.target.value)} required className={inputClasses} />
                <input type="number" placeholder="Quote Amount (R)" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" className={inputClasses} />
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Quote Document</label>
                    <input type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} required className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white" />
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Add Quote</button>
            </div>
        </form>
    );
};

export default AddQuoteModal;
