
import React, { useState, lazy, Suspense } from 'react';
import { useUIState, useOperations, useAuth, useVehicles } from '../../contexts/AppContexts';
import OperationsDashboard from './OperationsDashboard';
import DailyPlanningView from './DailyPlanningView';
import LiveFleetMap from './LiveFleetMap';
import CollectionsView from './CollectionsView';
import DeliveriesView from './DeliveriesView';
import RoutePlanner from '../RoutePlanner';
import QuotesView from './QuotesView';
import ClientManagementView from './ClientManagementView';
import { Quote, LoadConfirmation } from '../../types';
import SupplierOnboardingView from './SupplierOnboardingView';

const SubcontractorLoadsView = lazy(() => import('./SubcontractorLoadsView'));
const SubcontractorManagementView = lazy(() => import('./SupplierManagementView'));


const OperationsPortal: React.FC = () => {
    const { currentUser } = useAuth();
    const { operationsSubView, handleOperationsSubViewChange, showModal, showToast } = useUIState();
    const {
        users, loadConfirmations, tripSheets, clients, suppliers, quotes, manifests,
        handleUpdateLoadConfirmation, handleCreateQuote, handleCreateManifest, handleCreateTripSheet, handleCreateLoadConfirmation: createLoadCon
    } = useOperations();
    const { vehicles } = useVehicles();

    const navItems = [
        { view: 'dashboard', label: 'Dashboard' },
        { view: 'clients', label: 'Clients' },
        { view: 'subcontractors', label: 'Subcontractors' },
        { view: 'subcontractorLoads', label: 'Subcontractor Loads' },
        { view: 'supplierOnboarding', label: 'Supplier Onboarding' },
        { view: 'dailyPlanning', label: 'Daily Planning' },
        { view: 'collections', label: 'Collections' },
        { view: 'deliveries', label: 'Deliveries' },
        { view: 'quotes', label: 'Quotes' },
        { view: 'fleetMap', label: 'Fleet Map' },
        { view: 'routePlanner', label: 'Route Planner' },
    ];

    const handleNewTransportOrder = () => showModal('transportOrder', {
        onSubmit: async (data: any) => {
            const result = await createLoadCon(data);
            if (result.ok) showToast(`Transport Order ${result.value!.loadConNumber} created.`);
            else showToast(`Failed to create Transport Order: ${result.error}`);
            return result;
        },
    });

    const handleAssign = (lc: LoadConfirmation) => showModal('assignLoadCon', { loadCon: lc });
    const handleNewBooking = () => showModal('createBooking', {
        clients,
        onSubmit: async (data: any) => {
            const result = await createLoadCon(data);
            if (result.ok) showToast(`Load Confirmation ${result.value!.loadConNumber} created.`);
            else showToast(`Failed to create load confirmation: ${result.error}`);
        },
    });


    const renderView = () => {
        switch (operationsSubView) {
            case 'dailyPlanning': return <DailyPlanningView loadConfirmations={loadConfirmations} vehicles={vehicles} users={users} clients={clients} manifests={manifests} tripSheets={tripSheets} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} onCreateManifest={handleCreateManifest} onCreateTripSheet={handleCreateTripSheet} onOpenModal={(type, payload) => showModal(type, payload)} />;
            case 'fleetMap': return <LiveFleetMap vehicles={vehicles} users={users} loadConfirmations={loadConfirmations} />;
            case 'collections': return <CollectionsView currentUser={currentUser!} loadConfirmations={loadConfirmations} clients={clients} suppliers={suppliers} vehicles={vehicles} users={users} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} onAssignClick={handleAssign} onNewBookingClick={handleNewBooking} />;
            case 'deliveries': return <DeliveriesView currentUser={currentUser!} loadConfirmations={loadConfirmations} clients={clients} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} />;
            case 'subcontractorLoads': return <Suspense fallback={<div>Loading...</div>}><SubcontractorLoadsView loadConfirmations={loadConfirmations} suppliers={suppliers} clients={clients} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} /></Suspense>;
            case 'subcontractors': return <Suspense fallback={<div>Loading...</div>}><SubcontractorManagementView /></Suspense>;
            case 'supplierOnboarding': return <SupplierOnboardingView />;
            case 'routePlanner': return <RoutePlanner />;
            case 'quotes': return <QuotesView quotes={quotes} clients={clients} suppliers={suppliers} onShowPdf={(quote, client) => showModal('quotePdf', { quote, client })}/>;
            case 'clients': return <ClientManagementView />;
            case 'dashboard':
            default:
                return <OperationsDashboard />;
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
