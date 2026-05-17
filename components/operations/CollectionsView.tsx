
import React, { useMemo } from 'react';
import { LoadConfirmation, Client, Supplier, User, Quote } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { MapPinIcon } from '../icons/MapPinIcon';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';

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

const CollectionsView: React.FC<CollectionsViewProps> = ({ loadConfirmations = [], clients = [], onAssignClick, onNewBookingClick }) => {
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
    
    const collectionJobs = (loadConfirmations || []).filter(lc => 
        ['Booked', 'Driver Assigned', 'At Collection Point'].includes(lc.status)
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Collections Queue</h3>
                <button onClick={onNewBookingClick} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white text-sm transition-all shadow-lg shadow-blue-900/30">
                    <PlusIcon className="h-4 w-4 mr-2" /> New Booking
                </button>
            </div>
            <div className="space-y-4">
                {collectionJobs.map(lc => (
                    <div key={lc.id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 hover:border-blue-500/50 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">{lc.loadConNumber}</span>
                                    <span className="text-gray-300 font-bold truncate">{clientMap.get(lc.clientId)}</span>
                                </div>
                                <div className="flex items-center text-gray-500 text-xs">
                                    <MapPinIcon className="h-3 w-3 mr-1" />
                                    <span className="truncate">{lc.collectionPoint}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${lc.priority === 'High' ? 'bg-red-900/50 text-red-400 border border-red-500/20' : 'bg-gray-800 text-gray-400'}`}>
                                    {lc.priority}
                                </span>
                                <span className="text-[10px] text-gray-500 mt-1 font-mono">{lc.status}</span>
                            </div>
                        </div>

                        {/* Cargo Detail Block */}
                        <div className="bg-gray-800/40 p-3 rounded-lg border border-white/5 mb-4">
                            <div className="flex items-start gap-3">
                                <div className="bg-gray-800 p-2 rounded-lg">
                                    <ArchiveBoxIcon className="h-4 w-4 text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-gray-300 mb-0.5">{lc.commodity || 'General Cargo'}</p>
                                    <p className="text-[10px] text-gray-500 font-medium">{lc.packaging || 'Loose'} • {lc.loadSpec || 'TBA'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                            <div className="flex items-center text-xs text-gray-500">
                                <span className="mr-2">To:</span>
                                <span className="text-gray-400 truncate max-w-[150px]">{lc.deliveryPoint}</span>
                            </div>
                            <button onClick={() => onAssignClick(lc)} className="text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-4 rounded-lg transition-all group-hover:scale-105 active:scale-95">
                                ASSIGN
                            </button>
                        </div>
                    </div>
                ))}
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
