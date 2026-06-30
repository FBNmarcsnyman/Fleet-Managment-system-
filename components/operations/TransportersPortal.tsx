import React, { useState, lazy, Suspense } from 'react';
import SupplierOnboardingView from './SupplierOnboardingView';
import ComplianceVettingView from './ComplianceVettingView';

const SubcontractorManagementView = lazy(() => import('./SupplierManagementView'));

// Transporters (subcontractors) — their own screen: the carrier list/CRM, the
// compliance-doc vetting, and the new-supplier onboarding queue. Kept separate
// from Clients so the two relationships (and their comms) never mix.
type TransTab = 'list' | 'vetting' | 'onboarding';

const NAV: { view: TransTab; label: string }[] = [
    { view: 'list', label: 'Transporters' },
    { view: 'vetting', label: 'Compliance Vetting' },
    { view: 'onboarding', label: 'Supplier Onboarding' },
];

const TransportersPortal: React.FC = () => {
    const [view, setView] = useState<TransTab>('list');
    const render = () => {
        switch (view) {
            case 'vetting': return <ComplianceVettingView />;
            case 'onboarding': return <SupplierOnboardingView />;
            case 'list':
            default: return <Suspense fallback={<div className="text-gray-400 p-4">Loading…</div>}><SubcontractorManagementView /></Suspense>;
        }
    };
    return (
        <div className="space-y-4">
            <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1 w-fit">
                {NAV.map(n => (
                    <button key={n.view} onClick={() => setView(n.view)}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${view === n.view ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                        {n.label}
                    </button>
                ))}
            </div>
            {render()}
        </div>
    );
};

export default TransportersPortal;
