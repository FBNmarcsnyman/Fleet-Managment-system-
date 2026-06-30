
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth, useUIState, useOperations, useVehicles, useWorkshop } from './contexts/AppContexts';

import Login from './components/Login';
import ClientLogin from './components/ClientLogin';
import SupplierLogin from './components/SupplierLogin';
import DriverChecklistAuth from './components/DriverChecklistAuth';
const RigChecklistFlow = lazy(() => import('./components/RigChecklistFlow'));
import SupplierPODUploadView from './components/SupplierPODUploadView';
import ClientQuoteView from './components/ClientQuoteView';
import PublicPodUpload from './components/PublicPodUpload';
import CompleteCargoDetails from './components/CompleteCargoDetails';
import PublicLoad from './components/PublicLoad';
import PublicTerms from './components/PublicTerms';
import PublicRfqQuote from './components/PublicRfqQuote';
import SupplierRegister from './components/supplier/SupplierRegister';
import ClientRegister from './components/client/ClientRegister';
import MobileInspection from './components/MobileInspection';
import BreakdownTyre from './components/BreakdownTyre';
import DriverHub from './components/DriverHub';


import ManagementPortal from './components/ManagementPortal';
import FleetPortal from './components/FleetPortal';
import FuelPortal from './components/FuelPortal';
import OperationsPortal from './components/operations/OperationsPortal';
import ClientsPortal from './components/operations/ClientsPortal';
import TransportersPortal from './components/operations/TransportersPortal';
import DeliveriesPod from './components/operations/DeliveriesPod';
import QuotesPortal from './components/operations/QuotesPortal';
import WorkshopPortal from './components/WorkshopPortal';
import FinancePortal from './components/FinancePortal';
import IncidentManagement from './components/IncidentManagement';
import HRPortal from './components/HRPortal';
import ComplianceHub from './components/ComplianceHub';
import UserManagement from './components/UserManagement';
import Settings from './components/Settings';
import DriverDashboard from './components/DriverDashboard';
import ClientPortal from './components/ClientPortal';
import SupplierPortal from './components/SupplierPortal';

import Sidebar from './components/shared/Sidebar';
import Topbar from './components/shared/Topbar';
import CollectFab from './components/shared/CollectFab';
import VersionWatcher from './components/shared/VersionWatcher';
import LiveAssistant from './components/LiveAssistant';
import HelpChat from './components/HelpChat';
import Modal from './components/Modal';
import Toast from './components/Toast';
import { User, Vehicle } from './types';

