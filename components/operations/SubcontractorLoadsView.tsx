
import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Supplier, Client, Attachment, PodAnalysisResult } from '../../types';
import { useUIState } from '../../contexts/AppContexts';
import { format } from 'date-fns';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UploadIcon } from '../icons/UploadIcon';

interface SubcontractorLoadsViewProps {
    loadConfirmations: LoadConfirmation[];
    suppliers: Supplier[];
    clients: Client[];
    onUpdateLoadConfirmation: (id: string, updates: Partial<LoadConfirmation>) => void;
}

const SubcontractorLoadsView: React.FC<SubcontractorLoadsViewProps> = ({
    loadConfirmations = [],
    suppliers = [],
    clients = [],
    onUpdateLoadConfirmation,
}) => {
    const { showModal, showToast } = useUIState();
    const [filter, setFilter] = useState<'All' | 'POD Awaiting' | 'Sent' | 'History'>('All');

    const transportSuppliers = useMemo(() => suppliers.filter(s => s.type === 'Transport'), [suppliers]);
    const supplierMap = useMemo(() => new Map(transportSuppliers.map(s => [s.id, s])), [transportSuppliers]);
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

    const brokeredLoads = useMemo(() => {
        return (loadConfirmations || [])
            .filter(lc => lc.supplierId && supplierMap.has(lc.supplierId))
            .filter(lc => {
                // "Invoiced" = completed/imported history — kept out of the active
                // board (you only send current loads); see it under History.
                if (filter === 'History') return lc.status === 'Invoiced';
                if (lc.status === 'Invoiced') return false;
                if (filter === 'POD Awaiting') return !lc.podPhoto;
                if (filter === 'Sent') return !!lc.sentToSupplierDate;
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [loadConfirmations, filter, supplierMap]);

    const handleSendLoadCon = (lc: LoadConfirmation) => {
        onUpdateLoadConfirmation(lc.id, { sentToSupplierDate: new Date().toISOString() });
        showToast(`Load Confirmation ${lc.loadConNumber} marked as sent.`);
    };

    const handleViewPdf = (lc: LoadConfirmation) => {
        // Opens the 3-document set: LoadCon (subbie), Client Order (client), Delivery Note.
        showModal('loadDocuments', { loadCon: lc });
    };

    const handleViewPod = (podPhoto: Attachment) => {
        showModal('viewPod', { podPhoto });
    };

    const handlePodSubmit = (loadConId: string, podData: { 
        photo: Attachment, 
        signature: string,
        analysisResult?: PodAnalysisResult
    }) => {
        onUpdateLoadConfirmation(loadConId, {
            podPhoto: podData.photo,
            podSignature: podData.signature,
            podAnalysis: podData.analysisResult,
            paymentStatus: 'Awaiting POD'
        });
        showModal('hide');
        showToast('POD has been successfully uploaded.');
    };

    const handleUploadPodClick = (lc: LoadConfirmation) => {
        showModal('pod', {
            loadCon: lc,
            isManualUpload: true,
            onSubmit: handlePodSubmit,
            onCancel: () => showModal('hide'),
        });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Subcontractor Loads</h3>
                <div className="flex items-center space-x-3">
                    <select value={filter} onChange={e => setFilter(e.target.value as any)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600">
                        <option value="All">Active Loads</option>
                        <option value="POD Awaiting">POD Awaiting</option>
                        <option value="Sent">Sent to Supplier</option>
                        <option value="History">History (imported)</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">LoadCon #</th>
                            <th className="p-2 text-gray-400">Supplier</th>
                            <th className="p-2 text-gray-400">Loading Date</th>
                            <th className="p-2 text-gray-400">Route</th>
                            <th className="p-2 text-gray-400">Status</th>
                            <th className="p-2 text-gray-400">Sent to Supplier</th>
                            <th className="p-2 text-gray-400">POD Status</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {brokeredLoads.map(lc => {
                            const supplier = supplierMap.get(lc.supplierId!);
                            return (
                                <tr key={lc.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                    <td className="p-2 font-mono"><button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-blue-400 hover:text-blue-300 hover:underline font-bold">{lc.loadConNumber}</button></td>
                                    <td className="p-2 font-semibold">{supplier?.name}</td>
                                    <td className="p-2 text-gray-300">{lc.collectionDate ? format(new Date(lc.collectionDate), 'dd MMM yyyy') : '—'}</td>
                                    <td className="p-2">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</td>
                                    <td className="p-2">{lc.status}</td>
                                    <td className="p-2">
                                        {lc.sentToSupplierDate ? (
                                            <span className="flex items-center text-green-400 text-xs"><CheckCircleIcon className="h-4 w-4 mr-1" />{format(new Date(lc.sentToSupplierDate), 'dd MMM')}</span>
                                        ) : (
                                            <button onClick={() => handleSendLoadCon(lc)} className="text-xs font-semibold bg-blue-600 text-white py-1 px-2 rounded-lg">Send Now</button>
                                        )}
                                    </td>
                                    <td className="p-2">
                                        {lc.podPhoto ? (
                                            <button onClick={() => handleViewPod(lc.podPhoto!)} className="inline-flex items-center text-xs font-semibold bg-green-600/20 text-green-400 hover:bg-green-600/30 py-1 px-2 rounded-lg">View POD</button>
                                        ) : lc.status === 'Delivered' ? (
                                            <button onClick={() => handleUploadPodClick(lc)} className="inline-flex items-center text-xs font-semibold bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-lg"><UploadIcon className="h-4 w-4 mr-1"/> Upload POD</button>
                                        ) : (
                                            <span className="text-yellow-400 text-xs">Awaiting delivery</span>
                                        )}
                                    </td>
                                    <td className="p-2 text-right">
                                        <button onClick={() => handleViewPdf(lc)} className="text-xs font-semibold bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded-lg">Documents</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {brokeredLoads.length === 0 && <p className="text-center text-gray-500 py-16">No subcontractor loads found.</p>}
            </div>
        </div>
    );
};

export default SubcontractorLoadsView;
