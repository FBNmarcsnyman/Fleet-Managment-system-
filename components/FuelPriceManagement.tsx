
import React, { useState } from 'react';
import { FuelPriceRecord } from '../types';
import DateField from './operations/DateField';

interface FuelPriceManagementProps {
    prices: FuelPriceRecord[];
    onSetPrice: (price: Omit<FuelPriceRecord, 'id'>) => void | Promise<{ ok: boolean; error?: string }>;
}

const FuelPriceManagement: React.FC<FuelPriceManagementProps> = ({ prices, onSetPrice }) => {
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [pricePerLiter, setPricePerLiter] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !pricePerLiter) {
            alert('Please select a date and enter a price.');
            return;
        }
        const price = parseFloat(pricePerLiter);
        if (isNaN(price) || price <= 0) {
            alert('Please enter a valid, positive price.');
            return;
        }
        setSaving(true);
        const result = await onSetPrice({ startDate, pricePerLiter: price });
        setSaving(false);
        if (result && result.ok === false) {
            alert(`Could not save the fuel price: ${result.error || 'unknown error'}`);
            return;
        }
        setPricePerLiter('');
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-white mb-4">Set Fuel Price</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">For Date</label>
                            <DateField value={startDate} onChange={setStartDate} className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary" />
                        </div>
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-300 mb-1">Price per Liter (R)</label>
                            <input
                                id="price"
                                type="number"
                                placeholder="e.g., 21.50"
                                value={pricePerLiter}
                                onChange={e => setPricePerLiter(e.target.value)}
                                className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                                step="0.01"
                            />
                        </div>
                        <div className="pt-2">
                             <button type="submit" disabled={saving} className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-60">
                                {saving ? 'Saving…' : 'Set Price'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <div className="md:col-span-2">
                 <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-white mb-4">Current Fuel Prices</h2>
                    <div className="overflow-x-auto max-h-96">
                         <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="p-3 text-gray-400">Start Date</th>
                                    <th className="p-3 text-gray-400 text-right">Price per Liter</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prices.length > 0 ? prices.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map(price => (
                                    <tr key={price.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                        <td className="p-3 font-semibold text-white">{price.startDate}</td>
                                        <td className="p-3 text-right font-mono text-lg text-green-400">R{price.pricePerLiter.toFixed(2)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={2} className="p-8 text-center text-gray-500">No fuel prices have been set.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FuelPriceManagement;
