
import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Vehicle, User, Manifest, TripSheet, Client, Branch } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { TruckIcon } from '../icons/TruckIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';

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

const DailyPlanningView: React.FC<DailyPlanningViewProps> = ({
    loadConfirmations = [], vehicles = [], users = [], clients = [], manifests = [], tripSheets = [],
    onUpdateLoadConfirmation, onCreateManifest, onCreateTripSheet, onOpenModal
}) => {
    const [activeBranch, setActiveBranch] = useState<Branch>('FBN JHB');
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const branchData = useMemo(() => {
        const safeLoads = loadConfirmations || [];
        
        const unassigned = safeLoads.filter(lc =>
            lc.status === 'Booked' &&
            lc.collectionBranch === activeBranch
        );

        const linehaulJobs = safeLoads.filter(lc =>
            lc.status === 'At Collection Depot' &&
            lc.collectionBranch === activeBranch
        );

        const localDeliveryJobs = safeLoads.filter(lc =>
            lc.status === 'At Destination Depot' &&
            lc.destinationBranch === activeBranch 
        );

        const branchVehicles = vehicles.filter(v => v.branch === activeBranch && v.status === 'On the road');
        const availableDrivers = users.filter(u => u.role === 'Staff' && (u.assignedBranches.includes(activeBranch) || u.assignedBranches.length === 0));

        return { unassigned, linehaulJobs, localDeliveryJobs, branchVehicles, availableDrivers };
    }, [loadConfirmations, vehicles, users, activeBranch]);

    const openCreateManifest = () => onOpenModal('createManifest', { 
        availableLoads: branchData.linehaulJobs, 
        vehicles, 
        users, 
        selectedBranch: activeBranch, 
        onSubmit: (payload: { vehicleId: string, driverId: string, loadConIds: string[] }) => onCreateManifest({ ...payload, originBranch: activeBranch }) 
    });

    const openCreateTripSheet = () => onOpenModal('createTripSheet', { 
        availableLoads: branchData.localDeliveryJobs, 
        vehicles, 
        users, 
        selectedBranch: activeBranch, 
        onSubmit: (payload: { vehicleId: string, driverId: string, loadConIds: string[] }) => onCreateTripSheet({ ...payload, branch: activeBranch }) 
    });


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50">
                <div className="bg-gray-900/60 p-1 rounded-xl flex space-x-1 border border-white/5">
                    {(['FBN JHB', 'FBN DBN'] as Branch[]).map(branch => (
                        <button key={branch} onClick={() => setActiveBranch(branch)} className={`px-5 py-2 text-sm font-black uppercase tracking-widest rounded-lg transition-all ${activeBranch === branch ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-gray-500 hover:text-gray-300'}`}>{branch}</button>
                    ))}
                </div>
                 <button onClick={() => onOpenModal('aiDispatchAssistant', { unassignedJobs: branchData.unassigned, branchVehicles: branchData.branchVehicles, availableDrivers: branchData.availableDrivers })} className="flex items-center font-black py-2.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white text-xs uppercase tracking-[0.15em] shadow-xl shadow-purple-900/30 transition-all active:scale-95">
                    <SparklesIcon className="h-4 w-4 mr-2"/> AI Dispatch Assistant
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <PlanningColumn 
                    title="Unassigned Jobs" 
                    jobs={branchData.unassigned} 
                    clientMap={clientMap} 
                    onAssignClick={(lc) => onOpenModal('assignLoadCon', { loadCon: lc })} 
                />
                <PlanningColumn 
                    title="Ready for Linehaul" 
                    jobs={branchData.linehaulJobs} 
                    clientMap={clientMap} 
                    actionButton={<button onClick={openCreateManifest} className="flex items-center text-[10px] font-black bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20 px-2 py-1 rounded uppercase tracking-wider transition-all"><PlusIcon className="h-3 w-3 mr-1"/> Manifest</button>} 
                />
                <PlanningColumn 
                    title="Ready for Local" 
                    jobs={branchData.localDeliveryJobs} 
                    clientMap={clientMap} 
                    actionButton={<button onClick={openCreateTripSheet} className="flex items-center text-[10px] font-black bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/20 px-2 py-1 rounded uppercase tracking-wider transition-all"><PlusIcon className="h-3 w-3 mr-1"/> Trip Sheet</button>} 
                />
            </div>
        </div>
    );
};

const PlanningColumn: React.FC<{
    title: string,
    jobs: LoadConfirmation[],
    clientMap: Map<string, string>,
    actionButton?: React.ReactNode,
    onAssignClick?: (lc: LoadConfirmation) => void
}> = ({ title, jobs, clientMap, actionButton, onAssignClick }) => (
    <div className="bg-gray-800 p-4 rounded-2xl shadow-xl flex flex-col h-[calc(100vh-25rem)] border border-gray-700/50">
        <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-700/50">
            <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest">{title} <span className="text-gray-600 ml-1">({jobs.length})</span></h3>
            {actionButton}
        </div>
        <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {jobs.map(lc => (
                <div key={lc.id} className="bg-gray-900/60 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-gray-500 font-mono tracking-tighter">{lc.loadConNumber}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${lc.priority === 'High' ? 'text-red-400 bg-red-900/20' : 'text-gray-500 bg-gray-800'}`}>{lc.priority}</span>
                    </div>
                    <p className="font-bold text-white text-sm mb-1 leading-tight">{clientMap.get(lc.clientId || '')}</p>
                    <p className="text-[10px] text-gray-500 mb-3 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                    
                    <div className="bg-gray-800/40 p-2 rounded-lg border border-white/5 flex items-center gap-3 mb-3">
                        <ArchiveBoxIcon className="h-3.5 w-3.5 text-blue-400" />
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-gray-300 truncate">{lc.commodity || 'General Cargo'}</p>
                            <p className="text-[9px] text-gray-500 font-medium truncate">{lc.packaging || 'Loose'} | {lc.loadSpec || 'TBA'}</p>
                        </div>
                    </div>

                    {onAssignClick && (
                        <button onClick={() => onAssignClick(lc)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all">
                            Assign Asset
                        </button>
                    )}
                </div>
            ))}
            {jobs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Queue Empty</p>
                </div>
            )}
        </div>
    </div>
);


export default DailyPlanningView;
