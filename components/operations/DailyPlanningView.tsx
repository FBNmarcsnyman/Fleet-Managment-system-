import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Vehicle, User, Manifest, TripSheet, Client, Branch } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';
import { isAssigned, nextStep, STATUS_LABEL, statusChip, isInterBranch } from '../../lib/loadStatus';

interface DailyPlanningViewProps {
    loadConfirmations: LoadConfirmation[];
    vehicles: Vehicle[];
    users: User[];
    clients: Client[];
    manifests: Manifest[];
    tripSheets: TripSheet[];
    onUpdateLoadConfirmation: (id: string, updates: Partial<LoadConfirmation>) => void;
    onCreateManifest: (payload: { vehicleId: string, driverId: string, loadConIds: string[], originBranch: Branch }) => void;
    onCreateTripSheet: (payload: { vehicleId: string, driverId: string, loadConIds: string[], branch: Branch }) => void;
    onOpenModal: (type: string, payload: any) => void;
}

const BRANCHES: Branch[] = ['FBN JHB', 'FBN DBN', 'FBN CPT', 'LOADMASTER'];

const COLLECT = new Set(['Booked', 'Driver Assigned', 'At Collection Point', 'Loading', 'Collected']);
const LINEHAUL = new Set(['At Collection Depot', 'In Transit']);
const LOCAL = new Set(['At Destination Depot', 'Unloaded', 'Out for Delivery']);
const DONE = new Set(['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled']);

