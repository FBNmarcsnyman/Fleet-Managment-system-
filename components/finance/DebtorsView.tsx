import React, { useMemo } from 'react';
import { LoadConfirmation, Client } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { format } from 'date-fns';

const DebtorsView: React.FC<{
    loadConfirmations: LoadConfirmation[];
    clients: Client[];
}> = ({ loadConfirmations = [], clients = [] }) => {
    const { showModal } = useUIState();
    const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c])), [clients]);

    const jobsToInvoice = useMemo(() => {
        return (loadConfirmations || []).filter(lc => lc.status === 'POD Submitted');
    }, [loadConfirmations]);

    const handleGenerateInvoice = (lc: LoadConfirmation) => {
        const client = clientMap.get(lc.clientId);
        if (client) {
            showModal('invoicePdf', { loadCon: lc, client });
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Debtors: Ready to Invoice</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Delivery Date</th>
                            <th className="p-2 text-gray-400">LoadCon #</th>
                            <th className="p-2 text-gray-400">Client</th>
                            <th className="p-2 text-gray-400">Route</th>
                            <th className="p-2 text-gray-400 text-right">Amount</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobsToInvoice.map(lc => (
                            <tr key={lc.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                <td className="p-2">{lc.deliveryDate ? format(new Date(lc.deliveryDate), 'dd MMM yyyy') : 'N/A'}</td>
                                <td className="p-2 font-mono text-white">{lc.loadConNumber}</td>
                                <td className="p-2 font-semibold">{clientMap.get(lc.clientId)?.name}</td>
                                <td className="p-2">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</td>
                                <td className="p-2 text-right font-mono">R {lc.totalAmount.toFixed(2)}</td>
                                <td className="p-2 text-right">
                                    <button onClick={() => handleGenerateInvoice(lc)} className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-lg">
                                        Generate Invoice
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {jobsToInvoice.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-gray-500">No jobs are currently ready for invoicing.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebtorsView;