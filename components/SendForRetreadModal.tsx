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

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Send Tire for Retread</h2>
            <p className="text-gray-400 mb-6 font-mono">{tire.serialNumber}</p>
            <div className="space-y-4">
                <input type="text" placeholder="Retread Vendor" value={vendor} onChange={e => setVendor(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-md" />
                <DateField value={expectedReturn} onChange={setExpectedReturn} className="w-full bg-gray-700 p-3 rounded-md" />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-orange-600 py-2 px-4 rounded-lg">Send</button>
            </div>
        </form>
    );
};

export default SendForRetreadModal;
