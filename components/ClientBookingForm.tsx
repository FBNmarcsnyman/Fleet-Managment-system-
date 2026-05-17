

import React, { useState } from 'react';
import { User, Quote } from '../types';

interface ClientBookingFormProps {
    currentUser: User;
    onCreateQuote: (quoteData: Partial<Quote>) => void;
}

const ClientBookingForm: React.FC<ClientBookingFormProps> = ({ currentUser, onCreateQuote }) => {
    const [collectionPoint, setCollectionPoint] = useState('');
    const [deliveryPoint, setDeliveryPoint] = useState('');
    const [description, setDescription] = useState('');
    const [weight, setWeight] = useState('');
    const [specialRequirements, setSpecialRequirements] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const quoteData: Partial<Quote> = {
            clientId: currentUser.clientId!,
            legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Internal' }],
            items: [{
                id: 'item-1',
                description,
                packagingType: 'Pallet', // Default
                quantity: 1, // Default
                weight: Number(weight) || undefined,
                rate: 0, // To be filled by ops
                total: 0,
            }],
            specialRequirements,
            notes: "Submitted via Client Portal.",
        };
        onCreateQuote(quoteData);
        setIsSubmitted(true);
    };

    if (isSubmitted) {
        return (
            <div className="text-center py-20 bg-gray-800 rounded-lg">
                <h2 className="text-2xl font-bold text-green-400">Booking Request Submitted!</h2>
                <p className="text-gray-300 mt-2">Thank you. Our operations team has received your request and will be in touch shortly with a formal quote.</p>
                <button onClick={() => setIsSubmitted(false)} className="mt-6 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">
                    Create Another Booking
                </button>
            </div>
        );
    }

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Request a New Booking</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Collection Address</label>
                        <input type="text" value={collectionPoint} onChange={e => setCollectionPoint(e.target.value)} required className={inputClasses} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Delivery Address</label>
                        <input type="text" value={deliveryPoint} onChange={e => setDeliveryPoint(e.target.value)} required className={inputClasses} />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Commodity / Goods Description</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Total Weight (kg)</label>
                    <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Special Requirements</label>
                    <textarea value={specialRequirements} onChange={e => setSpecialRequirements(e.target.value)} rows={3} className={inputClasses} />
                </div>
                <div className="pt-4">
                    <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg">
                        Submit Booking Request
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ClientBookingForm;
