import React, { useState } from 'react';
import { Tire } from '../types';

interface ReceiveRetreadModalProps {
    tire: Tire;
    onReceive: (tireId: string) => void;
    onCancel: () => void;
}

const ReceiveRetreadModal: React.FC<ReceiveRetreadModalProps> = ({ tire, onReceive, onCancel }) => {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onReceive(tire.id);
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Receive Retreaded Tire</h2>
            <p className="text-gray-400 mb-6">Confirm receipt of tire <strong className="font-mono">{tire.serialNumber}</strong> from the retreader. This will return it to 'In Storage' status.</p>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg">Confirm Receipt</button>
            </div>
        </form>
    );
};

export default ReceiveRetreadModal;
