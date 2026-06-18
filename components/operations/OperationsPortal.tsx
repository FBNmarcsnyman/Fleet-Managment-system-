
import React, { lazy, Suspense } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import OperationsDashboard from './OperationsDashboard';
import LoadBoard from './LoadBoard';
import DocumentSettingsView from './DocumentSettingsView';

const SubcontractorLoadsView = lazy(() => import('./SubcontractorLoadsView'));
const WhatsAppChatsView = lazy(() => import('./WhatsAppChatsView'));


const OperationsPortal: React.FC = () => {
    const { operationsSubView, handleOperationsSubViewChange, showModal, showToast } = useUIState();
    const {
        loadConfirmations, clients, suppliers,
        handleUpdateLoadConfirmation, handleCreateLoadConfirmation: createLoadCon
    } = useOperations();

    const navItems = [
        { view: 'dashboard', label: 'Dashboard' },
        { view: 'loadBoard', label: 'Load Board' },
        { view: 'subcontractorLoads', label: 'LoadCons' },
        { view: 'driverChats', label: 'Driver Chats' },
        { view: 'docSettings', label: 'Doc Settings' },
    ];

    const handleNewTransportOrder = () => showModal('transportOrder', {
        onSubmit: async (data: any) => {
            const result = await createLoadCon(data);
            if (result.ok) showToast(`Transport Order ${result.value!.loadConNumber} created.`);
            else showToast(`Failed to create Transport Order: ${result.error}`);
            return result;
        },
    });

    const renderView = () => {
        switch (operationsSubView) {
            case 'subcontractorLoads': return <Suspense fallback={<div>Loading...</div>}><SubcontractorLoadsView loadConfirmations={loadConfirmations} suppliers={suppliers} clients={clients} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} /></Suspense>;
            case 'loadBoard': return <LoadBoard />;
            case 'driverChats': return <Suspense fallback={<div>Loading…</div>}><WhatsAppChatsView /></Suspense>;
            case 'docSettings': return <DocumentSettingsView />;
            case 'dashboard':
            default:
                return <OperationsDashboard />;
        }
    };
    
    return (
        <div className="bg-slate-50 text-slate-800 rounded-2xl p-5 -m-2 min-h-[calc(100vh-7rem)] border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-1 overflow-x-auto bg-slate-200/70 p-1 rounded-xl">
                    {navItems.map(item => (
                        <button key={item.view} onClick={() => handleOperationsSubViewChange(item.view as any)}
                            className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition ${operationsSubView === item.view ? 'bg-[#13294b] text-white shadow' : 'text-slate-600 hover:bg-white'}`}>
                            {item.label}
                        </button>
                    ))}
                </div>
                <button onClick={handleNewTransportOrder}
                    className="shrink-0 bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow transition active:scale-95">
                    + New Transport Order
                </button>
            </div>
            {renderView()}
        </div>
    );
};

export default OperationsPortal;
