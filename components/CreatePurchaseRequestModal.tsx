
import React, { useState } from 'react';
import { PurchaseRequest, Part, JobCard } from '../types';

interface CreatePurchaseRequestModalProps {
    parts: Part[];
    jobCards: JobCard[];
    onSubmit: (request: Omit<PurchaseRequest, 'id' | 'requestedByUserId' | 'requestedDate' | 'status' | 'quotes'>) => void;
    onCancel: () => void;
}

const CreatePurchaseRequestModal: React.FC<CreatePurchaseRequestModalProps> = ({ parts, jobCards, onSubmit, onCancel }) => {
    const [partId, setPartId] = useState('');
    const [jobCardId, setJobCardId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [isUrgent, setIsUrgent] = useState(false);

    const openJobCards = jobCards.filter(jc => jc.status !== 'Resolved');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!partId || quantity < 1) {
            alert('Please select a part and enter a valid quantity.');
            return;
        }
        onSubmit({ partId, jobCardId: jobCardId || undefined, quantity, isUrgent });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Create Purchase Request</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Part</label>
                    <select value={partId} onChange={e => setPartId(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary">
                        <option value="" disabled>-- Select a part --</option>
                        {parts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.partNumber})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Link to Job Card (Optional)</label>
                    <select value={jobCardId} onChange={e => setJobCardId(e.target.value)} className="w-full bg-gray-700 p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary">
                        <option value="">-- No linked job card --</option>
                        {openJobCards.map(jc => <option key={jc.id} value={jc.id}>{jc.itemDescription} (JC-{jc.id.slice(0, 5)})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Quantity</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min="1" required className="w-full bg-gray-700 p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary" />
                </div>
                <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} className="form-checkbox h-5 w-5 text-brand-primary bg-gray-600 border-gray-500 rounded focus:ring-brand-secondary" />
                        <span className="text-gray-300">Mark as Urgent (bypasses 3-quote rule)</span>
                    </label>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Submit Request</button>
            </div>
        </form>
    );
};

export default CreatePurchaseRequestModal;
