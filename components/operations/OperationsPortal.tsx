
import React, { lazy, Suspense } from 'react';
import { useUIState, useOperations, useVehicles, useAuth } from '../../contexts/AppContexts';
import LoadBoard from './LoadBoard';
import DocumentSettingsView from './DocumentSettingsView';

const SubcontractorLoadsView = lazy(() => import('./SubcontractorLoadsView'));
const WhatsAppChatsView = lazy(() => import('./WhatsAppChatsView'));
const ShipmentsBoard = lazy(() => import('./ShipmentsBoard'));
const ContainersView = lazy(() => import('./ContainersView'));
const EmailLogView = lazy(() => import('./EmailLogView'));
const OperationsOverview = lazy(() => import('./OperationsOverview'));
const ImportsBoard = lazy(() => import('./ImportsBoard'));
const DailyPlanningView = lazy(() => import('./DailyPlanningView'));
const BrokingDashboard = lazy(() => import('./BrokingDashboard'));
const DailyShipmentsOverview = lazy(() => import('./DailyShipmentsOverview'));
const MonthlyLoadcons = lazy(() => import('./MonthlyLoadcons'));
const TransporterLoadCons = lazy(() => import('./TransporterLoadCons'));
const LclStatusReport = lazy(() => import('./LclStatusReport'));
const DeliveriesDayView = lazy(() => import('./DeliveriesDayView'));
const OperationsDay = lazy(() => import('./OperationsDay'));


