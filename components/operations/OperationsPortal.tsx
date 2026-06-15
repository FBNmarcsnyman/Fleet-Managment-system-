
import React, { lazy, Suspense } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import OperationsDashboard from './OperationsDashboard';
import LoadBoard from './LoadBoard';

const SubcontractorLoadsView = lazy(() => import('./SubcontractorLoadsView'));


const OperationsPortal: React.FC = () => {
    const { operationsSubView, handleOperationsSubViewChange, showModal, showToast } = useUIState();
    const {
        loadConfirmations, clients, suppliers,
        handleUpdateLoadConfirmation, handleCreateLoadConfirmation: createLoadCon
    } = useOperations();

    const navItems = [
        { view: 'loadBoard', label: 'Load Board' },
        { view: 'subcontractorLoads', label: 'LoadCons' },
        { view: 'dashboard', label: 'Dashboard' },
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
            case 'dashboard': return <OperationsDashboard />;
            case 'loadBoard':
            default:
                return <LoadBoard />;
        }
    };
    
    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center space-x-1 overflow-x-auto">
                    {navItems.map(item => (
                        <button key={item.view} onClick={() => handleOperationsSubViewChange(item.view as any)}
                            className={`px-4 py-2 text-sm font-semibold rounded-md whitespace-nowrap ${operationsSubView === item.view ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                            {item.label}
                        </button>
                    ))}
                </div>
                <button onClick={handleNewTransportOrder}
                    className="shrink-0 bg-brand-secondary hover:bg-brand-primary text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap shadow-lg transition active:scale-95">
                    + New Transport Order
                </button>
            </div>
            {renderView()}
        </div>
    );
};

export default OperationsPortal;
