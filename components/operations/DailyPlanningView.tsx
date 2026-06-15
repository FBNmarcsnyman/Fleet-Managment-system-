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

const DailyPlanningView: React.FC<DailyPlanningViewProps> = ({
    loadConfirmations = [], vehicles = [], users = [], clients = [],
    onUpdateLoadConfirmation, onCreateManifest, onCreateTripSheet, onOpenModal
}) => {
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <PlanningColumn title="To Collect" jobs={branchData.toCollect} clientMap={clientMap} busy={busy} onAssign={assign} onAdvance={advance} onOpenDetail={lc => onOpenModal('loadDetail', { loadCon: lc })} />
                <PlanningColumn title="Linehaul / In Transit" jobs={branchData.linehaul} clientMap={clientMap} busy={busy} onAdvance={advance} onOpenDetail={lc => onOpenModal('loadDetail', { loadCon: lc })}
                    actionButton={<button onClick={openCreateManifest} className="flex items-center text-[10px] font-black bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20 px-2 py-1 rounded uppercase tracking-wider transition-all"><PlusIcon className="h-3 w-3 mr-1" /> Manifest</button>} />
                <PlanningColumn title="Local Delivery" jobs={branchData.local} clientMap={clientMap} busy={busy} onAdvance={advance} onOpenDetail={lc => onOpenModal('loadDetail', { loadCon: lc })}
                    actionButton={<button onClick={openCreateTripSheet} className="flex items-center text-[10px] font-black bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/20 px-2 py-1 rounded uppercase tracking-wider transition-all"><PlusIcon className="h-3 w-3 mr-1" /> Trip Sheet</button>} />
            </div>
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
