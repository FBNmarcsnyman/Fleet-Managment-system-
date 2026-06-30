import React, { useState, useEffect, lazy, Suspense } from 'react';
import ClientManagementView from './ClientManagementView';
import SupplierOnboardingView from './SupplierOnboardingView';
import ComplianceVettingView from './ComplianceVettingView';
import { useUIState } from '../../contexts/AppContexts';

const SubcontractorManagementView = lazy(() => import('./SupplierManagementView'));

type PartnersView = 'clients' | 'subcontractors' | 'compliance' | 'onboarding';

const NAV: { view: PartnersView; label: string }[] = [
    { view: 'clients', label: 'Clients' },
    { view: 'subcontractors', label: 'Transporters' },
    { view: 'compliance', label: 'Compliance Vetting' },
    { view: 'onboarding', label: 'Supplier Onboarding' },
];

const PartnersPortal: React.FC = () => {
    // The sidebar (Accounts > Clients / Transporters) deep-links via partnersSubView.
    const { partnersSubView } = useUIState();
    const [view, setView] = useState<PartnersView>((partnersSubView as PartnersView) || 'clients');
    useEffect(() => { if (partnersSubView) setView(partnersSubView as PartnersView); }, [partnersSubView]);

    const render = () => {
        switch (view) {
            case 'subcontractors': return <Suspense fallback={<div className="text-gray-400 p-4">Loading…</div>}><SubcontractorManagementView /></Suspense>;
            case 'compliance': return <ComplianceVettingView />;
            case 'onboarding': return <SupplierOnboardingView />;
            case 'clients':
            default: return <ClientManagementView />;
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-gray-900/60 p-1 rounded-xl flex flex-wrap gap-1 border border-white/5 w-fit">
                {NAV.map(n => (
                    <button key={n.view} onClick={() => setView(n.view)}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${view === n.view ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>
                        {n.label}
                    </button>
                ))}
            </div>
            {render()}
        </div>
    );
};

export default PartnersPortal;
