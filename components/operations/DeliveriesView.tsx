
import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Client, User, LoadConfirmationStatus, PodAnalysisResult } from '../../types';
import { format } from 'date-fns';
import Modal from '../Modal';
import UpdateJobModal from './UpdateJobModal';
import DriverPODModal from '../DriverPODModal';

interface DeliveriesViewProps {
    currentUser: User;
    loadConfirmations: LoadConfirmation[];
    clients: Client[];
    onUpdateLoadConfirmation: (id: string, updates: Partial<LoadConfirmation>) => void;
}

const DeliveriesView: React.FC<DeliveriesViewProps> = ({ currentUser, loadConfirmations = [], clients = [], onUpdateLoadConfirmation }) => {
    const [areaFilter, setAreaFilter] = useState('All');
    const [updateModalJob, setUpdateModalJob] = useState<LoadConfirmation | null>(null);
    const [podModalJob, setPodModalJob] = useState<LoadConfirmation | null>(null);

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
    
    const deliveryAreas = useMemo(() => ['All', ...Array.from(new Set((loadConfirmations || []).map(lc => lc.deliveryArea).filter(Boolean)))], [loadConfirmations]);

    const deliveryJobs = useMemo(() => {
        return (loadConfirmations || [])
            .filter(lc => ['At Destination Depot', 'Out for Delivery'].includes(lc.status))
            .filter(lc => areaFilter === 'All' || lc.deliveryArea === areaFilter)
            .sort((a, b) => {
                const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
                const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
                if (dateA === Infinity && dateB === Infinity) return new Date(a.date).getTime() - new Date(b.date).getTime();
                return dateA - dateB;
            });
    }, [loadConfirmations, areaFilter]);

    const handlePodSubmit = (loadConId: string, podData: { 
        photo: { name: string, type: string, data: string }, 
        signature: string,
        analysisResult?: PodAnalysisResult
    }) => {
        onUpdateLoadConfirmation(loadConId, {
            podPhoto: podData.photo,
            podSignature: podData.signature,
            podAnalysis: podData.analysisResult,
            status: 'POD Submitted',
            paymentStatus: 'Awaiting POD'
        });
        setPodModalJob(null);
    };
    
    return (
        <>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Planned Deliveries</h3>
                    <div>
                        <label htmlFor="area-filter" className="text-sm text-gray-400 mr-2">Delivery Area:</label>
                        <select id="area-filter" value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600">
                            {deliveryAreas.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
                 <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {deliveryJobs.map(lc => (
                        <div key={lc.id} className="bg-gray-700/50 p-4 rounded-lg">
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="font-bold text-white">{lc.deliveryDate ? format(new Date(lc.deliveryDate), 'EEE, dd MMM') : 'Unscheduled'}</p>
                                    <p className="font-mono text-gray-300 text-xs">{lc.loadConNumber}</p>
                                </div>
                                 <div>
                                    <p className="font-semibold text-purple-300">{clientMap.get(lc.clientId || '') || 'N/A'}</p>
                                    <p className="text-gray-400 truncate" title={lc.deliveryPoint}>{lc.deliveryPoint}</p>
                                </div>
                                <div className="flex items-center">
                                    <select 
                                        value={lc.status} 
                                        onChange={(e) => onUpdateLoadConfirmation(lc.id, { status: e.target.value as LoadConfirmationStatus })}
                                        className="bg-gray-600 text-white p-2 rounded-md w-full"
                                    >
                                        <option value="At Destination Depot">At Destination Depot</option>
                                        <option value="Out for Delivery">Out for Delivery</option>
                                        <option value="Delivered">Delivered</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                     <button onClick={() => setUpdateModalJob(lc)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg text-xs">
                                        Note/Photo
                                    </button>
                                     <button onClick={() => setPodModalJob(lc)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-lg text-xs">
                                        Get POD
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {deliveryJobs.length === 0 && <p className="text-center text-gray-500 py-10">No deliveries match the current filter.</p>}
                </div>
            </div>
            {updateModalJob && (
                <Modal isOpen={!!updateModalJob} onClose={() => setUpdateModalJob(null)}>
                    <UpdateJobModal
                        loadCon={updateModalJob}
                        currentUser={currentUser}
                        onUpdate={onUpdateLoadConfirmation}
                        onCancel={() => setUpdateModalJob(null)}
                    />
                </Modal>
            )}
             {podModalJob && (
                <Modal isOpen={!!podModalJob} onClose={() => setPodModalJob(null)} size="2xl">
                    <DriverPODModal
                        loadCon={podModalJob}
                        onSubmit={handlePodSubmit}
                        onCancel={() => setPodModalJob(null)}
                    />
                </Modal>
            )}
        </>
    );
};

export default DeliveriesView;