// Lazy load modals
const AddVehicleForm = lazy(() => import('./components/AddVehicleForm'));
const AddCostForm = lazy(() => import('./components/AddCostForm'));
const AddFuelEntryForm = lazy(() => import('./components/AddFuelEntryForm'));
const AddRecurringCostForm = lazy(() => import('./components/AddRecurringCostForm'));
const AddRevenueForm = lazy(() => import('./components/AddRevenueForm'));
const AddServiceEntryForm = lazy(() => import('./components/AddServiceEntryForm'));
const AddServiceIntervalForm = lazy(() => import('./components/AddServiceIntervalForm'));
const AddUserForm = lazy(() => import('./components/AddUserForm'));
const AddPartForm = lazy(() => import('./components/AddPartForm'));
const AddPlannedServiceForm = lazy(() => import('./components/AddPlannedServiceForm'));
const AddTireForm = lazy(() => import('./components/AddTireForm'));
const AddTireInspectionForm = lazy(() => import('./components/AddTireInspectionForm'));
const AssignLoadConModal = lazy(() => import('./components/operations/AssignLoadConModal'));
const AssignPartModal = lazy(() => import('./components/AssignPartModal'));
const CreateManifestModal = lazy(() => import('./components/operations/CreateManifestModal'));
const CreatePurchaseRequestModal = lazy(() => import('./components/CreatePurchaseRequestModal'));
const CreateQuoteForm = lazy(() => import('./components/operations/CreateQuoteForm'));
const ProformaModal = lazy(() => import('./components/operations/ProformaModal'));
const CaptureWaybillEventModal = lazy(() => import('./components/operations/CaptureWaybillEventModal'));
const CreateBookingForm = lazy(() => import('./components/operations/CreateBookingForm'));
const TransportOrderForm = lazy(() => import('./components/operations/TransportOrderForm'));
const QuickCollectionForm = lazy(() => import('./components/operations/QuickCollectionForm'));
const CaptureLoadModal = lazy(() => import('./components/operations/CaptureLoadModal'));
const AssignFbnModal = lazy(() => import('./components/operations/AssignFbnModal'));
const DispatchModal = lazy(() => import('./components/operations/DispatchModal'));
const DriverDocuments = lazy(() => import('./components/fleet/DriverDocuments'));
const BulkCollectionForm = lazy(() => import('./components/operations/BulkCollectionForm'));
const PickListManager = lazy(() => import('./components/operations/PickListManager'));
const LogContainerModal = lazy(() => import('./components/operations/LogContainerModal'));
const CartageAdviceScanModal = lazy(() => import('./components/operations/CartageAdviceScanModal'));
const LclShipmentModal = lazy(() => import('./components/operations/LclShipmentModal'));
const LclControllerModal = lazy(() => import('./components/operations/LclControllerModal'));
const BrokingCollectionForm = lazy(() => import('./components/operations/BrokingCollectionForm'));
const PartnerDetailModal = lazy(() => import('./components/operations/PartnerDetailModal'));
const ManifestDoc = lazy(() => import('./components/operations/ManifestDoc'));
const TripSheetDoc = lazy(() => import('./components/operations/TripSheetDoc'));
const SplitLoadModal = lazy(() => import('./components/operations/SplitLoadModal'));
const OfferLoadModal = lazy(() => import('./components/operations/OfferLoadModal'));
const CollectHome = lazy(() => import('./components/operations/CollectHome'));
const CreateTripSheetModal = lazy(() => import('./components/operations/CreateTripSheetModal'));
const DismountTireModal = lazy(() => import('./components/DismountTireModal'));
const LinkTrailerModal = lazy(() => import('./components/LinkTrailerModal'));
const MountTireModal = lazy(() => import('./components/MountTireModal'));
const ReceiveManifestModal = lazy(() => import('./components/operations/ReceiveManifestModal'));
const ReceiveRetreadModal = lazy(() => import('./components/ReceiveRetreadModal'));
const ScrapTireModal = lazy(() => import('./components/ScrapTireModal'));
const SendForRetreadModal = lazy(() => import('./components/SendForRetreadModal'));
const AddClientForm = lazy(() => import('./components/operations/AddClientForm'));
const AddDriverForm = lazy(() => import('./components/fleet/AddDriverForm'));
const LoadDocumentsModal = lazy(() => import('./components/operations/LoadDocumentsModal'));
const LoadDetailModal = lazy(() => import('./components/operations/LoadDetailModal'));
const QRCodeModal = lazy(() => import('./components/QRCodeModal'));
const FleetQrSheetModal = lazy(() => import('./components/fleet/FleetQrSheetModal'));
const RigTrailersModal = lazy(() => import('./components/RigTrailersModal'));
const AddSupplierForm = lazy(() => import('./components/operations/AddSupplierForm'));
const BulkImportSuppliersModal = lazy(() => import('./components/operations/BulkImportSuppliersModal'));
const RateSupplierModal = lazy(() => import('./components/RateSupplierModal'));
const QuotePDFModal = lazy(() => import('./components/operations/QuotePDFModal'));
const AIDispatchAssistantModal = lazy(() => import('./components/operations/AIDispatchAssistantModal'));
const UpdateJobModal = lazy(() => import('./components/operations/UpdateJobModal'));
const DriverPODModal = lazy(() => import('./components/DriverPODModal'));
const PerformChecklistForm = lazy(() => import('./components/PerformChecklistForm'));
const CreateJobCardModal = lazy(() => import('./components/workshop/CreateJobCardModal'));
const SupplierLoadConPDFModal = lazy(() => import('./components/operations/SupplierLoadConPDFModal'));
const ViewPodModal = lazy(() => import('./components/operations/ViewPodModal'));
const InvoicePDFModal = lazy(() => import('./components/operations/InvoicePDFModal'));
const MoveBranchModal = lazy(() => import('./components/fleet/MoveBranchModal'));
const AssignDriverModal = lazy(() => import('./components/AssignDriverModal'));
const BulkServiceIntervalModal = lazy(() => import('./components/fleet/BulkServiceIntervalModal'));
const SetBudgetModal = lazy(() => import('./components/finance/SetBudgetModal'));
const AITriageModal = lazy(() => import('./components/workshop/AITriageModal'));
const JobCardDetailModal = lazy(() => import('./components/workshop/JobCardDetailModal'));
const SupplierApplicationDetailModal = lazy(() => import('./components/operations/SupplierApplicationDetailModal'));
const BulkImportAssetsModal = lazy(() => import('./components/fleet/BulkImportAssetsModal'));
const BulkAssignDriversModal = lazy(() => import('./components/fleet/BulkAssignDriversModal'));
const BulkFuelImportModal = lazy(() => import('./components/fleet/BulkFuelImportModal'));
const ConnectAssetSheetModal = lazy(() => import('./components/fleet/ConnectAssetSheetModal'));
const BulkImportCostsModal = lazy(() => import('./components/fleet/BulkImportCostsModal'));
const QuickBooksSyncModal = lazy(() => import('./components/fleet/QuickBooksSyncModal'));


