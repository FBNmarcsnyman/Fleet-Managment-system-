
import React, { lazy, Suspense } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import OperationsDashboard from './OperationsDashboard';
import LoadBoard from './LoadBoard';
import DocumentSettingsView from './DocumentSettingsView';

const SubcontractorLoadsView = lazy(() => import('./SubcontractorLoadsView'));
const WhatsAppChatsView = lazy(() => import('./WhatsAppChatsView'));
const ShipmentsBoard = lazy(() => import('./ShipmentsBoard'));
const ContainersView = lazy(() => import('./ContainersView'));
const EmailLogView = lazy(() => import('./EmailLogView'));
const OperationsOverview = lazy(() => import('./OperationsOverview'));
const ImportsBoard = lazy(() => import('./ImportsBoard'));


const OperationsPortal: React.FC = () => {
    const { currentView, operationsSubView, handleOperationsSubViewChange, showModal, showToast } = useUIState();
    const {
        loadConfirmations, clients, suppliers,
        handleUpdateLoadConfirmation, handleCreateLoadConfirmation: createLoadCon
    } = useOperations();

    // Two business areas share this portal: Broking (brokered freight) and
    // Operations (own consolidation / line-haul). Show only the active area's
    // tabs so each reads as its own section, matching the sidebar groups.
    const BROKING_TABS = [
        { view: 'dashboard', label: 'Dashboard' },
        { view: 'loadBoard', label: 'Load Board' },
        { view: 'subcontractorLoads', label: 'LoadCons' },
        { view: 'emailLog', label: 'Emails' },
        { view: 'driverChats', label: 'Driver Chats' },
        { view: 'docSettings', label: 'Doc Settings' },
    ];
    const OPS_TABS = [
        { view: 'opsDashboard', label: 'Dashboard' },
        { view: 'shipments', label: 'Shipments' },
        { view: 'imports', label: 'Imports' },
        { view: 'containers', label: 'Containers' },
    ];
    // The sidebar has two flat tabs — Broking and Operations — that both open
    // this portal. The current view decides which area's tab strip to show; the
    // active sub-tab falls back to that area's first tab when switching across.
    const isOps = currentView === 'operations';
    const navItems = isOps ? OPS_TABS : BROKING_TABS;
    const activeTab = navItems.some(t => t.view === operationsSubView) ? operationsSubView : navItems[0].view;

    const handleNewTransportOrder = () => showModal('transportOrder', {
        onSubmit: async (data: any) => {
            const result = await createLoadCon(data);
            if (result.ok) showToast((result as any).warning ? `Order ${result.value!.loadConNumber} created — ⚠ ${(result as any).warning}` : `Transport Order ${result.value!.loadConNumber} created.`);
            else showToast(`Failed to create Transport Order: ${result.error}`);
            return result;
        },
    });

    const handleNewCollection = () => showModal('quickCollection', {
        onSubmit: async (data: any) => {
            const result = await createLoadCon(data);
            if (result.ok) showToast((result as any).warning ? `Collection ${result.value!.loadConNumber} logged — ⚠ ${(result as any).warning}` : `Collection ${result.value!.loadConNumber} logged — ops notified.`);
            else showToast(`Failed to log collection: ${result.error}`);
            return result;
        },
    });

    const renderView = () => {
        switch (activeTab) {
            case 'subcontractorLoads': return <Suspense fallback={<div>Loading...</div>}><SubcontractorLoadsView loadConfirmations={loadConfirmations} suppliers={suppliers} clients={clients} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} /></Suspense>;
            case 'loadBoard': return <LoadBoard />;
            case 'shipments': return <Suspense fallback={<div>Loading…</div>}><ShipmentsBoard /></Suspense>;
            case 'containers': return <Suspense fallback={<div>Loading…</div>}><ContainersView /></Suspense>;
            case 'imports': return <Suspense fallback={<div>Loading…</div>}><ImportsBoard /></Suspense>;
            case 'driverChats': return <Suspense fallback={<div>Loading…</div>}><WhatsAppChatsView /></Suspense>;
            case 'emailLog': return <Suspense fallback={<div>Loading…</div>}><EmailLogView /></Suspense>;
            case 'docSettings': return <DocumentSettingsView />;
            case 'opsDashboard': return <Suspense fallback={<div>Loading…</div>}><OperationsOverview /></Suspense>;
            case 'dashboard':
            default:
                return <OperationsDashboard />;
        }
    };
    
    return (
        <div className="bg-slate-50 text-slate-800 rounded-2xl p-5 -m-2 min-h-[calc(100vh-7rem)] border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${isOps ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                        {isOps ? 'Operations' : 'Broking'}
                    </span>
                <div className="flex items-center gap-1 overflow-x-auto bg-slate-200/70 p-1 rounded-xl">
                    {navItems.map(item => (
                        <button key={item.view} onClick={() => handleOperationsSubViewChange(item.view as any)}
                            className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition ${activeTab === item.view ? 'bg-[#13294b] text-white shadow' : 'text-slate-600 hover:bg-white'}`}>
                            {item.label}
                        </button>
                    ))}
                </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {isOps ? (
                        <>
                            <button onClick={() => showModal('cartageScan', {})}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow transition active:scale-95">
                                📄 Import (scan)
                            </button>
                            <button onClick={() => showModal('bulkCollection', {})}
                                className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow transition active:scale-95">
                                + Bulk / Depot
                            </button>
                            <button onClick={handleNewCollection}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow transition active:scale-95">
                                + Collection
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => showModal('brokingCollection', { onSubmit: async (data: any) => {
                                const result = await createLoadCon(data);
                                if (result.ok) showToast((result as any).warning ? `Collection ${result.value!.loadConNumber} logged — ⚠ ${(result as any).warning}` : `Broking collection ${result.value!.loadConNumber} logged.`);
                                else showToast(`Failed: ${result.error}`);
                                return result;
                            } })}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow transition active:scale-95">
                                + Collection
                            </button>
                            <button onClick={handleNewTransportOrder}
                                className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow transition active:scale-95">
                                + New Transport Order
                            </button>
                        </>
                    )}
                </div>
            </div>
            {renderView()}
        </div>
    );
};

export default OperationsPortal;
