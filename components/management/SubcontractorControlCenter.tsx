
import React, { useState, useMemo } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { Supplier, SupplierApplication } from '../../types';
import { UsersIcon } from '../icons/UsersIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';
import SupplierOnboardingView from '../operations/SupplierOnboardingView';
import CarrierInviteCampaign from './CarrierInviteCampaign';
import CarrierInvoicesReview from './CarrierInvoicesReview';
import { format } from 'date-fns';

const SubcontractorControlCenter: React.FC = () => {
    const { suppliers = [], supplierApplications = [], users = [], handleUpdateSupplier, handleSendCarrierRegistrationLink, handleCreateCarrierLogin } = useOperations();
    const { showModal, showToast } = useUIState();

    const supplierEmailsWithLogin = useMemo(
        () => new Set((users || []).filter((u: any) => u.role === 'Supplier' && u.email).map((u: any) => u.email.toLowerCase())),
        [users],
    );

    const sendRegLink = async (s: Supplier) => {
        const res = await handleSendCarrierRegistrationLink(s);
        showToast(res?.ok ? `Profile link sent to ${s.name}.` : (res?.error || 'Could not send link.'));
    };

    const createLogin = async (s: Supplier) => {
        showToast(`Creating login for ${s.name}…`);
        const res = await handleCreateCarrierLogin(s);
        if (res?.ok) showToast(`Login created & emailed to ${s.contactEmail}${res.value?.tempPassword ? ` (temp password: ${res.value.tempPassword})` : ''}.`);
        else showToast(res?.error || 'Could not create login.');
    };

    const setVetted = async (s: Supplier, vetted: boolean) => {
        const res = await handleUpdateSupplier(s.id, { isVetted: vetted, vettedAt: vetted ? new Date().toISOString() : undefined });
        showToast(res?.ok === false ? (res.error || 'Could not update carrier.') : `${s.name} marked ${vetted ? 'vetted' : 'not vetted'}.`);
    };

    const markAllVetted = async () => {
        const unvetted = transportSuppliers.filter(s => !s.isVetted);
        if (!unvetted.length) { showToast('All carriers are already vetted.'); return; }
        for (const s of unvetted) {
            await handleUpdateSupplier(s.id, { isVetted: true, vettedAt: new Date().toISOString() });
        }
        showToast(`${unvetted.length} carrier(s) marked vetted.`);
    };
    const [activeTab, setActiveTab] = useState<'network' | 'onboarding' | 'invite' | 'invoices'>('network');

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
        const url = `${window.location.origin}/supplier-register`;
        navigator.clipboard.writeText(url);
        showToast("Onboarding questionnaire link copied to clipboard!");
    };

    return (
        <div className="space-y-6">
            {/* Compliance Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Network Size</p>
                    <p className="text-3xl font-black text-slate-900">{complianceStats.total} <span className="text-sm font-normal text-slate-500">Active Carriers</span></p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
                    <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">Compliant</p>
                    <p className="text-3xl font-black text-emerald-700">{complianceStats.compliant} <span className="text-sm font-normal text-emerald-600/70">Ready to Load</span></p>
                </div>
                <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm">
                    <p className="text-sm font-bold text-red-600 uppercase tracking-widest mb-1">Non-Compliant</p>
                    <p className="text-3xl font-black text-red-700">{complianceStats.expired} <span className="text-sm font-normal text-red-600/70">Action Required</span></p>
                </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex space-x-4">
                    <button
                        onClick={() => setActiveTab('network')}
                        className={`text-lg font-bold pb-4 -mb-4 border-b-2 transition-all ${activeTab === 'network' ? 'text-[#13294b] border-[#f5b700]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >
                        Active Network
                    </button>
                    <button
                        onClick={() => setActiveTab('onboarding')}
                        className={`text-lg font-bold pb-4 -mb-4 border-b-2 transition-all flex items-center ${activeTab === 'onboarding' ? 'text-[#13294b] border-[#f5b700]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >
                        Onboarding Queue
                        {supplierApplications.filter(a => a.status === 'Pending').length > 0 && (
                            <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                                {supplierApplications.filter(a => a.status === 'Pending').length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('invite')}
                        className={`text-lg font-bold pb-4 -mb-4 border-b-2 transition-all flex items-center ${activeTab === 'invite' ? 'text-[#13294b] border-[#f5b700]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >
                        Invite Carriers
                    </button>
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`text-lg font-bold pb-4 -mb-4 border-b-2 transition-all flex items-center ${activeTab === 'invoices' ? 'text-[#13294b] border-[#f5b700]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >
                        Invoices
                    </button>
                </div>
                <button
                    onClick={handleCopyOnboardingLink}
                    className="flex items-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-sm font-black uppercase tracking-wider transition-all border border-blue-200"
                >
                    <SparklesIcon className="h-4 w-4 mr-2" /> Copy Public Link
                </button>
            </div>

            {activeTab === 'invoices' ? (
                <CarrierInvoicesReview />
            ) : activeTab === 'invite' ? (
                <CarrierInviteCampaign />
            ) : activeTab === 'network' ? (
                <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                        <p className="text-xs font-bold text-slate-500">
                            <span className="text-emerald-600 font-black">{transportSuppliers.filter(s => s.isVetted).length}</span> of {transportSuppliers.length} carriers vetted
                        </p>
                        <button
                            onClick={markAllVetted}
                            className="flex items-center bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border border-emerald-200"
                        >
                            <CheckCircleIcon className="h-4 w-4 mr-2" /> Mark all as vetted
                        </button>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-slate-500 uppercase text-[10px] font-black tracking-widest">Carrier Details</th>
                                <th className="p-4 text-slate-500 uppercase text-[10px] font-black tracking-widest text-center">Specialization</th>
                                <th className="p-4 text-slate-500 uppercase text-[10px] font-black tracking-widest text-center">Compliance</th>
                                <th className="p-4 text-slate-500 uppercase text-[10px] font-black tracking-widest text-center">Vetting</th>
                                <th className="p-4 text-slate-500 uppercase text-[10px] font-black tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transportSuppliers.map(s => (
                                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-slate-900 text-base">{s.name}</p>
                                        <p className="text-xs text-slate-500">{s.contactPerson} • {s.contactPhone}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-wrap justify-center gap-1">
                                            {s.specializations?.slice(0, 2).map(spec => (
                                                <span key={spec} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-blue-700 border border-blue-200">{spec}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex items-center">
                                            {s.complianceStatus === 'Compliant' ? (
                                                <span className="flex items-center text-emerald-700 font-bold bg-emerald-100 px-3 py-1 rounded-full text-xs">
                                                    <CheckCircleIcon className="h-4 w-4 mr-1.5" /> Compliant
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-xs">
                                                    <ExclamationTriangleIcon className="h-4 w-4 mr-1.5" /> {s.complianceStatus}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {s.isVetted ? (
                                            <span className="inline-flex items-center text-emerald-700 font-bold bg-emerald-100 px-3 py-1 rounded-full text-xs">
                                                <CheckCircleIcon className="h-4 w-4 mr-1.5" /> Vetted
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-full text-xs">Not vetted</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right whitespace-nowrap">
                                        <button onClick={() => sendRegLink(s)} className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider mr-4">Send Profile Link</button>
                                        {supplierEmailsWithLogin.has((s.contactEmail || '').toLowerCase()) ? (
                                            <span className="text-xs font-black text-emerald-600/70 uppercase tracking-wider mr-4">Login Active</span>
                                        ) : (
                                            <button onClick={() => createLogin(s)} className="text-xs font-black text-amber-600 hover:text-amber-800 uppercase tracking-wider mr-4">Create Login</button>
                                        )}
                                        {s.isVetted ? (
                                            <button onClick={() => setVetted(s, false)} className="text-xs font-black text-slate-400 hover:text-red-600 uppercase tracking-wider">Unvet</button>
                                        ) : (
                                            <button onClick={() => setVetted(s, true)} className="text-xs font-black text-emerald-600 hover:text-emerald-800 uppercase tracking-wider">Mark Vetted</button>
                                        )}
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