// A mapping of modal types to their components
const ModalRegistry: { [key: string]: React.LazyExoticComponent<React.FC<any>> } = {
    addVehicle: AddVehicleForm,
    addCost: AddCostForm,
    addFuel: AddFuelEntryForm,
    addRecurringCost: AddRecurringCostForm,
    addRevenue: AddRevenueForm,
    addService: AddServiceEntryForm,
    addInterval: AddServiceIntervalForm,
    addUser: AddUserForm,
    addPart: AddPartForm,
    addPlannedService: AddPlannedServiceForm,
    addTire: AddTireForm,
    addTireInspection: AddTireInspectionForm,
    assignLoadCon: AssignLoadConModal,
    assignPart: AssignPartModal,
    createManifest: CreateManifestModal,
    createPurchaseRequest: CreatePurchaseRequestModal,
    createQuote: CreateQuoteForm,
    proforma: ProformaModal,
    captureWaybill: CaptureWaybillEventModal,
    createBooking: CreateBookingForm,
    transportOrder: TransportOrderForm,
    quickCollection: QuickCollectionForm,
    captureLoad: CaptureLoadModal,
    assignFbn: AssignFbnModal,
    dispatchLoad: DispatchModal,
    driverDocs: DriverDocuments,
    bulkCollection: BulkCollectionForm,
    pickLists: PickListManager,
    logContainer: LogContainerModal,
    cartageScan: CartageAdviceScanModal,
    lclShipment: LclShipmentModal,
    lclController: LclControllerModal,
    brokingCollection: BrokingCollectionForm,
    partnerDetail: PartnerDetailModal,
    manifestDoc: ManifestDoc,
    tripSheetDoc: TripSheetDoc,
    splitLoad: SplitLoadModal,
    offerLoad: OfferLoadModal,
    editQuote: CreateQuoteForm,
    createTripSheet: CreateTripSheetModal,
    dismountTire: DismountTireModal,
    linkTrailer: LinkTrailerModal,
    mountTire: MountTireModal,
    receiveManifest: ReceiveManifestModal,
    receiveRetread: ReceiveRetreadModal,
    scrapTire: ScrapTireModal,
    sendForRetread: SendForRetreadModal,
    addClient: AddClientForm,
    addDriver: AddDriverForm,
    loadDocuments: LoadDocumentsModal,
    loadDetail: LoadDetailModal,
    qrCode: QRCodeModal,
    qrSheet: FleetQrSheetModal,
    rigTrailers: RigTrailersModal,
    addSupplier: AddSupplierForm,
    bulkImportSuppliers: BulkImportSuppliersModal,
    rateSupplier: RateSupplierModal,
    quotePdf: QuotePDFModal,
    aiDispatchAssistant: AIDispatchAssistantModal,
    updateJob: UpdateJobModal,
    pod: DriverPODModal,
    createJobCard: CreateJobCardModal,
    supplierLoadConPdf: SupplierLoadConPDFModal,
    viewPod: ViewPodModal,
    invoicePdf: InvoicePDFModal,
    moveBranch: MoveBranchModal,
    assignDriver: AssignDriverModal,
    bulkServiceInterval: BulkServiceIntervalModal,
    setBudget: SetBudgetModal,
    aiTriage: AITriageModal,
    jobCardDetail: JobCardDetailModal,
    supplierApplicationDetail: SupplierApplicationDetailModal,
    bulkImportAssets: BulkImportAssetsModal,
    bulkAssignDrivers: BulkAssignDriversModal,
    bulkFuelImport: BulkFuelImportModal,
    connectAssetSheet: ConnectAssetSheetModal,
    bulkImportCosts: BulkImportCostsModal,
    quickbooksSync: QuickBooksSyncModal,
};

