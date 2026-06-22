import React, { useEffect, useMemo, useState } from 'react';
import { LoadConfirmation, LoadConfirmationStatus } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { isAssigned, nextStep, STATUS_LABEL, statusChip, isInterBranch } from '../../lib/loadStatus';
import { TruckIcon } from '../icons/TruckIcon';
import LoadProgress from './LoadProgress';

// The BROKING load board (separate from Operations own-fleet). Two views of the
// same brokered-load pipeline: a dense LIST (default) you scan top-to-bottom by
// stage, and the classic kanban BOARD. Stages run the full lifecycle:
// collection → assign/collecting → loading/loaded → on route → arrived →
// delivered (POD outstanding) → POD received → closed.
const COLUMNS: { title: string; statuses: LoadConfirmationStatus[] }[] = [
    { title: 'To Assign', statuses: ['Booked'] },
    { title: 'Collecting / Loading', statuses: ['Driver Assigned', 'At Collection Point', 'Loading', 'At Collection Depot'] },
    { title: 'Loaded & On Route', statuses: ['Collected', 'In Transit'] },
    { title: 'At Destination', statuses: ['At Destination Depot', 'Unloaded', 'Out for Delivery'] },
    { title: 'Delivered / POD', statuses: ['Delivered', 'POD Submitted'] },
];

// The list stages Marc runs the desk by, each a group of underlying statuses.
type StageKey = 'collection' | 'collecting' | 'loading' | 'onroute' | 'arrived' | 'delivered' | 'pod' | 'closed';
const STAGES: { key: StageKey; label: string; chip: string }[] = [
    { key: 'collection', label: 'To collect', chip: 'bg-amber-100 text-amber-700' },
    { key: 'collecting', label: 'Collecting', chip: 'bg-orange-100 text-orange-700' },
    { key: 'loading', label: 'Loading / loaded', chip: 'bg-yellow-100 text-yellow-800' },
    { key: 'onroute', label: 'On route', chip: 'bg-blue-100 text-blue-700' },
    { key: 'arrived', label: 'Arrived', chip: 'bg-indigo-100 text-indigo-700' },
    { key: 'delivered', label: 'POD outstanding', chip: 'bg-rose-100 text-rose-700' },
    { key: 'pod', label: 'POD received', chip: 'bg-emerald-100 text-emerald-700' },
    { key: 'closed', label: 'Closed', chip: 'bg-slate-200 text-slate-600' },
];
const stageOf = (lc: LoadConfirmation): StageKey => {
    if (lc.status === 'Invoiced' || lc.status === 'Cancelled') return 'closed';
    if (lc.status === 'POD Submitted') return 'pod';
    if (lc.status === 'Delivered') return 'delivered';
    if (['At Destination Depot', 'Unloaded', 'Out for Delivery'].includes(lc.status)) return 'arrived';
    if (['At Collection Depot', 'In Transit'].includes(lc.status)) return 'onroute';
    if (['Loading', 'Collected'].includes(lc.status)) return 'loading';
    if (['Driver Assigned', 'At Collection Point'].includes(lc.status)) return 'collecting';
    return 'collection'; // Booked
};

