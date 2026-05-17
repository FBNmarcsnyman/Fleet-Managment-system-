import React, { useState } from 'react';
import { Supplier, LoadConfirmation } from '../types';

interface RateSupplierModalProps {
    supplier: Supplier;
    loadCon: LoadConfirmation;
    onRate: (rating: { rating: number; comments: string }) => void;
    onCancel: () => void;
}

const RateSupplierModal: React.FC<RateSupplierModalProps> = ({ supplier, loadCon, onRate, onCancel }) => {
    const [rating, setRating] = useState(5);
    const [comments, setComments] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onRate({ rating, comments });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Rate Supplier Performance</h2>
            <p className="text-gray-400 mb-6">Supplier: <strong className="text-white">{supplier.name}</strong> for Load <strong className="font-mono">{loadCon.loadConNumber}</strong></p>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Overall Rating (1-5)</label>
                    <div className="flex space-x-2">
                        {[1, 2, 3, 4, 5].map(star => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className={`text-3xl ${rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}
                            >
                                &#9733;
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Comments (Optional)</label>
                    <textarea value={comments} onChange={e => setComments(e.target.value)} rows={4} className="w-full bg-gray-700 p-2 rounded-md" />
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Submit Rating</button>
            </div>
        </form>
    );
};

export default RateSupplierModal;