const ModalSizeRegistry: { [key: string]: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' } = {
    createQuote: '5xl',
    editQuote: '5xl',
    createBooking: '3xl',
    transportOrder: '5xl',
    qrSheet: '4xl',
    quickCollection: 'lg',
    captureLoad: 'lg',
    assignFbn: 'lg',
    bulkCollection: '4xl',
    pickLists: 'lg',
    logContainer: '3xl',
    cartageScan: '3xl',
    lclShipment: '4xl',
    lclController: 'lg',
    brokingCollection: 'lg',
    partnerDetail: '2xl',
    manifestDoc: '3xl',
    tripSheetDoc: '4xl',
    splitLoad: '4xl',
    offerLoad: '3xl',
    quotePdf: '4xl',
    proforma: '2xl',
    captureWaybill: '2xl',
    supplierLoadConPdf: '4xl',
    loadDocuments: '5xl',
    loadDetail: '5xl',
    invoicePdf: '4xl',
    viewPod: '2xl',
    jobCardDetail: '4xl',
    aiTriage: '4xl',
    aiDispatchAssistant: '4xl',
    supplierApplicationDetail: '4xl',
    bulkImportAssets: '2xl',
    connectAssetSheet: '2xl',
    bulkImportCosts: '2xl',
    quickbooksSync: '2xl',
    assignDriver: 'md',
    bulkServiceInterval: '2xl',
    bulkAssignDrivers: 'md',
    bulkFuelImport: '5xl',
};


