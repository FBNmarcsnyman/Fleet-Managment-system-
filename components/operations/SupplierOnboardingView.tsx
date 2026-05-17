
import React from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { SupplierApplication } from '../../types';
import { format, formatDistanceToNow } from 'date-fns';

const SupplierOnboardingView: React.FC = () => {
    const { supplierApplications } = useOperations();
    const { showModal } = useUIState();

    const openDetailModal = (application: SupplierApplication) => {
        showModal('supplierApplicationDetail', { application });
    };

    const getStatusColor = (status: SupplierApplication['status']) => {
        return {
            'Pending': 'bg-yellow-900/50 text-yellow-300',
            'Approved': 'bg-green-900/50 text-green-300',
            'Rejected': 'bg-red-900/50 text-red-300',
        }[status];
    };
    
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-4">Supplier Onboarding</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Company Name</th>
                            <th className="p-2 text-gray-400">Contact</th>
                            <th className="p-2 text-gray-400">Submitted</th>
                            <th className="p-2 text-gray-400 text-center">Status</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(supplierApplications || []).map((app: SupplierApplication) => (
                            <tr key={app.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-semibold text-white">{app.companyName}</td>
                                <td className="p-2 text-gray-300">{app.contactPerson}</td>
                                <td className="p-2 text-gray-400" title={format(new Date(app.submittedDate), 'dd MMM yyyy, HH:mm')}>
                                    {formatDistanceToNow(new Date(app.submittedDate), { addSuffix: true })}
                                </td>
                                <td className="p-2 text-center">
                                     <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(app.status)}`}>
                                        {app.status}
                                    </span>
                                </td>
                                <td className="p-2 text-right">
                                    <button onClick={() => openDetailModal(app)} className="font-semibold text-brand-secondary hover:text-blue-400">
                                        Review
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {(supplierApplications || []).length === 0 && <p className="text-center text-gray-500 py-16">No pending supplier applications.</p>}
            </div>
        </div>
    );
};

export default SupplierOnboardingView;