// Pull the delivery TOWN out of a free-form address so loads going to the same
// area can be grouped for consolidation. We take the segment just before the
// 4-digit postal code (e.g. "…, PHOENIX, 4156, SOUTH AFRICA" → PHOENIX).
export const deliveryArea = (addr?: string): string => {
    if (!addr) return '';
    const parts = String(addr).split(',').map(s => s.trim()).filter(Boolean).filter(s => !/south africa/i.test(s));
    for (let i = 0; i < parts.length; i++) if (/^\d{4}$/.test(parts[i])) return (parts[i - 1] || '').toUpperCase();
    return (parts[parts.length - 1] || '').toUpperCase();
};
const kgOf = (lc: any) => { const n = parseFloat(String(lc.weightKg ?? '').replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; };

const DailyPlanningView: React.FC<DailyPlanningViewProps> = ({
    loadConfirmations = [], vehicles = [], users = [], clients = [], manifests = [], tripSheets = [],
    onUpdateLoadConfirmation, onCreateManifest, onCreateTripSheet, onOpenModal
}) => {
    const vReg = (id?: string) => (vehicles as any[]).find(v => v.id === id)?.registration || '';
    const [activeBranch, setActiveBranch] = useState<Branch>('FBN JHB');
    const [busy, setBusy] = useState<string | null>(null);
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const branchData = useMemo(() => {
        const safe = loadConfirmations || [];
        const toCollect = safe.filter(lc => COLLECT.has(lc.status) && lc.collectionBranch === activeBranch);
        const linehaul = safe.filter(lc => LINEHAUL.has(lc.status) && (lc.collectionBranch === activeBranch || lc.destinationBranch === activeBranch));
        const local = safe.filter(lc => LOCAL.has(lc.status) && lc.destinationBranch === activeBranch);
        const branchVehicles = vehicles.filter(v => v.branch === activeBranch && v.status === 'On the road');
        const availableDrivers = users.filter(u => u.role === 'Staff' && (u.assignedBranches.includes(activeBranch) || u.assignedBranches.length === 0));
        return { toCollect, linehaul, local, branchVehicles, availableDrivers };
    }, [loadConfirmations, vehicles, users, activeBranch]);

    // Consolidation opportunities — active loads heading to the SAME delivery
    // area, across all branches. 2+ in one area = combine onto one run; if they
    // come from different branches it's an inter-branch consolidation.
    const consolidation = useMemo(() => {
        const map = new Map<string, LoadConfirmation[]>();
        (loadConfirmations || []).forEach(lc => {
            if (DONE.has(lc.status)) return;
            const area = deliveryArea(lc.deliveryPoint);
            if (!area) return;
            const arr = map.get(area) || []; arr.push(lc); map.set(area, arr);
        });
        return [...map.entries()]
            .filter(([, arr]) => arr.length >= 2)
            .map(([area, arr]) => ({
                area, loads: arr,
                kg: arr.reduce((s, l) => s + kgOf(l), 0),
                crossBranch: new Set(arr.map(l => l.collectionBranch).filter(Boolean)).size > 1,
            }))
            .sort((a, b) => Number(b.crossBranch) - Number(a.crossBranch) || b.loads.length - a.loads.length);
    }, [loadConfirmations]);

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc);
        if (!step) return;
        setBusy(lc.id);
        await Promise.resolve(onUpdateLoadConfirmation(lc.id, { status: step.status }));
        setBusy(null);
    };
    const assign = (lc: LoadConfirmation) => onOpenModal('assignLoadCon', { loadCon: lc });

    const openCreateManifest = () => onOpenModal('createManifest', {
        availableLoads: branchData.linehaul, vehicles, users, selectedBranch: activeBranch,
        onSubmit: (p: { vehicleId: string, driverId: string, loadConIds: string[] }) => onCreateManifest({ ...p, originBranch: activeBranch })
    });
    const openCreateTripSheet = () => onOpenModal('createTripSheet', {
        availableLoads: branchData.local, vehicles, users, selectedBranch: activeBranch,
        onSubmit: (p: { vehicleId: string, driverId: string, loadConIds: string[] }) => onCreateTripSheet({ ...p, branch: activeBranch })
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 flex-wrap gap-3">
                <div className="bg-gray-900/60 p-1 rounded-xl flex space-x-1 border border-white/5">
                    {BRANCHES.map(branch => (
                        <button key={branch} onClick={() => setActiveBranch(branch)} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeBranch === branch ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-gray-500 hover:text-gray-300'}`}>{branch.replace('FBN ', '')}</button>
                    ))}
                </div>
                <button onClick={() => onOpenModal('aiDispatchAssistant', { unassignedJobs: branchData.toCollect.filter(lc => !isAssigned(lc)), branchVehicles: branchData.branchVehicles, availableDrivers: branchData.availableDrivers })} className="flex items-center font-black py-2.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white text-xs uppercase tracking-[0.15em] shadow-xl shadow-purple-900/30 transition-all active:scale-95">
                    <SparklesIcon className="h-4 w-4 mr-2" /> AI Dispatch Assistant
                </button>
            </div>

            {consolidation.length > 0 && (
                <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-2xl">
                    <h3 className="text-sm font-black text-indigo-200 uppercase tracking-widest mb-1">Consolidation opportunities</h3>
                    <p className="text-[11px] text-indigo-300/70 mb-3">Active loads heading to the same area — combine onto one run. Cross-branch matches are highlighted.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {consolidation.map(g => (
                            <div key={g.area} className={`rounded-xl p-3 border ${g.crossBranch ? 'bg-indigo-500/10 border-indigo-400/40' : 'bg-gray-900/40 border-gray-700/50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-black text-white text-sm">{g.area} <span className="text-gray-400 font-bold">· {g.loads.length} loads</span></p>
                                    {g.crossBranch && <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-indigo-500/30 text-indigo-200">Cross-branch</span>}
                                </div>
                                <div className="space-y-1">
                                    {g.loads.map(lc => (
                                        <button key={lc.id} onClick={() => onOpenModal('loadDetail', { loadCon: lc })} className="w-full text-left flex items-center justify-between gap-2 bg-black/20 hover:bg-black/40 rounded px-2 py-1">
                                            <span className="text-[11px] text-gray-200 truncate"><span className="font-mono text-indigo-300">{lc.loadConNumber}</span> · {clientMap.get(lc.clientId || '') || lc.clientName || '—'}</span>
                                            <span className="text-[10px] text-gray-500 shrink-0">{(lc.collectionBranch || '').replace('FBN ', '')} · {STATUS_LABEL[lc.status]}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">{g.kg > 0 ? `${Math.round(g.kg).toLocaleString('en-ZA')} kg combined` : ''}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <PlanningColumn title="To Collect" jobs={branchData.toCollect} clientMap={clientMap} busy={busy} onAssign={assign} onAdvance={advance} onOpenDetail={lc => onOpenModal('loadDetail', { loadCon: lc })} />
                <PlanningColumn title="At Depot / Line-haul" jobs={branchData.linehaul} clientMap={clientMap} busy={busy} onAdvance={advance} onOpenDetail={lc => onOpenModal('loadDetail', { loadCon: lc })}
                    actionButton={branchData.linehaul.length > 0 && <button onClick={openCreateManifest} className="bg-purple-600 hover:bg-purple-500 text-white font-black py-1.5 px-3 rounded-lg text-[10px] uppercase tracking-wider">+ Manifest</button>} />
                <PlanningColumn title="At Destination / Delivery" jobs={branchData.local} clientMap={clientMap} busy={busy} onAdvance={advance} onOpenDetail={lc => onOpenModal('loadDetail', { loadCon: lc })}
                    actionButton={branchData.local.length > 0 && <button onClick={openCreateTripSheet} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-1.5 px-3 rounded-lg text-[10px] uppercase tracking-wider">+ Trip sheet</button>} />
            </div>

            {/* Created line-haul manifests — print / email / receive */}
            {manifests.length > 0 && (
                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700/50">
                    <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Line-haul Manifests</h3>
                    <div className="space-y-2">
                        {[...manifests].sort((a, b) => String(b.dispatchDate || '').localeCompare(String(a.dispatchDate || ''))).slice(0, 12).map(m => (
                            <div key={m.id} className="flex items-center justify-between gap-2 bg-gray-900/50 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                    <span className="font-mono text-[11px] text-blue-400">{m.manifestNumber}</span>
                                    <span className="text-sm font-bold text-white ml-2">{m.originBranch} → {m.destinationBranch}</span>
                                    <span className="text-[11px] text-gray-500 ml-2">{vReg(m.vehicleId)} · {(m.loadConfirmationIds || []).length} loads · {m.dispatchDate}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${m.status === 'Arrived' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>{m.status}</span>
                                    <button onClick={() => onOpenModal('manifestDoc', { manifest: m })} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] uppercase tracking-wider">Open / Print</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const PlanningColumn: React.FC<{
    title: string,
    jobs: LoadConfirmation[],
    clientMap: Map<string, string>,
    busy: string | null,
    actionButton?: React.ReactNode,
    onAssign?: (lc: LoadConfirmation) => void,
    onAdvance: (lc: LoadConfirmation) => void,
    onOpenDetail: (lc: LoadConfirmation) => void,
}> = ({ title, jobs, clientMap, busy, actionButton, onAssign, onAdvance, onOpenDetail }) => (
    <div className="bg-gray-800 p-4 rounded-2xl shadow-xl flex flex-col h-[calc(100vh-25rem)] border border-gray-700/50">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/50">
            <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest">{title} <span className="text-gray-600 ml-1">({jobs.length})</span></h3>
            {actionButton}
        </div>
        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {jobs.map(lc => {
                const step = nextStep(lc);
                const assigned = isAssigned(lc);
                return (
                    <div key={lc.id} className="bg-gray-900/60 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <button onClick={() => onOpenDetail(lc)} className="text-[10px] font-black text-blue-400 hover:text-blue-300 hover:underline font-mono tracking-tighter">{lc.loadConNumber}</button>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                        </div>
                        <button onClick={() => onOpenDetail(lc)} className="block text-left font-bold text-white text-sm mb-0.5 leading-tight hover:text-blue-300">{clientMap.get(lc.clientId || '') || lc.clientName}</button>
                        <p className="text-[10px] text-gray-500 mb-2 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                        {isInterBranch(lc) && <p className="text-[9px] font-black text-purple-300 mb-2 uppercase">{lc.collectionBranch} → {lc.destinationBranch}</p>}

                        <div className="bg-gray-800/40 p-2 rounded-lg border border-white/5 flex items-center gap-3 mb-3">
                            <ArchiveBoxIcon className="h-3.5 w-3.5 text-blue-400" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-300 truncate">{lc.commodity || 'General Cargo'}</p>
                                <p className="text-[9px] text-gray-500 font-medium truncate">{assigned ? (lc.subcontractorName || 'Own fleet') : 'Unassigned'} | {lc.loadSpec || lc.loadType || 'TBA'}</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {onAssign && (
                                <button onClick={() => onAssign(lc)} className={`flex-1 font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all ${assigned ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                                    {assigned ? 'Reassign' : 'Assign'}
                                </button>
                            )}
                            {step && (
                                <button onClick={() => onAdvance(lc)} disabled={busy === lc.id} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all">
                                    {busy === lc.id ? '…' : step.label}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            {jobs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Queue Empty</p>
                </div>
            )}
        </div>
    </div>
);

export default DailyPlanningView;