const App: React.FC = () => {
    const { currentUser, currentViewOverride, hasPermission, viewingClientAsAdmin, viewingSupplierAsAdmin } = useAuth();
    const { currentView, isLiveAssistantOpen, setIsLiveAssistantOpen, modal, hideModal, toastMessage, dismissToast, showToast, handleViewChange } = useUIState();
    const { quotes, clients, handleAcceptQuote, handleRejectQuote, handleAddChecklistSubmission } = useOperations();
    const { vehicles, users, checklistTemplates, drivers } = useVehicles();
    const [checklistFlow, setChecklistFlow] = useState<{ step: 'vehicleScan' | 'form', user: User, vehicle: Vehicle } | null>(null);

    const urlParams = new URLSearchParams(window.location.search);
    const publicQuoteId = urlParams.get('viewQuote');
    const checklistVehicleId = urlParams.get('checklist');
    const podLoadId = urlParams.get('pod');
    const completeLoadId = urlParams.get('complete');
    const trackLoadId = urlParams.get('track');
    const acceptLoadId = urlParams.get('accept');
    const updateLoadId = urlParams.get('update');
    const showTerms = urlParams.get('tcs');
    const portal = urlParams.get('portal');
    const inviteToken = urlParams.get('invite');
    const rfqToken = urlParams.get('rfq');
    // Deep-link from the "Open Quotes to price" email. The login redirect strips
    // URL params, so stash the quote id in sessionStorage (survives login) and
    // route to Quotes once authenticated; QuotesView opens that quote's detail.
    const urlQuote = urlParams.get('quote');
    useEffect(() => { if (urlQuote) { try { sessionStorage.setItem('fbn_pendingQuote', urlQuote); } catch { /* ignore */ } } }, [urlQuote]);
    const pendingQuote = urlQuote || (() => { try { return sessionStorage.getItem('fbn_pendingQuote') || ''; } catch { return ''; } })();
    useEffect(() => { if (pendingQuote && currentUser) handleViewChange('quotes'); }, [pendingQuote, currentUser]);

    // Public Subcontractor Terms & Conditions page (linked from LoadCons/emails).
    if (showTerms) {
        return <PublicTerms />;
    }

    // Public, no-login 5-step subcontractor registration: the /supplier-register
    // page, the ?invite=<token> link we email to a carrier, and the legacy
    // ?portal=become-supplier link all open the new flow.
    if (window.location.pathname === '/supplier-register' || inviteToken || portal === 'become-supplier') {
        return <SupplierRegister inviteToken={inviteToken} />;
    }

    // Public, no-login client self-registration: /client-register (and the legacy
    // ?portal=become-client link) open the registration form.
    if (window.location.pathname === '/client-register' || portal === 'become-client') {
        return <ClientRegister />;
    }

    // Public, no-login carrier quote reply from the ?rfq=<token> link in the RFQ email.
    if (rfqToken) {
        return <PublicRfqQuote token={rfqToken} />;
    }

    // Public, no-login POD upload from the link in our POD-request email.
    if (podLoadId) {
        return <PublicPodUpload loadId={podLoadId} />;
    }
    // Public "complete cargo details" page from the depot-arrival email link.
    if (completeLoadId) {
        return <CompleteCargoDetails loadId={completeLoadId} />;
    }
    // Public client tracking page.
    if (trackLoadId) {
        return <PublicLoad loadId={trackLoadId} mode="track" />;
    }
    // Public carrier acceptance page (from the LoadCon email).
    if (acceptLoadId) {
        return <PublicLoad loadId={acceptLoadId} mode="accept" />;
    }
    // Public supplier/controller update portal — push status updates through the trip.
    if (updateLoadId) {
        return <PublicLoad loadId={updateLoadId} mode="update" />;
    }

    if (publicQuoteId) {
        const quote = (quotes || []).find((q: any) => q.id === publicQuoteId);
        if (quote) {
            const client = (clients || []).find((c: any) => c.id === quote.clientId);
            if (client) {
                return <ClientQuoteView quote={quote} client={client} onAccept={handleAcceptQuote} onReject={handleRejectQuote} />;
            }
        }
        return <div className="text-center p-8 text-red-400">Quote not found or invalid link.</div>;
    }
    
    // Scan a vehicle/trailer QR (any device, no login needed) → the mobile inspection
    // flow (Workshop Part 2). Self-contained: loads the vehicle + template via edge fns.
    if (checklistVehicleId) {
        return <MobileInspection uuid={checklistVehicleId} />;
    }
    // Public, no-login road breakdown tyre-change logging (Workshop Part 4).
    if (window.location.pathname === '/breakdown/tyre') {
        return <BreakdownTyre />;
    }
    // Public, no-login Driver Hub: one easy page for inspection / breakdown / incident / logs.
    if (window.location.pathname === '/driver') {
        return <DriverHub />;
    }

    if (checklistFlow && checklistFlow.step === 'form') {
        return (
            <Suspense fallback={<div className="text-white text-center p-8">Loading Checklist…</div>}>
                <RigChecklistFlow
                    startVehicle={checklistFlow.vehicle}
                    user={checklistFlow.user}
                    vehicles={vehicles || []}
                    templates={checklistTemplates}
                    onSubmitUnit={(data, user) => handleAddChecklistSubmission(data, user)}
                    onDone={() => {
                        showToast('Rig checklist submitted. Thank you!');
                        setChecklistFlow(null);
                        window.history.pushState({}, '', window.location.pathname);
                    }}
                    onCancel={() => {
                        setChecklistFlow(null);
                        window.history.pushState({}, '', window.location.pathname);
                    }}
                />
            </Suspense>
        );
    }

    if (!currentUser) {
        if (portal === 'client') return <ClientLogin />;
        if (portal === 'supplier') return <SupplierLogin />;
        return <Login />;
    }
    
    // Admin "view portal as" — render the client/supplier portal over the top
    // (the portals read the impersonated user and show a "Return to Admin" exit).
    if (viewingClientAsAdmin) return <ClientPortal />;
    if (viewingSupplierAsAdmin) return <SupplierPortal />;

    if (currentUser.role === 'Client') return <ClientPortal />;
    if (currentUser.role === 'Supplier') return <SupplierPortal />;
    if (currentUser.role === 'Driver') return <DriverDashboard />;


    // The management dashboard is for admins/managers only. Anyone without the
    // permission who lands here (e.g. a Staff default view) is shown the fleet
    // view instead of the company-wide management overview.
    const managementView = hasPermission('access_management') ? <ManagementPortal /> : <FleetPortal />;
    const renderView = () => {
        // A pending quote deep-link forces the Quotes screen even if the saved
        // view hasn't caught up yet (survives the post-login render).
        switch (pendingQuote ? 'quotes' : currentView) {
            case 'management': return managementView;
            case 'fleet': return <FleetPortal />;
            case 'fuel': return <FuelPortal />;
            case 'operations': return <OperationsPortal />;
            case 'broking': return <OperationsPortal />;
            case 'collectHome': return <Suspense fallback={<div />}><CollectHome /></Suspense>;
            case 'partners': return <ClientsPortal />;
            case 'transporters': return <TransportersPortal />;
            case 'accountsPods': return <Suspense fallback={<div />}><DeliveriesPod lens="all" /></Suspense>;
            case 'quotes': return <QuotesPortal />;
            case 'workshop': return <WorkshopPortal />;
            case 'finance': return <FinancePortal />;
            case 'incidentManagement': return <IncidentManagement />;
            case 'hr': return <HRPortal />;
            case 'compliance': return <ComplianceHub />;
            case 'userManagement': return <UserManagement />;
            case 'settings': return <Settings />;
            case 'driverDashboard': return <DriverDashboard />;
            default: return managementView;
        }
    };

    const renderModalContent = () => {
        if (!modal.isOpen || !modal.type) return null;
        const ModalComponent = ModalRegistry[modal.type];
        if (!ModalComponent) {
            console.error(`Modal type "${modal.type}" not found in registry.`);
            return <div>Error: Modal not found.</div>;
        }
        return <ModalComponent {...modal.payload} />;
    };

    return (
        <div className="bg-gray-900 min-h-screen flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                <Topbar />
                <main className="flex-1 w-full min-w-0 overflow-x-hidden">
                    {/* Centre content at a sensible max width so it adapts to the
                        screen instead of stretching edge-to-edge on wide monitors
                        (and stays full-width with padding on laptops/mobile). */}
                    <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 md:px-6 lg:px-8 py-5 md:py-7">
                        {renderView()}
                    </div>
                </main>
            </div>
            <LiveAssistant isOpen={isLiveAssistantOpen} onClose={() => setIsLiveAssistantOpen(false)} />
            <HelpChat />
            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 text-white">Loading Modal...</div>}>
                <Modal 
                    isOpen={modal.isOpen} 
                    onClose={hideModal} 
                    size={modal.type ? ModalSizeRegistry[modal.type] || '2xl' : '2xl'}
                >
                    {renderModalContent()}
                </Modal>
            </Suspense>
            <Toast message={toastMessage} onDismiss={dismissToast} />
            <CollectFab />
            <VersionWatcher />
        </div>
    );
};

export default App;
