import React, { useState, lazy, Suspense } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import ClientManagementView from './ClientManagementView';
import QuotesView from './QuotesView';
import SupplierOnboardingView from './SupplierOnboardingView';

const SubcontractorManagementView = lazy(() => import('./SupplierManagementView'));

type PartnersView = 'clients' | 'subcontractors' | 'onboarding' | 'quotes';

const NAV: { view: PartnersView; label: string }[] = [
    { view: 'clients', label: 'Clients' },
    { view: 'subcontractors', label: 'Subcontractors' },
    { view: 'onboarding', label: 'Supplier Onboarding' },
    { view: 'quotes', label: 'Quotes' },
];

const PartnersPortal: React.FC = () => {
    const [view, setView] = useState<PartnersView>('clients');
    const { quotes, clients, suppliers } = useOperations();
    const { showModal } = useUIState();

    const render = () => {
        switch (view) {
            case 'subcontractors': return <Suspense fallback={<div className="text-gray-400 p-4">Loading…</div>}><SubcontractorManagementView /></Suspense>;
            case 'onboarding': return <SupplierOnboardingView />;
            case 'quotes': return <QuotesView quotes={quotes} clients={clients} suppliers={suppliers} onShowPdf={(quote, client) => showModal('quotePdf', { quote, client })} />;
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
