import React, { useEffect, useMemo, useState } from 'react';
import { LoadConfirmation, LoadConfirmationStatus } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { isAssigned, nextStep, STATUS_LABEL, statusChip, isInterBranch } from '../../lib/loadStatus';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';
import { TruckIcon } from '../icons/TruckIcon';

// The broker load board: one kanban, columns = pipeline stages. Assign a
// subcontractor in "To Cover", then advance each load left-to-right.
const COLUMNS: { title: string; statuses: LoadConfirmationStatus[] }[] = [
    { title: 'To Assign', statuses: ['Booked'] },
    { title: 'Collecting / Loading', statuses: ['Driver Assigned', 'At Collection Point', 'Loading', 'At Collection Depot'] },
    { title: 'Loaded & On Route', statuses: ['Collected', 'In Transit'] },
    { title: 'At Destination', statuses: ['At Destination Depot', 'Unloaded', 'Out for Delivery'] },
    { title: 'Delivered / POD', statuses: ['Delivered', 'POD Submitted'] },
];

const LoadBoard: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [], handleUpdateLoadConfirmation, handleRefreshLoads } = useOperations();
    const { showModal, showToast } = useUIState();
    const [busy, setBusy] = useState<string | null>(null);
    const [branch, setBranch] = useState<string>('All');
    const [q, setQ] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // Pull fresh loads on open and every 30s, so carrier acceptances (driver /
    // vehicle / ETA entered on the public page) appear without a manual reload.
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

    const active = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (loadConfirmations || []).filter((lc: LoadConfirmation) => {
            if (lc.status === 'Invoiced' || lc.status === 'Cancelled') return false;
            if (branch !== 'All' && lc.collectionBranch !== branch && lc.destinationBranch !== branch) return false;
            if (!needle) return true;
            const hay = `${lc.loadConNumber} ${clientMap.get(lc.clientId || '') || lc.clientName || ''} ${lc.route || ''} ${lc.collectionPoint || ''} ${lc.deliveryPoint || ''} ${lc.subcontractorName || ''}`.toLowerCase();
            return hay.includes(needle);
        });
    }, [loadConfirmations, branch, q, clientMap]);

    const fmtR = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc);
        if (!step) return;
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: step.status });
        setBusy(null);
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
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
        lc.supplierId ? (supplierMap.get(lc.supplierId) || lc.subcontractorName || 'Subcontractor') : (isAssigned(lc) ? 'Own fleet' : '');

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Load Board</h3>
                <div className="flex items-center gap-2">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search loads…" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-44" />
                    <select value={branch} onChange={e => setBranch(e.target.value)} className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm">
                        {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}
                    </select>
                    <button onClick={refresh} disabled={refreshing} title="Refresh loads" className="bg-white text-slate-700 hover:bg-slate-50 p-2 rounded-md border border-slate-300 text-sm font-bold disabled:opacity-50">{refreshing ? '…' : '↻'}</button>
                </div>
            </div>

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
                                    const step = nextStep(lc);
                                    const assigned = isAssigned(lc);
                                    const showPod = lc.status === 'Out for Delivery' || (lc.status === 'Delivered' && !lc.podPhoto);
                                    // margin
                                    const margin = (lc.totalAmount || 0) - (lc.supplierRate || 0);
                                    const marginPct = lc.totalAmount ? (margin / lc.totalAmount) * 100 : 0;
                                    const marginColor = !lc.supplierRate ? 'text-slate-400' : marginPct <= 0 ? 'text-red-600' : marginPct < 10 ? 'text-amber-600' : 'text-emerald-600';
                                    // collection-date urgency (for loads not yet delivered)
                                    const terminal = ['Delivered', 'POD Submitted', 'Invoiced'].includes(lc.status);
                                    let urgent: '' | 'over' | 'today' = '';
                                    if (lc.collectionDate && !terminal) {
                                        const d0 = new Date(lc.collectionDate); d0.setHours(0, 0, 0, 0);
                                        const t0 = new Date(); t0.setHours(0, 0, 0, 0);
                                        if (d0 < t0) urgent = 'over'; else if (d0.getTime() === t0.getTime()) urgent = 'today';
                                    }
                                    const border = urgent === 'over' ? 'border-l-4 border-l-red-500' : urgent === 'today' ? 'border-l-4 border-l-amber-400' : '';
                                    return (
                                        <div key={lc.id} className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm ${border}`}>
                                            <div className="flex justify-between items-start mb-1.5">
                                                <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-[10px] font-black text-blue-600 hover:text-blue-700 hover:underline font-mono">{lc.loadConNumber}</button>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                                            </div>
                                            <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="block text-left font-bold text-slate-900 text-sm leading-tight hover:text-blue-600">{clientMap.get(lc.clientId || '') || lc.clientName}</button>
                                            <p className="text-[10px] text-slate-500 mb-1 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                                            {isInterBranch(lc) && <p className="text-[9px] font-black text-purple-600 mb-1 uppercase">{lc.collectionBranch} → {lc.destinationBranch}</p>}
                                            <div className="flex justify-between items-center mb-2 text-[9px] font-bold">
                                                <span className={urgent === 'over' ? 'text-red-600' : urgent === 'today' ? 'text-amber-600' : 'text-slate-400'}>
                                                    {lc.collectionDate ? (urgent === 'over' ? '⚠ Overdue' : urgent === 'today' ? '● Collect today' : 'Collect ' + new Date(lc.collectionDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })) : 'No date'}
                                                </span>
                                                {lc.supplierRate ? <span className={marginColor}>+R {Math.round(margin).toLocaleString('en-ZA')} ({marginPct.toFixed(0)}%)</span> : null}
                                            </div>
                                            <div className={`p-2 rounded-lg border mb-2.5 ${assigned ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                                <div className="flex items-center gap-2">
                                                    <TruckIcon className={`h-3.5 w-3.5 shrink-0 ${assigned ? 'text-emerald-600' : 'text-amber-500'}`} />
                                                    <p className="text-[10px] font-bold truncate">
                                                        {assigned
                                                            ? <span className="text-emerald-700">{transporterOf(lc)}</span>
                                                            : <span className="text-amber-700">Needs transporter</span>}
                                                        <span className="text-slate-400 font-medium"> · {lc.loadType || lc.commodity || 'Cargo'}</span>
                                                    </p>
                                                    {lc.acceptedAt && <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-600 text-white uppercase shrink-0">Accepted ✓</span>}
                                                </div>
                                                {(lc.subcontractorDriverName || lc.subcontractorVehicleReg || lc.loadingEta) && (
                                                    <p className="text-[9px] text-slate-500 mt-1 truncate pl-5">
                                                        {[lc.subcontractorDriverName, lc.subcontractorVehicleReg].filter(Boolean).join(' · ')}
                                                        {lc.loadingEta ? `${(lc.subcontractorDriverName || lc.subcontractorVehicleReg) ? ' · ' : ''}ETA ${lc.loadingEta}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className={`flex-1 font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all ${assigned ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>{assigned ? 'Reassign' : 'Assign'}</button>
                                                {showPod ? (
                                                    <button onClick={() => getPod(lc)} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest">Get POD</button>
                                                ) : step ? (
                                                    <button onClick={() => advance(lc)} disabled={busy === lc.id} className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest"><TruckIcon className="h-3 w-3 mr-1" />{busy === lc.id ? '…' : step.label}</button>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                                {jobs.length === 0 && <p className="text-center text-slate-400 text-[11px] py-6 font-bold uppercase tracking-widest">Empty</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LoadBoard;
