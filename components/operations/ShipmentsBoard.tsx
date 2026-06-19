import React, { useEffect, useMemo, useState } from 'react';
import { LoadConfirmation, LoadConfirmationStatus } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { isAssigned, nextStep, STATUS_LABEL, statusChip, isInterBranch } from '../../lib/loadStatus';
import LoadProgress from './LoadProgress';
import { TruckIcon } from '../icons/TruckIcon';

// Consolidation / line-haul Shipment manager — separate from the brokered Load
// Board. Shows rep/ops-logged shipments through the depot lifecycle:
// collect → origin depot → line-haul → destination depot → local delivery → POD.
const COLUMNS: { title: string; statuses: LoadConfirmationStatus[] }[] = [
    { title: 'Collecting', statuses: ['Booked', 'Driver Assigned', 'At Collection Point', 'Loading', 'Collected'] },
    { title: 'At Depot / Line-haul', statuses: ['At Collection Depot', 'In Transit'] },
    { title: 'Destination / Delivering', statuses: ['At Destination Depot', 'Unloaded', 'Out for Delivery'] },
    { title: 'Delivered / POD', statuses: ['Delivered', 'POD Submitted'] },
];

const ShipmentsBoard: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [], handleUpdateLoadConfirmation, handleRefreshLoads } = useOperations() as any;
    const { showModal, showToast } = useUIState();
    const [busy, setBusy] = useState<string | null>(null);
    const [q, setQ] = useState('');

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
            .filter(lc => !needle || `${lc.loadConNumber} ${clientName(lc)} ${lc.collectionPoint || ''} ${lc.deliveryPoint || ''}`.toLowerCase().includes(needle));
    }, [loadConfirmations, clients, q]);

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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h3 className="text-xl font-black text-slate-900">Shipments</h3>
                    <p className="text-xs text-slate-500">Consolidation &amp; line-haul — collect → depot → transfer → deliver. Assign a subbie to broker the national leg.</p>
                </div>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search shipments…" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-48" />
            </div>

            <div className="flex gap-3 pb-3 items-stretch overflow-x-auto">
                {COLUMNS.map(col => {
                    const jobs = shipments.filter(lc => col.statuses.includes(lc.status))
                        .sort((a, b) => new Date(a.collectionDate || a.date).getTime() - new Date(b.collectionDate || b.date).getTime());
                    return (
                        <div key={col.title} className="bg-slate-100 rounded-2xl p-3 flex flex-col flex-1 min-w-[280px] border border-slate-200 h-[calc(100vh-15rem)]">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 pb-2 border-b border-slate-200">{col.title} <span className="text-slate-400">{jobs.length}</span></h4>
                            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                                {jobs.map(lc => {
                                    const step = nextStep(lc);
                                    const assigned = isAssigned(lc);
                                    const showPod = lc.status === 'Out for Delivery' || (lc.status === 'Delivered' && !lc.podPhoto);
                                    const carrier = lc.supplierId ? (supplierName(lc.supplierId) || 'Subcontractor') : (lc.subcontractorName || (assigned ? 'Own fleet' : ''));
                                    return (
                                        <div key={lc.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-[10px] font-black text-blue-600 hover:underline font-mono">{lc.loadConNumber}</button>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                                            </div>
                                            <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="block text-left font-bold text-slate-900 text-sm leading-tight">{clientName(lc)}</button>
                                            <p className="text-[10px] text-slate-500 mb-1 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                                            {isInterBranch(lc) && <p className="text-[9px] font-black text-purple-600 mb-1 uppercase">{lc.collectionBranch} → {lc.destinationBranch}</p>}
                                            <LoadProgress lc={lc} />
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-2">
                                                <TruckIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <span className="truncate">{carrier || 'Unassigned'}{lc.subcontractorVehicleReg ? ` · ${lc.subcontractorVehicleReg}` : ''}{lc.loadingEta ? ` · ETA ${fmtEta(lc.loadingEta)}` : ''}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {!assigned && <>
                                                    <button onClick={() => showModal('assignFbn', { loadCon: lc })} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider">Assign FBN</button>
                                                    <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider">Subbie</button>
                                                </>}
                                                <button onClick={() => showModal('captureLoad', { loadCon: lc })} className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-[10px] uppercase tracking-wider">📷</button>
                                                {showPod ? (
                                                    <button onClick={() => getPod(lc)} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider">Get POD</button>
                                                ) : step ? (
                                                    <button onClick={() => advance(lc)} disabled={busy === lc.id} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-wider">{busy === lc.id ? '…' : step.label}</button>
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

export default ShipmentsBoard;
