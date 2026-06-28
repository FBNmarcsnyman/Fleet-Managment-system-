import React, { useState } from 'react';
import { Tire } from '../types';
import DateField from './operations/DateField';

interface SendForRetreadModalProps {
    tire: Tire;
    onSend: (tireId: string, vendor: string, expectedReturn: string) => void;
    onCancel: () => void;
}

const SendForRetreadModal: React.FC<SendForRetreadModalProps> = ({ tire, onSend, onCancel }) => {
    const [vendor, setVendor] = useState('');
    const [expectedReturn, setExpectedReturn] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSend(tire.id, vendor, expectedReturn);
    };

    const inputClasses = 'w-full bg-white text-slate-800 p-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f5b700]';

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-black mb-4 text-[#13294b]">Send Tyre for Retread</h2>
            <p className="text-slate-500 mb-6 font-mono">{tire.serialNumber}</p>
            <div className="space-y-4">
                <input type="text" placeholder="Retread vendor" value={vendor} onChange={e => setVendor(e.target.value)} required className={inputClasses} />
                <DateField value={expectedReturn} onChange={setExpectedReturn} className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg">Send</button>
            </div>
        </form>
    );
};

export default SendForRetreadModal;