const LoadBoard: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [], handleUpdateLoadConfirmation, handleRefreshLoads } = useOperations();
    const { showModal, showToast } = useUIState();
    const [busy, setBusy] = useState<string | null>(null);
    const [branch, setBranch] = useState<string>('All');
    const [q, setQ] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [view, setView] = useState<'list' | 'board'>(() => { try { return (localStorage.getItem('brokingView') as any) || 'list'; } catch { return 'list'; } });
    const [stageFilter, setStageFilter] = useState<StageKey | 'all'>('all');
    useEffect(() => { try { localStorage.setItem('brokingView', view); } catch { /* ignore */ } }, [view]);

    const refresh = async () => { setRefreshing(true); try { await handleRefreshLoads?.(); } finally { setRefreshing(false); } };
    useEffect(() => {
        let active = true;
        handleRefreshLoads?.();
        const t = setInterval(() => { if (active) handleRefreshLoads?.(); }, 30000);
        return () => { active = false; clearInterval(t); };
    }, []);

    const clientMap = useMemo(() => new Map<string, string>(clients.map((c: any) => [c.id, c.name])), [clients]);
    const supplierMap = useMemo(() => new Map<string, string>((suppliers || []).map((s: any) => [s.id, s.name])), [suppliers]);

    const branches = useMemo(() => {
        const set = new Set<string>();
        (loadConfirmations || []).forEach((lc: LoadConfirmation) => { if (lc.collectionBranch) set.add(lc.collectionBranch); if (lc.destinationBranch) set.add(lc.destinationBranch); });
        return ['All', ...Array.from(set)];
    }, [loadConfirmations]);

    // Brokered loads only — own-fleet collection shipments live on Operations and
    // appear here only once brokered to a subcontractor (the national leg).
    const inBroking = (lc: LoadConfirmation) => !(lc.isCollection && !lc.supplierId);
    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (loadConfirmations || []).filter((lc: LoadConfirmation) => {
            if (!inBroking(lc)) return false;
            if (branch !== 'All' && lc.collectionBranch !== branch && lc.destinationBranch !== branch) return false;
            if (!needle) return true;
            const hay = `${lc.loadConNumber} ${lc.loadRefNo || ''} ${clientMap.get(lc.clientId || '') || lc.clientName || ''} ${lc.route || ''} ${lc.collectionPoint || ''} ${lc.deliveryPoint || ''} ${lc.subcontractorName || ''}`.toLowerCase();
            return hay.includes(needle);
        });
    }, [loadConfirmations, branch, q, clientMap]);

    // Active (board) = everything not closed. Closed = Invoiced / Cancelled.
    const active = useMemo(() => filtered.filter((lc: LoadConfirmation) => lc.status !== 'Invoiced' && lc.status !== 'Cancelled'), [filtered]);
    const counts = useMemo(() => { const c: Record<string, number> = {}; filtered.forEach(lc => { const k = stageOf(lc); c[k] = (c[k] || 0) + 1; }); return c; }, [filtered]);
    const listRows = useMemo(() => {
        const order: Record<StageKey, number> = { collection: 0, collecting: 1, loading: 2, onroute: 3, arrived: 4, delivered: 5, pod: 6, closed: 7 };
        return filtered
            .filter(lc => stageFilter === 'all' ? lc.status !== 'Invoiced' && lc.status !== 'Cancelled' : stageOf(lc) === stageFilter)
            .sort((a, b) => (order[stageOf(a)] - order[stageOf(b)]) || (new Date(a.collectionDate || a.date).getTime() - new Date(b.collectionDate || b.date).getTime()));
    }, [filtered, stageFilter]);

    const fmtR = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');
    const fmtEta = (s?: string) => { if (!s) return ''; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
    const fmtDay = (s?: string) => { if (!s) return '—'; const d = new Date(s); return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); };

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc); if (!step) return;
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: step.status });
        setBusy(null);
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
    };
    const close = async (lc: LoadConfirmation) => {
        if (!window.confirm(`Close load ${lc.loadConNumber}? Marks it billed/closed and moves it off the active board.`)) return;
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: 'Invoiced' });
        setBusy(null);
        if (res && res.ok === false) showToast(`Could not close: ${res.error}`);
    };
    const getPod = (lc: LoadConfirmation) => showModal('pod', {
        loadCon: lc,
        isManualUpload: true,
        onSubmit: (loadConId: string, podData: any) => handleUpdateLoadConfirmation(loadConId, {
            podPhoto: podData.photo, podSignature: podData.signature, podAnalysis: podData.analysisResult,
            status: 'POD Submitted', paymentStatus: 'Awaiting POD',
        }),
        onCancel: () => showModal('hide'),
    });

    const transporterOf = (lc: LoadConfirmation): string =>
        lc.supplierId ? (supplierMap.get(lc.supplierId) || lc.subcontractorName || 'Subcontractor') : (lc.subcontractorName || (isAssigned(lc) ? 'Own fleet' : ''));

    // Right-hand action button(s) for a load, shared by list + board.
    const RowActions: React.FC<{ lc: LoadConfirmation; compact?: boolean }> = ({ lc, compact }) => {
        const step = nextStep(lc);
        const assigned = isAssigned(lc);
        const showPod = lc.status === 'Out for Delivery' || (lc.status === 'Delivered' && !lc.podPhoto);
        const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
        const cls = (base: string) => `${compact ? 'flex-1 py-1.5 text-[10px]' : 'py-1 px-2.5 text-[11px]'} font-black rounded-lg uppercase tracking-wider text-white ${base}`;
        if (!assigned && lc.status === 'Booked') return (
            <div className="flex gap-1.5 justify-end">
                <button onClick={stop(() => showModal('assignFbn', { loadCon: lc }))} className={cls('bg-emerald-600 hover:bg-emerald-500')}>Assign FBN</button>
                <button onClick={stop(() => showModal('assignLoadCon', { loadCon: lc }))} className={cls('bg-amber-500 hover:bg-amber-400')}>Subbie</button>
            </div>
        );
        if (showPod) return <button onClick={stop(() => getPod(lc))} className={cls('bg-green-600 hover:bg-green-500')}>Get POD</button>;
        if (lc.status === 'POD Submitted') return <button onClick={stop(() => close(lc))} disabled={busy === lc.id} className={cls('bg-slate-600 hover:bg-slate-500 disabled:opacity-50')}>{busy === lc.id ? '…' : 'Close'}</button>;
        if (step) return <button onClick={stop(() => step.status === 'In Transit' ? showModal('dispatchLoad', { loadCon: lc }) : advance(lc))} disabled={busy === lc.id} className={cls('bg-blue-600 hover:bg-blue-500 disabled:opacity-50')}>{busy === lc.id ? '…' : step.label}</button>;
        return <span className="text-[11px] text-slate-400">—</span>;
    };

    return (
        <div className="space-y-4 max-w-[1600px] mx-auto px-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Load Board</h3>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex rounded-lg overflow-hidden border border-slate-300">
                        {(['list', 'board'] as const).map(v => (
                            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${view === v ? 'bg-[#13294b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{v === 'list' ? '☰ List' : '▦ Board'}</button>
                        ))}
                    </div>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search loads…" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-44" />
                    <select value={branch} onChange={e => setBranch(e.target.value)} className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm">
                        {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}
                    </select>
                    <button onClick={refresh} disabled={refreshing} title="Refresh loads" className="bg-white text-slate-700 hover:bg-slate-50 p-2 rounded-md border border-slate-300 text-sm font-bold disabled:opacity-50">{refreshing ? '…' : '↻'}</button>
                </div>
            </div>

            {view === 'list' ? (
                <>
                    {/* Stage filter chips */}
                    <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setStageFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${stageFilter === 'all' ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>All active <span className="opacity-60">{active.length}</span></button>
                        {STAGES.map(s => (
                            <button key={s.key} onClick={() => setStageFilter(s.key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${stageFilter === s.key ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{s.label} <span className="opacity-60">{counts[s.key] || 0}</span></button>
                        ))}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        {listRows.length === 0 ? <div className="px-4 py-10 text-center text-slate-400 text-sm">No loads in this stage.</div> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="py-2 pl-3 px-2">Load</th>
                                        <th className="py-2 px-2">Client</th>
                                        <th className="py-2 px-2">Route</th>
                                        <th className="py-2 px-2">Transporter</th>
                                        <th className="py-2 px-2">Collect</th>
                                        <th className="py-2 px-2 text-right">Margin</th>
                                        <th className="py-2 px-2">Stage</th>
                                        <th className="py-2 px-2 text-right pr-3">Action</th>
                                    </tr></thead>
                                    <tbody>
                                        {listRows.map(lc => {
                                            const margin = (lc.totalAmount || 0) - (lc.supplierRate || 0);
                                            const marginPct = lc.totalAmount ? (margin / lc.totalAmount) * 100 : 0;
                                            const marginColor = !lc.supplierRate ? 'text-slate-400' : marginPct <= 0 ? 'text-red-600' : marginPct < 10 ? 'text-amber-600' : 'text-emerald-600';
                                            const terminal = ['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'].includes(lc.status);
                                            const overdue = lc.collectionDate && !terminal && new Date(lc.collectionDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
                                            const st = STAGES.find(s => s.key === stageOf(lc))!;
                                            return (
                                                <tr key={lc.id} onClick={() => showModal('loadDetail', { loadCon: lc })} className="border-b border-slate-100 cursor-pointer hover:bg-blue-50/40">
                                                    <td className="py-2 pl-3 px-2"><span className="font-bold text-blue-700 font-mono text-xs">{lc.loadConNumber}</span>{lc.loadRefNo && <div className="text-[11px] text-slate-400">WB {lc.loadRefNo}</div>}{lc.clientRequestStatus === 'open' && <div className="text-[10px] font-black text-rose-600 animate-pulse">✉ client request</div>}</td>
                                                    <td className="py-2 px-2 text-slate-700">{clientMap.get(lc.clientId || '') || lc.clientName}</td>
                                                    <td className="py-2 px-2"><div className="text-slate-700 truncate max-w-[200px]">{lc.collectionPoint} → {lc.deliveryPoint}</div>{isInterBranch(lc) && <div className="text-[10px] font-black text-purple-600 uppercase">{lc.collectionBranch} → {lc.destinationBranch}</div>}</td>
                                                    <td className="py-2 px-2"><div className={`truncate max-w-[150px] ${isAssigned(lc) ? 'text-slate-700' : 'text-amber-600 font-bold'}`}>{transporterOf(lc) || 'Needs transporter'}</div>{(lc.subcontractorVehicleReg || lc.loadingEta) && <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{[lc.subcontractorVehicleReg].filter(Boolean).join(' ')}{lc.loadingEta ? ` · ETA ${fmtEta(lc.loadingEta)}` : ''}</div>}</td>
                                                    <td className={`py-2 px-2 whitespace-nowrap ${overdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{fmtDay(lc.collectionDate)}{overdue ? ' ⚠' : ''}</td>
                                                    <td className={`py-2 px-2 text-right whitespace-nowrap ${marginColor}`}>{lc.supplierRate ? `${fmtR(margin)} (${marginPct.toFixed(0)}%)` : '—'}</td>
                                                    <td className="py-2 px-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${st.chip}`}>{st.label}</span></td>
                                                    <td className="py-2 px-2 text-right pr-3" onClick={e => e.stopPropagation()}><RowActions lc={lc} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex gap-3 pb-3 items-stretch overflow-x-auto">
                    {COLUMNS.map(col => {
                        const jobs = active.filter((lc: LoadConfirmation) => col.statuses.includes(lc.status))
                            .sort((a: LoadConfirmation, b: LoadConfirmation) => new Date(a.collectionDate || a.date).getTime() - new Date(b.collectionDate || b.date).getTime());
                        return (
                            <div key={col.title} className="bg-slate-100 rounded-2xl p-3 flex flex-col flex-1 min-w-[300px] border border-slate-200 h-[calc(100vh-14rem)]">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">{col.title} <span className="text-slate-400">{jobs.length}</span></h4>
                                    <span className="text-[10px] font-bold text-emerald-600">{fmtR(jobs.reduce((s: number, j: LoadConfirmation) => s + (j.totalAmount || 0), 0))}</span>
                                </div>
                                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                                    {jobs.map((lc: LoadConfirmation) => {
                                        const assigned = isAssigned(lc);
                                        const margin = (lc.totalAmount || 0) - (lc.supplierRate || 0);
                                        const marginPct = lc.totalAmount ? (margin / lc.totalAmount) * 100 : 0;
                                        const marginColor = !lc.supplierRate ? 'text-slate-400' : marginPct <= 0 ? 'text-red-600' : marginPct < 10 ? 'text-amber-600' : 'text-emerald-600';
                                        const terminal = ['Delivered', 'POD Submitted', 'Invoiced'].includes(lc.status);
                                        let urgent: '' | 'over' | 'today' = '';
                                        if (lc.collectionDate && !terminal) {
                                            const d0 = new Date(lc.collectionDate); d0.setHours(0, 0, 0, 0);
                                            const t0 = new Date(); t0.setHours(0, 0, 0, 0);
                                            if (d0 < t0) urgent = 'over'; else if (d0.getTime() === t0.getTime()) urgent = 'today';
                                        }
                                        const border = urgent === 'over' ? 'border-l-4 border-l-red-500' : urgent === 'today' ? 'border-l-4 border-l-amber-400' : '';
                                        return (
                                            <div key={lc.id} onClick={() => showModal('loadDetail', { loadCon: lc })} className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow transition ${border}`}>
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <span className="text-[10px] font-black text-blue-600 font-mono">{lc.loadConNumber}</span>
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                                                </div>
                                                <p className="font-bold text-slate-900 text-sm leading-tight">{clientMap.get(lc.clientId || '') || lc.clientName}</p>
                                                <p className="text-[10px] text-slate-500 mb-1.5 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                                                <LoadProgress lc={lc} />
                                                <div className="flex justify-between items-center my-2 text-[9px] font-bold">
                                                    <span className={urgent === 'over' ? 'text-red-600' : urgent === 'today' ? 'text-amber-600' : 'text-slate-400'}>{lc.collectionDate ? (urgent === 'over' ? '⚠ Overdue' : urgent === 'today' ? '● Collect today' : 'Collect ' + fmtDay(lc.collectionDate)) : 'No date'}</span>
                                                    {lc.supplierRate ? <span className={marginColor}>+{fmtR(margin)} ({marginPct.toFixed(0)}%)</span> : null}
                                                </div>
                                                <div className={`p-2 rounded-lg border mb-2.5 ${assigned ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <TruckIcon className={`h-3.5 w-3.5 shrink-0 ${assigned ? 'text-emerald-600' : 'text-amber-500'}`} />
                                                        <p className="text-[10px] font-bold truncate">{assigned ? <span className="text-emerald-700">{transporterOf(lc)}</span> : <span className="text-amber-700">Needs transporter</span>}<span className="text-slate-400 font-medium"> · {lc.loadType || lc.commodity || 'Cargo'}</span></p>
                                                        {lc.acceptedAt && <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-600 text-white uppercase shrink-0">Accepted ✓</span>}
                                                    </div>
                                                </div>
                                                <RowActions lc={lc} compact />
                                            </div>
                                        );
                                    })}
                                    {jobs.length === 0 && <p className="text-center text-slate-400 text-[11px] py-6 font-bold uppercase tracking-widest">Empty</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LoadBoard;
