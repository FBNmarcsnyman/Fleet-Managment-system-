import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Client, Supplier, User } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { MapPinIcon } from '../icons/MapPinIcon';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';
import { TruckIcon } from '../icons/TruckIcon';
import { useUIState } from '../../contexts/AppContexts';
import { isCollectionStage, isAssigned, nextStep, STATUS_LABEL, statusChip, usesDepotRoute } from '../../lib/loadStatus';

interface CollectionsViewProps {
    currentUser: User;
    loadConfirmations: LoadConfirmation[];
    clients: Client[];
    suppliers: Supplier[];
    vehicles: User[];
    users: User[];
    onUpdateLoadConfirmation: (id: string, updates: Partial<LoadConfirmation>) => void;
    onAssignClick: (lc: LoadConfirmation) => void;
    onNewBookingClick: () => void;
}

const CollectionsView: React.FC<CollectionsViewProps> = ({ loadConfirmations = [], clients = [], suppliers = [], onUpdateLoadConfirmation, onAssignClick, onNewBookingClick }) => {
    const { showModal } = useUIState();
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
    const supplierMap = useMemo(() => new Map((suppliers || []).map(s => [s.id, s.name])), [suppliers]);
    const [busy, setBusy] = useState<string | null>(null);

    const collectionJobs = (loadConfirmations || [])
        .filter(lc => isCollectionStage(lc.status))
        .sort((a, b) => new Date(a.collectionDate || a.date).getTime() - new Date(b.collectionDate || b.date).getTime());

    const transporterOf = (lc: LoadConfirmation): string => {
        if (lc.supplierId) return supplierMap.get(lc.supplierId) || lc.subcontractorName || 'Subcontractor';
        if (lc.vehicleId) return `Own fleet${lc.driverId ? ' — ' + lc.driverId : ''}`;
        return '';
    };

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc);
        if (!step) return;
        setBusy(lc.id);
        await Promise.resolve(onUpdateLoadConfirmation(lc.id, { status: step.status }));
        setBusy(null);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Collections Queue</h3>
                <button onClick={onNewBookingClick} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white text-sm transition-all shadow-lg shadow-blue-900/30">
                    <PlusIcon className="h-4 w-4 mr-2" /> New Booking
                </button>
            </div>
            <div className="space-y-4">
                {collectionJobs.map(lc => {
                    const assigned = isAssigned(lc);
                    const step = nextStep(lc);
                    const depot = usesDepotRoute(lc);
                    return (
                        <div key={lc.id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 hover:border-blue-500/50 transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">{lc.loadConNumber}</button>
                                        <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-gray-300 hover:text-white font-bold truncate">{clientMap.get(lc.clientId)}</button>
                                        {depot && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 uppercase">Depot route</span>}
                                    </div>
                                    <div className="flex items-center text-gray-500 text-xs">
                                        <MapPinIcon className="h-3 w-3 mr-1" />
                                        <span className="truncate">{lc.collectionPoint || 'Collection address not set'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${lc.priority === 'High' ? 'bg-red-900/50 text-red-400 border border-red-500/20' : 'bg-gray-800 text-gray-400'}`}>{lc.priority || 'Std'}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                                </div>
                            </div>

                            <div className="bg-gray-800/40 p-3 rounded-lg border border-white/5 mb-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-gray-800 p-2 rounded-lg"><ArchiveBoxIcon className="h-4 w-4 text-purple-400" /></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-300 mb-0.5">{lc.commodity || 'General Cargo'}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">{lc.packaging || 'Loose'} • {lc.loadSpec || lc.loadType || 'TBA'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Transporter</p>
                                        <p className={`text-xs font-bold ${assigned ? 'text-emerald-300' : 'text-amber-400'}`}>{assigned ? transporterOf(lc) : 'Not assigned'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-gray-700/50 gap-2">
                                <div className="flex items-center text-xs text-gray-500 min-w-0">
                                    <span className="mr-2">To:</span>
                                    <span className="text-gray-400 truncate max-w-[160px]">{lc.deliveryPoint || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => onAssignClick(lc)} className={`text-xs font-black py-1.5 px-3 rounded-lg transition-all ${assigned ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                                        {assigned ? 'Reassign' : 'ASSIGN'}
                                    </button>
                                    {assigned && step && (
                                        <button onClick={() => advance(lc)} disabled={busy === lc.id} className="flex items-center text-xs font-black bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-1.5 px-3 rounded-lg transition-all">
                                            <TruckIcon className="h-3.5 w-3.5 mr-1.5" /> {busy === lc.id ? '…' : step.label}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {collectionJobs.length === 0 && (
                    <div className="text-center py-16 bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-700">
                        <p className="text-gray-500 font-medium">No collections currently planned.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CollectionsView;
