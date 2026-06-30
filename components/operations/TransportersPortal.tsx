import React, { useState, lazy, Suspense } from 'react';
import SupplierOnboardingView from './SupplierOnboardingView';
import ComplianceVettingView from './ComplianceVettingView';
import { useAuth } from '../../contexts/AppContexts';

const SubcontractorManagementView = lazy(() => import('./SupplierManagementView'));
const ClientCommsView = lazy(() => import('./ClientCommsView'));

// Transporters (subcontractors) — their own screen: the carrier list/CRM, the
// compliance-doc vetting, and the new-supplier onboarding queue. Kept separate
// from Clients so the two relationships (and their comms) never mix.
// Sub-tabs controllable per role/branch via Users → Tab Access (accounts:*).
type TransTab = 'list' | 'vetting' | 'onboarding' | 'comms';

const NAV: { view: TransTab; key: string; label: string }[] = [
    { view: 'list', key: 'transporters', label: 'Transporters' },
    { view: 'vetting', key: 'vetting', label: 'Compliance Vetting' },
    { view: 'onboarding', key: 'onboarding', label: 'Supplier Onboarding' },
    { view: 'comms', key: 'comms', label: 'Comms & Marketing' },
];

const TransportersPortal: React.FC = () => {
    const { myHiddenTabs, currentUser } = useAuth();
    const isAdminRole = ['Admin', 'Super Admin'].includes(currentUser?.role as string);
    const nav = NAV.filter(n => isAdminRole || !(myHiddenTabs || []).includes(`accounts:${n.key}`));
    const [view, setView] = useState<TransTab>(nav[0]?.view || 'list');
    const render = () => {
        switch (view) {
            case 'vetting': return <ComplianceVettingView />;
            case 'onboarding': return <SupplierOnboardingView />;
            case 'comms': return <Suspense fallback={<div className="text-gray-400 p-4">Loading…</div>}><ClientCommsView carrierMode /></Suspense>;
            case 'list':
            default: return <Suspense fallback={<div className="text-gray-400 p-4">Loading…</div>}><SubcontractorManagementView /></Suspense>;
        }
    };
    return (
        <div className="space-y-4">
            <div className="bg-slate-100 p-1 rounded-xl flex flex-wrap gap-1 w-fit">
                {nav.map(n => (
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
