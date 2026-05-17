
import React, { useState, useMemo } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { Supplier, SupplierApplication } from '../../types';
import { UsersIcon } from '../icons/UsersIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';
import SupplierOnboardingView from '../operations/SupplierOnboardingView';
import { format } from 'date-fns';

const SubcontractorControlCenter: React.FC = () => {
    const { suppliers = [], supplierApplications = [] } = useOperations();
    const { showModal, showToast } = useUIState();
    const [activeTab, setActiveTab] = useState<'network' | 'onboarding'>('network');

    const transportSuppliers = useMemo(() => 
        (suppliers || []).filter(s => s.type === 'Transport')
    , [suppliers]);

    const complianceStats = useMemo(() => {
        const total = transportSuppliers.length;
        const compliant = transportSuppliers.filter(s => s.complianceStatus === 'Compliant').length;
        const expired = transportSuppliers.filter(s => s.complianceStatus === 'Expired').length;
        return { total, compliant, expired };
    }, [transportSuppliers]);

    const handleCopyOnboardingLink = () => {
        const url = `${window.location.origin}${window.location.pathname}?portal=become-supplier`;
        navigator.clipboard.writeText(url);
        showToast("Onboarding questionnaire link copied to clipboard!");
    };

    return (
        <div className="space-y-6">
            {/* Compliance Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Network Size</p>
                    <p className="text-3xl font-black text-white">{complianceStats.total} <span className="text-sm font-normal text-gray-500">Active Carriers</span></p>
                </div>
                <div className="bg-emerald-900/20 p-6 rounded-xl border border-emerald-500/20 shadow-xl">
                    <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-1">Compliant</p>
                    <p className="text-3xl font-black text-emerald-300">{complianceStats.compliant} <span className="text-sm font-normal text-emerald-500/60">Ready to Load</span></p>
                </div>
                <div className="bg-red-900/20 p-6 rounded-xl border border-red-500/20 shadow-xl">
                    <p className="text-sm font-bold text-red-400 uppercase tracking-widest mb-1">Non-Compliant</p>
                    <p className="text-3xl font-black text-red-300">{complianceStats.expired} <span className="text-sm font-normal text-red-500/60">Action Required</span></p>
                </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                <div className="flex space-x-4">
                    <button 
                        onClick={() => setActiveTab('network')}
                        className={`text-lg font-bold pb-4 -mb-4 border-b-2 transition-all ${activeTab === 'network' ? 'text-white border-brand-primary' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                    >
                        Active Network
                    </button>
                    <button 
                        onClick={() => setActiveTab('onboarding')}
                        className={`text-lg font-bold pb-4 -mb-4 border-b-2 transition-all flex items-center ${activeTab === 'onboarding' ? 'text-white border-brand-primary' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                    >
                        Onboarding Queue
                        {supplierApplications.filter(a => a.status === 'Pending').length > 0 && (
                            <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                                {supplierApplications.filter(a => a.status === 'Pending').length}
                            </span>
                        )}
                    </button>
                </div>
                <button 
                    onClick={handleCopyOnboardingLink}
                    className="flex items-center bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-sm font-black uppercase tracking-wider transition-all border border-blue-500/30"
                >
                    <SparklesIcon className="h-4 w-4 mr-2" /> Send Onboarding Invite
                </button>
            </div>

            {activeTab === 'network' ? (
                <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900/60 border-b border-gray-700">
                            <tr>
                                <th className="p-4 text-gray-400 uppercase text-[10px] font-black tracking-widest">Carrier Details</th>
                                <th className="p-4 text-gray-400 uppercase text-[10px] font-black tracking-widest text-center">Specialization</th>
                                <th className="p-4 text-gray-400 uppercase text-[10px] font-black tracking-widest text-center">Status</th>
                                <th className="p-4 text-gray-400 uppercase text-[10px] font-black tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transportSuppliers.map(s => (
                                <tr key={s.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-white text-base">{s.name}</p>
                                        <p className="text-xs text-gray-500">{s.contactPerson} • {s.contactPhone}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-wrap justify-center gap-1">
                                            {s.specializations?.slice(0, 2).map(spec => (
                                                <span key={spec} className="bg-gray-900 px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-900/30">{spec}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex items-center">
                                            {s.complianceStatus === 'Compliant' ? (
                                                <span className="flex items-center text-emerald-400 font-bold bg-emerald-900/30 px-3 py-1 rounded-full text-xs">
                                                    <CheckCircleIcon className="h-4 w-4 mr-1.5" /> Compliant
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-red-400 font-bold bg-red-900/30 px-3 py-1 rounded-full text-xs">
                                                    <ExclamationTriangleIcon className="h-4 w-4 mr-1.5" /> {s.complianceStatus}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="text-xs font-black text-blue-400 hover:text-white uppercase tracking-wider">View Profile</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <SupplierOnboardingView />
            )}
        </div>
    );
};

export default SubcontractorControlCenter;
