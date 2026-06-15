import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Client, User, PodAnalysisResult } from '../../types';
import { format } from 'date-fns';
import Modal from '../Modal';
import UpdateJobModal from './UpdateJobModal';
import DriverPODModal from '../DriverPODModal';
import { useUIState } from '../../contexts/AppContexts';
import { isDeliveryStage, isInterBranch, nextStep, STATUS_LABEL, statusChip } from '../../lib/loadStatus';

interface DeliveriesViewProps {
    currentUser: User;
    loadConfirmations: LoadConfirmation[];
    clients: Client[];
    onUpdateLoadConfirmation: (id: string, updates: Partial<LoadConfirmation>) => void;
}

const DeliveriesView: React.FC<DeliveriesViewProps> = ({ currentUser, loadConfirmations = [], clients = [], onUpdateLoadConfirmation }) => {
    const { showModal } = useUIState();
    const myBranch = currentUser?.assignedBranches?.[0];
    const [branchFilter, setBranchFilter] = useState<string>(myBranch || 'All');
    const [updateModalJob, setUpdateModalJob] = useState<LoadConfirmation | null>(null);
    const [podModalJob, setPodModalJob] = useState<LoadConfirmation | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    // Branches that actually appear as a destination on inbound loads.
    const branches = useMemo(() => {
        const set = new Set<string>();
        (loadConfirmations || []).forEach(lc => { if (lc.destinationBranch) set.add(lc.destinationBranch); });
        return ['All', ...Array.from(set)];
    }, [loadConfirmations]);

    // Inbound to delivery/receiving: en route, at destination depot, unloaded,
    // out for delivery — plus delivered loads still needing a POD.
    const deliveryJobs = useMemo(() => {
        return (loadConfirmations || [])
            .filter(lc => isDeliveryStage(lc.status) || (lc.status === 'Delivered' && !lc.podPhoto))
            .filter(lc => branchFilter === 'All' || lc.destinationBranch === branchFilter)
            .sort((a, b) => {
                const da = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
                const db = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
                if (da === Infinity && db === Infinity) return new Date(a.date).getTime() - new Date(b.date).getTime();
                return da - db;
            });
    }, [loadConfirmations, branchFilter]);

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc);
        if (!step) return;
        setBusy(lc.id);
        await Promise.resolve(onUpdateLoadConfirmation(lc.id, { status: step.status }));
        setBusy(null);
    };

    const handlePodSubmit = (loadConId: string, podData: { photo: { name: string; type: string; data: string }; signature: string; analysisResult?: PodAnalysisResult }) => {
        onUpdateLoadConfirmation(loadConId, {
            podPhoto: podData.photo,
            podSignature: podData.signature,
            podAnalysis: podData.analysisResult,
            status: 'POD Submitted',
            paymentStatus: 'Awaiting POD',
        });
        setPodModalJob(null);
    };

    return (
        <>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h3 className="text-xl font-bold text-white">Deliveries &amp; Depot Receiving</h3>
                    <div>
                        <label htmlFor="branch-filter" className="text-sm text-gray-400 mr-2">Receiving branch:</label>
                        <select id="branch-filter" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600">
                            {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}
                        </select>
                    </div>
                </div>
                <div className="space-y-3 max-h-[64vh] overflow-y-auto pr-2">
                    {deliveryJobs.map(lc => {
                        const step = nextStep(lc);
                        const incoming = isInterBranch(lc);
                        return (
                            <div key={lc.id} className="bg-gray-700/50 p-4 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm items-center">
                                    <div>
                                        <p className="font-bold text-white">{lc.deliveryDate ? format(new Date(lc.deliveryDate), 'EEE, dd MMM') : 'Unscheduled'}</p>
                                        <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="font-mono text-blue-400 hover:text-blue-300 hover:underline text-xs">{lc.loadConNumber}</button>
                                        {incoming && <p className="text-[10px] font-black text-purple-300 mt-1 uppercase">Incoming: {lc.collectionBranch} → {lc.destinationBranch}</p>}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-purple-300">{clientMap.get(lc.clientId || '') || lc.clientName || 'N/A'}</p>
                                        <p className="text-gray-400 truncate" title={lc.deliveryPoint}>{lc.deliveryPoint}</p>
                                    </div>
                                    <div>
                                        <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 flex-wrap">
                                        {step && (
                                            <button onClick={() => advance(lc)} disabled={busy === lc.id} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-xs">
                                                {busy === lc.id ? '…' : step.label}
                                            </button>
                                        )}
                                        <button onClick={() => setUpdateModalJob(lc)} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg text-xs">Note/Photo</button>
                                        {(lc.status === 'Delivered' || lc.status === 'Out for Delivery') && (
                                            <button onClick={() => setPodModalJob(lc)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-lg text-xs">Get POD</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {deliveryJobs.length === 0 && <p className="text-center text-gray-500 py-10">Nothing inbound for {branchFilter === 'All' ? 'any branch' : branchFilter} right now.</p>}
                </div>
            </div>
            {updateModalJob && (
                <Modal isOpen={!!updateModalJob} onClose={() => setUpdateModalJob(null)}>
                    <UpdateJobModal loadCon={updateModalJob} currentUser={currentUser} onUpdate={onUpdateLoadConfirmation} onCancel={() => setUpdateModalJob(null)} />
                </Modal>
            )}
            {podModalJob && (
                <Modal isOpen={!!podModalJob} onClose={() => setPodModalJob(null)} size="2xl">
                    <DriverPODModal loadCon={podModalJob} onSubmit={handlePodSubmit} onCancel={() => setPodModalJob(null)} />
                </Modal>
            )}
        </>
    );
};

export default DeliveriesView;
