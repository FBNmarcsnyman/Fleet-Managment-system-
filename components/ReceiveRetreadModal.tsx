import React from 'react';
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
            <h2 className="text-2xl font-black mb-4 text-[#13294b]">Receive Retreaded Tyre</h2>
            <p className="text-slate-500 mb-6">Confirm receipt of tyre <strong className="font-mono">{tire.serialNumber}</strong> from the retreader. This returns it to 'In Storage' (type Retread).</p>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={onCancel} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg">Confirm receipt</button>
            </div>
        </form>
    );
};

export default ReceiveRetreadModal;
