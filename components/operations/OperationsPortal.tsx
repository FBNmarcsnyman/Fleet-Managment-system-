
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useUIState, useOperations, useVehicles, useAuth } from '../../contexts/AppContexts';
import LoadBoard from './LoadBoard';
import DocumentSettingsView from './DocumentSettingsView';

// Tab strip is grouped by what you're doing: Overview (KPIs) · Do (operate) · Track
// (snapshots) · Review (reports/config). Labels shown as dividers between groups.
const GROUP_LABEL: Record<string, string> = { dashboard: 'Overview', work: 'Do', track: 'Track', reports: 'Review' };

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
const DeliveriesPod = lazy(() => import('./DeliveriesPod'));
const OperationsDay = lazy(() => import('./OperationsDay'));
const OperationsManifests = lazy(() => import('./OperationsManifests'));
const OperationsTripSheets = lazy(() => import('./OperationsTripSheets'));
const LiveFleetMap = lazy(() => import('./LiveFleetMap'));


const OperationsPortal: React.FC = () => {
    const { currentView, operationsSubView, handleOperationsSubViewChange, showModal, showToast } = useUIState();
    const {
        loadConfirmations, clients, suppliers, users, manifests, tripSheets,
        handleUpdateLoadConfirmation, handleCreateLoadConfirmation: createLoadCon,
        handleCreateManifest, handleCreateTripSheet,
    } = useOperations() as any;
    const { vehicles = [] } = (useVehicles() as any) || {};
    const { hasPermission, currentUser, myHiddenTabs } = useAuth();
    // LoadCons-only operators: Broking limited to Load Board / LoadCons /
    // Deliveries-POD, and Operations limited to Dashboard / Day / Shipments /
    // Daily Overview. (They're pinned to their own floor by branch.)
    const restricted = hasPermission('access_loadcons') && !hasPermission('access_operations');
    const RESTRICTED_BROKING = [
        { view: 'loadBoard', label: 'Load Board', group: 'work' },
        { view: 'subcontractorLoads', label: 'LoadCons', group: 'work' },
        { view: 'deliveries', label: 'Deliveries / POD', group: 'work' },
        { view: 'pods', label: 'PODs', group: 'work' },
    ];
    const RESTRICTED_OPS = [
        { view: 'opsDashboard', label: 'Dashboard', group: 'dashboard' },
        { view: 'opsDay', label: 'Day', group: 'work' },
        { view: 'opsManifests', label: 'Manifests', group: 'work' },
        { view: 'opsTripSheets', label: 'Trip Sheets', group: 'work' },
        { view: 'shipments', label: 'Shipments', group: 'work' },
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
        { view: 'opsDashboard', label: 'Daily Overview', group: 'dashboard' },
        { view: 'opsDay', label: 'Day', group: 'work' },
        { view: 'opsManifests', label: 'Manifests', group: 'work' },
        { view: 'opsTripSheets', label: 'Trip Sheets', group: 'work' },
        { view: 'deliveries', label: 'Deliveries / POD', group: 'track' },
        { view: 'liveMap', label: '📍 Live Map', group: 'track' },
        { view: 'shipments', label: 'Shipments', group: 'work' },
        { view: 'imports', label: 'Imports', group: 'work' },
        { view: 'lclStatus', label: 'Status Report', group: 'work' },
        { view: 'containers', label: 'Containers', group: 'work' },
    ];
    // The sidebar has two flat tabs — Broking and Operations — that both open
    // this portal. The current view decides which area's tab strip to show; the
    // active sub-tab falls back to that area's first tab when switching across.
    const isOps = currentView === 'operations';
    const navItems = restricted
        ? (isOps ? RESTRICTED_OPS : RESTRICTED_BROKING)
        : (isOps ? OPS_TABS : BROKING_TABS);
    // Admin-set, server-stored tabs hidden for this role/depot (Admins/Super Admins see all).
    // Keys are section-namespaced; managed centrally in Users → Tab Access.
    const section = isOps ? 'operations' : 'broking';
    const isAdminRole = ['Admin', 'Super Admin'].includes(currentUser?.role as string);
    const isRoleHidden = (view: string) => !isAdminRole && (myHiddenTabs || []).includes(`${section}:${view}`);
    const visibleNav = navItems.filter(t => !isRoleHidden(t.view));
    const activeTab = visibleNav.some(t => t.view === operationsSubView) ? operationsSubView : (visibleNav[0]?.view || navItems[0].view);

    // Customisable tab strip — each user can hide tabs they don't use and reorder
    // them; saved per user + area (localStorage). Keeps the strip uncluttered
    // without removing anyone else's tabs.
    const tabArea = isOps ? 'ops' : 'broking';
    const prefKey = `fbnTabs_${tabArea}_${currentUser?.id || currentUser?.email || 'x'}`;
    const [customise, setCustomise] = useState(false);
    const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
    const [tabOrder, setTabOrder] = useState<string[]>([]);
    useEffect(() => {
        try { const p = JSON.parse(localStorage.getItem(prefKey) || '{}'); setHiddenTabs(p.hidden || []); setTabOrder(p.order || []); }
        catch { setHiddenTabs([]); setTabOrder([]); }
        setCustomise(false);
    }, [prefKey]);
    const savePrefs = (hidden: string[], order: string[]) => { setHiddenTabs(hidden); setTabOrder(order); try { localStorage.setItem(prefKey, JSON.stringify({ hidden, order })); } catch { /* ignore */ } };
    const orderedTabs = [...navItems].sort((a, b) => {
        const ia = tabOrder.indexOf(a.view), ib = tabOrder.indexOf(b.view);
        if (ia === -1 && ib === -1) return 0; if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
    });
    const baseOrder = orderedTabs.map(t => t.view);
    const stripTabs = customise ? orderedTabs : orderedTabs.filter(t => !hiddenTabs.includes(t.view) && !isRoleHidden(t.view));
    const moveTab = (view: string, dir: number) => { const arr = [...baseOrder]; const i = arr.indexOf(view), j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return;[arr[i], arr[j]] = [arr[j], arr[i]]; savePrefs(hiddenTabs, arr); };
    const toggleHide = (view: string) => savePrefs(hiddenTabs.includes(view) ? hiddenTabs.filter(v => v !== view) : [...hiddenTabs, view], baseOrder);

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
            case 'opsManifests': return <Suspense fallback={<div>Loading…</div>}><OperationsManifests /></Suspense>;
            case 'opsTripSheets': return <Suspense fallback={<div>Loading…</div>}><OperationsTripSheets /></Suspense>;
            case 'liveMap': return <Suspense fallback={<div>Loading…</div>}><LiveFleetMap loadConfirmations={loadConfirmations} users={users || []} vehicles={vehicles} /></Suspense>;
            case 'shipments': return <Suspense fallback={<div>Loading…</div>}><ShipmentsBoard /></Suspense>;
            case 'containers': return <Suspense fallback={<div>Loading…</div>}><ContainersView /></Suspense>;
            case 'imports': return <Suspense fallback={<div>Loading…</div>}><ImportsBoard /></Suspense>;
            case 'planning': return <Suspense fallback={<div>Loading…</div>}><DailyPlanningView loadConfirmations={loadConfirmations} vehicles={vehicles} users={users || []} clients={clients} manifests={manifests || []} tripSheets={tripSheets || []} onUpdateLoadConfirmation={handleUpdateLoadConfirmation} onCreateManifest={handleCreateManifest} onCreateTripSheet={handleCreateTripSheet} onOpenModal={showModal} /></Suspense>;
            case 'driverChats': return <Suspense fallback={<div>Loading…</div>}><WhatsAppChatsView /></Suspense>;
            case 'emailLog': return <Suspense fallback={<div>Loading…</div>}><EmailLogView /></Suspense>;
            case 'docSettings': return <DocumentSettingsView />;
            // Merged overview — the single Operations dashboard (was Dashboard + Daily Overview).
            case 'opsDashboard':
            case 'dailyOverview': return <Suspense fallback={<div>Loading…</div>}><DailyShipmentsOverview /></Suspense>;
            case 'monthlyLoadcons': return <Suspense fallback={<div>Loading…</div>}><MonthlyLoadcons /></Suspense>;
            case 'transporterLoads': return <Suspense fallback={<div>Loading…</div>}><TransporterLoadCons /></Suspense>;
            case 'lclStatus': return <Suspense fallback={<div>Loading…</div>}><LclStatusReport /></Suspense>;
            case 'deliveries':
            case 'pods': return <Suspense fallback={<div>Loading…</div>}><DeliveriesPod lens={isOps ? 'ownfleet' : 'brokered'} /></Suspense>;
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
                <div className="flex items-center gap-1 overflow-x-auto bg-slate-200/70 p-1 rounded-xl">
                    {stripTabs.map((item, idx) => {
                        const isHidden = hiddenTabs.includes(item.view);
                        const grp = (item as any).group;
                        const prevGrp = idx > 0 ? (stripTabs[idx - 1] as any).group : null;
                        const showDiv = !customise && idx > 0 && grp && grp !== prevGrp;
                        return (
                            <React.Fragment key={item.view}>
                            {showDiv && <span className="shrink-0 self-center ml-1 pl-2 border-l border-slate-300 text-[9px] font-black uppercase tracking-widest text-slate-400">{GROUP_LABEL[grp] || ''}</span>}
                            <div className={`flex items-center rounded-lg ${customise ? 'border border-dashed border-slate-300 pr-1' : ''}`}>
                                <button onClick={() => { if (!customise) handleOperationsSubViewChange(item.view as any); }}
                                    className={`px-3.5 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition ${activeTab === item.view && !customise ? 'bg-[#13294b] text-white shadow' : isHidden ? 'text-slate-400 line-through' : 'text-slate-600 hover:bg-white'}`}>
                                    {item.label}
                                </button>
                                {customise && (
                                    <span className="flex items-center text-slate-400">
                                        <button onClick={() => moveTab(item.view, -1)} title="Move left" className="px-1 hover:text-slate-700">◀</button>
                                        <button onClick={() => moveTab(item.view, 1)} title="Move right" className="px-1 hover:text-slate-700">▶</button>
                                        <button onClick={() => toggleHide(item.view)} title={isHidden ? 'Show' : 'Hide'} className={`px-1 ${isHidden ? 'text-emerald-600 hover:text-emerald-700' : 'hover:text-rose-600'}`}>{isHidden ? '＋' : '✕'}</button>
                                    </span>
                                )}
                            </div>
                            </React.Fragment>
                        );
                    })}
                    <button onClick={() => setCustomise(c => !c)} title="Show/hide & reorder your tabs" className={`ml-1 px-2.5 py-2 text-xs font-bold rounded-lg whitespace-nowrap ${customise ? 'bg-[#f5b700] text-[#13294b]' : 'text-slate-500 hover:bg-white'}`}>{customise ? 'Done' : '⚙ Customise'}</button>
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
