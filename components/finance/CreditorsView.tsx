import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Supplier } from '../../types';
import { format } from 'date-fns';
import { useUIState } from '../../contexts/AppContexts';

type FilterStatus = 'All' | 'Awaiting POD' | 'Awaiting Review' | 'Ready for Payment' | 'Paid';

interface CreditorsViewProps {
    loadConfirmations: LoadConfirmation[];
    suppliers: (Supplier & { averageRating?: number })[];
}

const CreditorsView: React.FC<CreditorsViewProps> = ({ loadConfirmations = [], suppliers = [] }) => {
    const { showModal } = useUIState();
    const [filter, setFilter] = useState<FilterStatus>('All');
    
    const transportSuppliers = useMemo(() => (suppliers || []).filter(s => s.type === 'Transport'), [suppliers]);
    const supplierMap = useMemo(() => new Map(transportSuppliers.map(s => [s.id, s])), [transportSuppliers]);

    const creditorJobs = useMemo(() => {
        return (loadConfirmations || [])
            .filter(lc => lc.supplierId && supplierMap.has(lc.supplierId))
            .filter(lc => (filter === 'All' || lc.paymentStatus === filter))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [loadConfirmations, filter, supplierMap]);

    const getStatusColor = (status: LoadConfirmation['paymentStatus']) => {
        switch (status) {
            case 'Awaiting POD':
                return 'bg-gray-700 text-gray-300';
            case 'Awaiting Review':
                return 'bg-yellow-100 text-yellow-800';
            case 'Ready for Payment':
                return 'bg-blue-100 text-blue-800';
            case 'Paid':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-700 text-gray-400';
        }
    };
    
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Creditors: Sub-Contractor Loads</h3>
                <div className="flex items-center space-x-3">
                    <select value={filter} onChange={e => setFilter(e.target.value as any)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600">
                        {(['All', 'Awaiting POD', 'Awaiting Review', 'Ready for Payment', 'Paid'] as const).map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Date</th>
                            <th className="p-2 text-gray-400">LoadCon #</th>
                            <th className="p-2 text-gray-400">Supplier</th>
                            <th className="p-2 text-gray-400">Rating</th>
                            <th className="p-2 text-gray-400">Route</th>
                            <th className="p-2 text-gray-400 text-right">Supplier Rate</th>
                            <th className="p-2 text-gray-400 text-center">Status</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {creditorJobs.map(lc => {
                            const supplier = supplierMap.get(lc.supplierId!);
                            return (
                                <tr key={lc.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                    <td className="p-2">{format(new Date(lc.date), 'dd MMM yyyy')}</td>
                                    <td className="p-2 font-mono text-white">{lc.loadConNumber}</td>
                                    <td className="p-2 font-semibold">{supplier?.name}</td>
                                    <td className="p-2 text-yellow-400">{supplier?.averageRating ? supplier.averageRating.toFixed(1) + ' ★' : 'N/A'}</td>
                                    <td className="p-2">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</td>
                                    <td className="p-2 text-right font-mono">R {lc.supplierRate?.toFixed(2)}</td>
                                    <td className="p-2 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(lc.paymentStatus)}`}>
                                            {lc.paymentStatus || 'Awaiting POD'}
                                        </span>
                                    </td>
                                    <td className="p-2 text-right space-x-2">
                                        {lc.paymentStatus === 'Awaiting Review' && (
                                            <button onClick={() => showModal('viewPod', { loadCon: lc })} className="text-xs font-semibold bg-yellow-600 hover:bg-yellow-700 text-white py-1 px-2 rounded-lg">Review POD</button>
                                        )}
                                        {lc.paymentStatus === 'Ready for Payment' && (
                                            <button className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-lg">Mark as Paid</button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                 {creditorJobs.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-gray-500">No creditor jobs match the current filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreditorsView;