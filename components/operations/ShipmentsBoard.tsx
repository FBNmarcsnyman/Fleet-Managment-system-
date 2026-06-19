import React, { useEffect, useMemo, useState } from 'react';
import { LoadConfirmation, LoadConfirmationStatus } from '../../types';
import { useOperations, useUIState, useAuth } from '../../contexts/AppContexts';
import { isAssigned, nextStep, STATUS_LABEL, statusChip, isInterBranch, isCollectionStage, isDeliveryStage } from '../../lib/loadStatus';
import LoadProgress from './LoadProgress';
import { TruckIcon } from '../icons/TruckIcon';

// Consolidation / line-haul Shipment manager — separate from the brokered Load
// Board. Shows rep/ops-logged shipments through the depot lifecycle:
// collect → origin depot → line-haul → destination depot → local delivery → POD.
// The board has two FLOORS, matching how the branches actually work it:
//  • Collection floor — the COLLECTING branch books, assigns & collects, then
//    drops at its depot / loads the line-haul.
//  • Delivery floor — once it's in transit it belongs to the DESTINATION branch,
//    who receives, runs it out for delivery and closes the POD.
// A local (same-branch) job simply moves from this branch's collection floor to
// its own delivery floor once collected. The branch filter below routes each
// load to the right branch for its current floor.
const FLOORS: { floor: string; tone: string; columns: { title: string; statuses: LoadConfirmationStatus[] }[] }[] = [
    {
        floor: 'Collection floor', tone: 'text-emerald-700',
        columns: [
            { title: 'To collect', statuses: ['Booked', 'Driver Assigned', 'At Collection Point', 'Loading'] },
            { title: 'Collected / at depot', statuses: ['Collected', 'At Collection Depot'] },
        ],
    },
    {
        floor: 'Delivery floor', tone: 'text-blue-700',
        columns: [
            { title: 'In transit / arrived', statuses: ['In Transit', 'At Destination Depot', 'Unloaded'] },
            { title: 'Out for delivery', statuses: ['Out for Delivery'] },
            { title: 'Delivered / POD', statuses: ['Delivered', 'POD Submitted'] },
        ],
    },
];

// FBN runs its own line-haul between JHB & DBN (and each branch's outlying
// deliveries off its own floor). Anywhere off that network — e.g. CPT — FBN
// still COLLECTS, but the long leg has to be brokered to a subbie. So we only
// offer the "Subbie" (raise line-haul LoadCon) button on lanes that need it;
// own-fleet lanes just get "Assign FBN".
const OWN_FLEET_NETWORK = ['FBN JHB', 'FBN DBN'];
const needsSubbieLeg = (lc: LoadConfirmation) => {
    if (lc.collectionBranch && lc.destinationBranch && lc.collectionBranch === lc.destinationBranch) return false; // local
    const offNetwork = (b?: string) => !!b && !OWN_FLEET_NETWORK.includes(b);
    return offNetwork(lc.collectionBranch) || offNetwork(lc.destinationBranch);
};

const ShipmentsBoard: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [], handleUpdateLoadConfirmation, handleRefreshLoads } = useOperations() as any;
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();
    const [busy, setBusy] = useState<string | null>(null);
    const [q, setQ] = useState('');
    // Default the board to the user's own branch (DBN controller → Durban, etc.);
    // managers with no single branch see All. They can still switch.
    const myBranch = (currentUser?.assignedBranches || []).find((b: string) => ['FBN DBN', 'FBN JHB', 'FBN CPT'].includes(b));
    const [branch, setBranch] = useState<string>(myBranch || 'All');
    // Show ONE floor at a time at full height so the desk never has to scroll —
    // collection desk lives on the collection floor, delivery desk on delivery.
    // Remembered per user so each controller lands back on their floor.
    const floorKey = `shipFloor_${currentUser?.id || currentUser?.email || ''}`;
    const [activeFloor, setActiveFloor] = useState<string>(() => {
        try { return localStorage.getItem(floorKey) || FLOORS[0].floor; } catch { return FLOORS[0].floor; }
    });
    useEffect(() => { try { localStorage.setItem(floorKey, activeFloor); } catch { /* ignore */ } }, [activeFloor, floorKey]);

    const branches = useMemo(() => {
        const set = new Set<string>();
        (loadConfirmations as LoadConfirmation[]).forEach(lc => { if (lc.isCollection) { if (lc.collectionBranch) set.add(lc.collectionBranch); if (lc.destinationBranch) set.add(lc.destinationBranch); } });
        return ['All', ...Array.from(set)];
    }, [loadConfirmations]);

    useEffect(() => {
        let active = true;
        handleRefreshLoads?.();
        const t = setInterval(() => { if (active) handleRefreshLoads?.(); }, 30000);
        return () => { active = false; clearInterval(t); };
    }, []);

    const clientName = (lc: LoadConfirmation) => clients.find((c: any) => c.id === lc.clientId)?.name || lc.clientName || '—';
    const supplierName = (id?: string) => suppliers.find((s: any) => s.id === id)?.name;

    const shipments = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (loadConfirmations as LoadConfirmation[])
            .filter(lc => lc.isCollection && !['Invoiced', 'Cancelled'].includes(lc.status))
            // Import groupage awaiting unpack/release lives on the Imports board
            // until it's booked for collection.
            .filter(lc => lc.importStage !== 'awaiting_release' && lc.importStage !== 'released')
            // Branch FLOOR rule: while it's being COLLECTED it belongs to the
            // COLLECTING branch only; once it's IN TRANSIT / DELIVERING (or done)
            // it moves to the DESTINATION branch's delivery floor. So a JHB→DBN
            // load shows on JHB while collecting, then on DBN to deliver.
            .filter(lc => {
                if (branch === 'All') return true;
                if (isCollectionStage(lc.status)) return lc.collectionBranch === branch;
                if (isDeliveryStage(lc.status) || ['Delivered', 'POD Submitted'].includes(lc.status)) return lc.destinationBranch === branch;
                return lc.collectionBranch === branch || lc.destinationBranch === branch;
            })
            .filter(lc => !needle || `${lc.loadConNumber} ${clientName(lc)} ${lc.collectionPoint || ''} ${lc.deliveryPoint || ''}`.toLowerCase().includes(needle));
    }, [loadConfirmations, clients, q, branch]);

    // Daily overview: cargo still to move, grouped by lane (from-area → to-area).
    const lanes = useMemo(() => {
        const map = new Map<string, { lane: string; count: number; pkgs: number; weight: number; cube: number }>();
        shipments.filter(lc => !['Delivered', 'POD Submitted'].includes(lc.status)).forEach(lc => {
            const key = `${lc.collectionBranch || '?'} → ${lc.destinationBranch || '?'}`;
            const m = map.get(key) || { lane: key, count: 0, pkgs: 0, weight: 0, cube: 0 };
            m.count++; m.pkgs += Number(lc.loadedPackages) || 0; m.weight += Number(lc.weightKg) || 0; m.cube += Number((lc as any).cubeM3) || 0;
            map.set(key, m);
        });
        return [...map.values()].sort((a, b) => b.count - a.count);
    }, [shipments]);
    const kg = (n: number) => Math.round(n).toLocaleString('en-ZA');

    // Inter-depot cargo INCOMING to this branch (line-hauled from the other depot):
    // en route or already arrived, so the receiving branch knows what to deliver.
    const incoming = useMemo(() => {
        if (branch === 'All') return [];
        const yest = new Date(); yest.setDate(yest.getDate() - 1); yest.setHours(0, 0, 0, 0);
        return (loadConfirmations as LoadConfirmation[])
            .filter(lc => lc.isCollection && lc.destinationBranch === branch && lc.collectionBranch && lc.collectionBranch !== branch
                && ['In Transit', 'At Destination Depot'].includes(lc.status)
                && lc.importStage !== 'awaiting_release' && lc.importStage !== 'released')
            .map(lc => ({ lc, arrived: lc.status === 'At Destination Depot', sinceYesterday: !!lc.updatedAt && new Date(lc.updatedAt) < new Date(new Date().setHours(0, 0, 0, 0)) }))
            .sort((a, b) => Number(b.arrived) - Number(a.arrived));
    }, [loadConfirmations, branch]);

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc);
        if (!step) return;
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: step.status });
        setBusy(null);
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
    };
    const getPod = (lc: LoadConfirmation) => showModal('pod', {
        loadCon: lc, isManualUpload: true,
        onSubmit: (id: string, pod: any) => handleUpdateLoadConfirmation(id, { podPhoto: pod.photo, podSignature: pod.signature, status: 'POD Submitted', paymentStatus: 'Awaiting POD' }),
        onCancel: () => showModal('hide'),
    });
    const fmtEta = (s?: string) => { if (!s) return ''; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

    const renderColumn = (col: { title: string; statuses: LoadConfirmationStatus[] }) => {
        const jobs = shipments.filter(lc => col.statuses.includes(lc.status))
            .sort((a, b) => new Date(a.collectionDate || a.date).getTime() - new Date(b.collectionDate || b.date).getTime());
        return (
            <div key={col.title} className="bg-slate-100 rounded-2xl p-3 flex flex-col flex-1 min-w-[260px] border border-slate-200 h-[calc(100vh-17rem)]">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 pb-2 border-b border-slate-200">{col.title} <span className="text-slate-400">{jobs.length}</span></h4>
                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {jobs.map(lc => {
                        const step = nextStep(lc);
                        const assigned = isAssigned(lc);
                        const showPod = lc.status === 'Out for Delivery' || (lc.status === 'Delivered' && !lc.podPhoto);
                        const carrier = lc.supplierId ? (supplierName(lc.supplierId) || 'Subcontractor') : (lc.subcontractorName || (assigned ? 'Own fleet' : ''));
                        const open = () => showModal('loadDetail', { loadCon: lc });
                        const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
                        return (
                            <div key={lc.id} onClick={open} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow transition">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-black text-blue-600 font-mono">{lc.loadConNumber}</span>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                                </div>
                                <p className="font-bold text-slate-900 text-sm leading-tight">{clientName(lc)}</p>
                                <p className="text-[10px] text-slate-500 mb-1 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                                {isInterBranch(lc) && <p className="text-[9px] font-black text-purple-600 mb-1 uppercase">{lc.collectionBranch} → {lc.destinationBranch}</p>}
                                <LoadProgress lc={lc} />
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-2">
                                    <TruckIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                    <span className="truncate">{carrier || 'Unassigned'}{lc.subcontractorVehicleReg ? ` · ${lc.subcontractorVehicleReg}` : ''}{lc.loadingEta ? ` · ETA ${fmtEta(lc.loadingEta)}` : ''}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {!assigned && (
                                        <button onClick={stop(() => showModal('assignFbn', { loadCon: lc }))} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider">Assign FBN</button>
                                    )}
                                    {/* Off-network leg (e.g. CPT): FBN collects, then this raises the
                                        line-haul LoadCon to a subbie and the load joins the Broking board. */}
                                    {needsSubbieLeg(lc) && !lc.supplierId && (
                                        <button onClick={stop(() => showModal('assignLoadCon', { loadCon: lc }))} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider" title="Raise the line-haul LoadCon to a subcontractor — moves to the Broking board">{assigned ? 'Subbie line-haul' : 'Subbie'}</button>
                                    )}
                                    <button onClick={stop(() => showModal('captureLoad', { loadCon: lc }))} className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider">📷</button>
                                    {showPod ? (
                                        <button onClick={stop(() => getPod(lc))} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider">Get POD</button>
                                    ) : step ? (
                                        <button onClick={stop(() => advance(lc))} disabled={busy === lc.id} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider">{busy === lc.id ? '…' : step.label}</button>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                    {jobs.length === 0 && <p className="text-center text-slate-400 text-[11px] py-6 font-bold uppercase tracking-widest">Empty</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h3 className="text-xl font-black text-slate-900">Shipments</h3>
                    <p className="text-xs text-slate-500">Consolidation &amp; line-haul — collect → depot → transfer → deliver. Assign a subbie to broker the national leg.</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={branch} onChange={e => setBranch(e.target.value)} className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm">
                        {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}
                    </select>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search shipments…" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-48" />
                </div>
            </div>

            {/* Incoming from the other depot — line-hauled to this branch */}
            {incoming.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                    <p className="text-[11px] font-black text-purple-700 uppercase tracking-widest mb-2">⇢ Incoming from other depots ({incoming.length})</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {incoming.map(({ lc, arrived, sinceYesterday }) => (
                            <button key={lc.id} onClick={() => showModal('loadDetail', { loadCon: lc })}
                                className="shrink-0 text-left bg-white border border-purple-200 rounded-xl px-3 py-2 shadow-sm min-w-[190px] hover:border-purple-400">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black text-purple-700 uppercase">{lc.collectionBranch} → {lc.destinationBranch}</span>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${arrived ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{arrived ? 'Arrived' : 'En route'}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-900 truncate">{clientName(lc)}</div>
                                <div className="text-[10px] text-slate-500 truncate">{lc.deliveryPoint || '—'}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{lc.subcontractorVehicleReg || lc.subcontractorName || 'Linehaul'}{sinceYesterday ? ' · since yesterday' : ''}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Cargo to move — overview by lane */}
            {lanes.length > 0 && (
                <div>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Cargo to move</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {lanes.map(l => (
                            <div key={l.lane} className="shrink-0 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm min-w-[150px]">
                                <div className="text-sm font-black text-[#13294b]">{l.lane}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{l.count} shipment{l.count !== 1 ? 's' : ''}</div>
                                <div className="text-[11px] text-slate-700 font-bold mt-1">{l.pkgs} pkgs · {kg(l.weight)} kg{l.cube ? ` · ${l.cube.toFixed(1)} m³` : ''}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl w-fit">
                {FLOORS.map(fl => {
                    const count = shipments.filter(lc => fl.columns.some(c => c.statuses.includes(lc.status))).length;
                    return (
                        <button key={fl.floor} onClick={() => setActiveFloor(fl.floor)}
                            className={`px-4 py-1.5 text-sm font-black rounded-lg whitespace-nowrap transition ${activeFloor === fl.floor ? `bg-white shadow ${fl.tone}` : 'text-slate-500 hover:text-slate-700'}`}>
                            {fl.floor} <span className="text-slate-400">· {count}</span>
                        </button>
                    );
                })}
            </div>
            <div className="flex gap-3 pb-3 items-stretch overflow-x-auto">
                {(FLOORS.find(f => f.floor === activeFloor) || FLOORS[0]).columns.map(renderColumn)}
            </div>
        </div>
    );
};

export default ShipmentsBoard;