const OperationsPortal: React.FC = () => {
    const { currentView, operationsSubView, handleOperationsSubViewChange, showModal, showToast } = useUIState();
    const {
        loadConfirmations, clients, suppliers, users, manifests, tripSheets,
        handleUpdateLoadConfirmation, handleCreateLoadConfirmation: createLoadCon,
        handleCreateManifest, handleCreateTripSheet,
    } = useOperations() as any;
    const { vehicles = [] } = (useVehicles() as any) || {};
    const { hasPermission } = useAuth();
    // LoadCons-only operators: see just Load Board / LoadCons / Deliveries-POD.
    const restricted = hasPermission('access_loadcons') && !hasPermission('access_operations');
    const RESTRICTED_TABS = [
        { view: 'loadBoard', label: 'Load Board', group: 'work' },
        { view: 'subcontractorLoads', label: 'LoadCons', group: 'work' },
        { view: 'deliveries', label: 'Deliveries / POD', group: 'work' },
    ];

    // Two SEPARATE business areas share this portal: Broking (brokered freight) and
    // Operations (own consolidation / line-haul). They stay distinct and are
    // monitored separately. Within each, tabs are grouped by what you're doing:
    // DASHBOARD (KPIs) · WORK (operate) · TRACK (snapshots) · REPORTS (tables).
    const BROKING_TABS = [
        { view: 'dashboard', label: 'Dashboard', group: 'dashboard' },
        { view: 'loadBoard', label: 'Load Board', group: 'work' },
        { view: 'subcontractorLoads', label: 'LoadCons', group: 'work' },
        { view: 'driverChats', label: 'Driver Chats', group: 'work' },
        { view: 'deliveries', label: 'Deliveries / POD', group: 'track' },
        { view: 'transporterLoads', label: 'By Transporter', group: 'reports' },
        { view: 'monthlyLoadcons', label: 'Month View', group: 'reports' },
        { view: 'emailLog', label: 'Emails', group: 'reports' },
        { view: 'docSettings', label: 'Doc Settings', group: 'reports' },
    ];
    const OPS_TABS = [
        { view: 'opsDashboard', label: 'Dashboard', group: 'dashboard' },
        { view: 'opsDay', label: 'Day', group: 'work' },
        { view: 'shipments', label: 'Shipments', group: 'work' },
        { view: 'planning', label: 'Planning', group: 'work' },
        { view: 'imports', label: 'Imports', group: 'work' },
        { view: 'lclStatus', label: 'Status Report', group: 'work' },
        { view: 'containers', label: 'Containers', group: 'work' },
        { view: 'dailyOverview', label: 'Daily Overview', group: 'track' },
        { view: 'transporterLoads', label: 'By Transporter', group: 'reports' },
    ];
    const GROUPS: { key: string; label: string }[] = [
        { key: 'dashboard', label: 'Dashboard' }, { key: 'work', label: 'Work' },
        { key: 'track', label: 'Track' }, { key: 'reports', label: 'Reports' },
    ];
    // The sidebar has two flat tabs — Broking and Operations — that both open
    // this portal. The current view decides which area's tab strip to show; the
    // active sub-tab falls back to that area's first tab when switching across.
    const isOps = currentView === 'operations' && !restricted;
    const navItems = restricted ? RESTRICTED_TABS : (isOps ? OPS_TABS : BROKING_TABS);
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
            case 'opsDay': return <Suspense fallback={<div>Loading…</div>}><OperationsDay /></Suspense>;
            case 'shipments': return <Suspense fallback={<div>Loading…</div>}><ShipmentsBoard /></Suspense>;
            case 'containers': return <Suspense fallback={<div>Loading…</div>}><ContainersView /></Suspense>;
            case 'imports': return <Suspense fallback={<div>Loading…</div>}><ImportsBoard /></Suspense>;
            case 'planning': return <Suspense fallback={<div>Loading…</div>}><DailyPlanningView loadConfirmations={loadConfirmations} vehicles={vehicles} users={users || []} clients={clients} manifests={manifests || []} tripSheets={tripSheets || []} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} onCreateManifest={handleCreateManifest} onCreateTripSheet={handleCreateTripSheet} onOpenModal={showModal} /></Suspense>;
            case 'driverChats': return <Suspense fallback={<div>Loading…</div>}><WhatsAppChatsView /></Suspense>;
            case 'emailLog': return <Suspense fallback={<div>Loading…</div>}><EmailLogView /></Suspense>;
            case 'docSettings': return <DocumentSettingsView />;
            case 'opsDashboard': return <Suspense fallback={<div>Loading…</div>}><OperationsOverview /></Suspense>;
            case 'dailyOverview': return <Suspense fallback={<div>Loading…</div>}><DailyShipmentsOverview /></Suspense>;
            case 'monthlyLoadcons': return <Suspense fallback={<div>Loading…</div>}><MonthlyLoadcons /></Suspense>;
            case 'transporterLoads': return <Suspense fallback={<div>Loading…</div>}><TransporterLoadCons /></Suspense>;
            case 'lclStatus': return <Suspense fallback={<div>Loading…</div>}><LclStatusReport /></Suspense>;
            case 'deliveries': return <Suspense fallback={<div>Loading…</div>}><DeliveriesDayView /></Suspense>;
            case 'dashboard':
            default:
                return <Suspense fallback={<div>Loading…</div>}><BrokingDashboard /></Suspense>;
        }
    };
    
    return (
        <div className="bg-slate-50 text-slate-800 rounded-2xl p-5 -m-2 min-h-[calc(100vh-7rem)] border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${isOps ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                        {isOps ? 'Operations' : 'Broking'}
                    </span>
                <div className="flex items-stretch gap-1 overflow-x-auto bg-slate-200/70 p-1 rounded-xl">
                    {GROUPS.map((g, gi) => {
                        const groupTabs = navItems.filter(t => (t as any).group === g.key);
                        if (!groupTabs.length) return null;
                        return (
                            <div key={g.key} className={`flex items-center gap-1 ${gi > 0 ? 'pl-1 ml-1 border-l border-slate-300/70' : ''}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 hidden lg:inline">{g.label}</span>
                                {groupTabs.map(item => (
                                    <button key={item.view} onClick={() => handleOperationsSubViewChange(item.view as any)}
                                        className={`px-3.5 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition ${activeTab === item.view ? 'bg-[#13294b] text-white shadow' : 'text-slate-600 hover:bg-white'}`}>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {isOps ? (
                        <>
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
