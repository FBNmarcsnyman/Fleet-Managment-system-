import React, { useMemo, useState } from 'react';
import { LoadConfirmation, LoadConfirmationStatus } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { isAssigned, nextStep, STATUS_LABEL, statusChip, isInterBranch } from '../../lib/loadStatus';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';
import { TruckIcon } from '../icons/TruckIcon';

// The broker load board: one kanban, columns = pipeline stages. Assign a
// subcontractor in "To Cover", then advance each load left-to-right.
const COLUMNS: { title: string; statuses: LoadConfirmationStatus[] }[] = [
    { title: 'To Cover', statuses: ['Booked'] },
    { title: 'Collecting / Loading', statuses: ['Driver Assigned', 'At Collection Point', 'Loading', 'At Collection Depot'] },
    { title: 'Loaded & On Route', statuses: ['Collected', 'In Transit'] },
    { title: 'At Destination', statuses: ['At Destination Depot', 'Unloaded', 'Out for Delivery'] },
    { title: 'Delivered / POD', statuses: ['Delivered', 'POD Submitted'] },
];

const LoadBoard: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [], handleUpdateLoadConfirmation } = useOperations();
    const { showModal, showToast } = useUIState();
    const [busy, setBusy] = useState<string | null>(null);
    const [branch, setBranch] = useState<string>('All');

    const clientMap = useMemo(() => new Map<string, string>(clients.map((c: any) => [c.id, c.name])), [clients]);
    const supplierMap = useMemo(() => new Map<string, string>((suppliers || []).map((s: any) => [s.id, s.name])), [suppliers]);

    const branches = useMemo(() => {
        const set = new Set<string>();
        (loadConfirmations || []).forEach((lc: LoadConfirmation) => { if (lc.collectionBranch) set.add(lc.collectionBranch); if (lc.destinationBranch) set.add(lc.destinationBranch); });
        return ['All', ...Array.from(set)];
    }, [loadConfirmations]);

    const active = useMemo(() => (loadConfirmations || []).filter((lc: LoadConfirmation) =>
        lc.status !== 'Invoiced' && lc.status !== 'Cancelled' &&
        (branch === 'All' || lc.collectionBranch === branch || lc.destinationBranch === branch)
    ), [loadConfirmations, branch]);

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
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Load Board</h3>
                <div>
                    <label className="text-sm text-gray-400 mr-2">Branch:</label>
                    <select value={branch} onChange={e => setBranch(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm">
                        {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-3">
                {COLUMNS.map(col => {
                    const jobs = active.filter((lc: LoadConfirmation) => col.statuses.includes(lc.status))
                        .sort((a: LoadConfirmation, b: LoadConfirmation) => new Date(a.collectionDate || a.date).getTime() - new Date(b.collectionDate || b.date).getTime());
                    return (
                        <div key={col.title} className="bg-gray-800 rounded-2xl p-3 flex flex-col w-[300px] shrink-0 border border-gray-700/50 max-h-[calc(100vh-15rem)]">
                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700/50">
                                <h4 className="text-xs font-black text-gray-300 uppercase tracking-widest">{col.title}</h4>
                                <span className="text-gray-600 text-xs font-bold">{jobs.length}</span>
                            </div>
                            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                                {jobs.map((lc: LoadConfirmation) => {
                                    const step = nextStep(lc);
                                    const assigned = isAssigned(lc);
                                    const showPod = lc.status === 'Out for Delivery' || (lc.status === 'Delivered' && !lc.podPhoto);
                                    return (
                                        <div key={lc.id} className="bg-gray-900/60 p-3 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-[10px] font-black text-blue-400 hover:text-blue-300 hover:underline font-mono">{lc.loadConNumber}</button>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                                            </div>
                                            <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="block text-left font-bold text-white text-sm leading-tight hover:text-blue-300">{clientMap.get(lc.clientId || '') || lc.clientName}</button>
                                            <p className="text-[10px] text-gray-500 mb-2 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                                            {isInterBranch(lc) && <p className="text-[9px] font-black text-purple-300 mb-1.5 uppercase">{lc.collectionBranch} → {lc.destinationBranch}</p>}
                                            <div className="bg-gray-800/40 p-2 rounded-lg border border-white/5 flex items-center gap-2 mb-2.5">
                                                <ArchiveBoxIcon className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                                <p className="text-[9px] text-gray-400 font-medium truncate">{assigned ? transporterOf(lc) : 'Not assigned'} · {lc.commodity || 'Cargo'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className={`flex-1 font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all ${assigned ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>{assigned ? 'Reassign' : 'Cover'}</button>
                                                {showPod ? (
                                                    <button onClick={() => getPod(lc)} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest">Get POD</button>
                                                ) : step ? (
                                                    <button onClick={() => advance(lc)} disabled={busy === lc.id} className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest"><TruckIcon className="h-3 w-3 mr-1" />{busy === lc.id ? '…' : step.label}</button>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                                {jobs.length === 0 && <p className="text-center text-gray-600 text-[11px] py-6 font-bold uppercase tracking-widest">Empty</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LoadBoard;
