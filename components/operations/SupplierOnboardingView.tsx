
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
            'Pending': 'bg-amber-100 text-amber-700',
            'Approved': 'bg-emerald-100 text-emerald-700',
            'Rejected': 'bg-red-100 text-red-700',
        }[status];
    };

    const apps = (supplierApplications || []) as SupplierApplication[];
    const pendingCount = apps.filter(x => x.status === 'Pending').length;

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-slate-900">Supplier Onboarding</h2>
                {pendingCount > 0 && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">{pendingCount} awaiting review</span>}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="p-2 text-slate-500 font-bold">Company Name</th>
                            <th className="p-2 text-slate-500 font-bold">Contact</th>
                            <th className="p-2 text-slate-500 font-bold">Fleet</th>
                            <th className="p-2 text-slate-500 font-bold">Submitted</th>
                            <th className="p-2 text-slate-500 font-bold text-center">Status</th>
                            <th className="p-2 text-slate-500 font-bold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {apps.map((app) => (
                            <tr key={app.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-2 font-bold text-slate-900">{app.companyName}{app.agreementAcceptedAt ? <span className="ml-2 text-[10px] font-bold text-emerald-600">✓ signed</span> : ''}</td>
                                <td className="p-2 text-slate-600">{app.contactPerson}</td>
                                <td className="p-2 text-slate-600">{app.vehicles?.length ? `${app.vehicles.length} vehicle${app.vehicles.length > 1 ? 's' : ''}` : (app.fleetSize || '-')}</td>
                                <td className="p-2 text-slate-500" title={format(new Date(app.submittedDate), 'dd MMM yyyy, HH:mm')}>
                                    {formatDistanceToNow(new Date(app.submittedDate), { addSuffix: true })}
                                </td>
                                <td className="p-2 text-center">
                                     <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(app.status)}`}>
                                        {app.status}
                                    </span>
                                </td>
                                <td className="p-2 text-right">
                                    <button onClick={() => openDetailModal(app)} className="font-bold text-blue-600 hover:text-blue-800">
                                        Review
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {apps.length === 0 && <p className="text-center text-slate-400 py-16">No pending supplier applications.</p>}
            </div>
        </div>
    );
};

export default SupplierOnboardingView;
