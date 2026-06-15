
import React, { useMemo, useState } from 'react';
import { LoadConfirmation, TripSheet, Client, Quote, Attachment, PodAnalysisResult, Supplier } from '../../types';
import { isToday, isPast, formatDistanceToNowStrict } from 'date-fns';
import { ClipboardIcon } from '../icons/ClipboardIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { TruckIcon } from '../icons/TruckIcon';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import OperationsSummaryWidget from '../dashboard-widgets/OperationsSummaryWidget';
import BrokingAnalytics from './BrokingAnalytics';
import CommunicationHubModal from './CommunicationHubModal';
import Modal from '../Modal';

interface OperationsDashboardProps {}

const OperationsDashboard: React.FC<OperationsDashboardProps> = () => {
    const { loadConfirmations = [], quotes = [], clients = [], suppliers = [], handleUpdateLoadConfirmation } = useOperations();
    const { showModal } = useUIState();
    const [commHubData, setCommHubData] = useState<{ load: LoadConfirmation; client: Client; supplier?: Supplier } | null>(null);
    
    const clientMap = useMemo(() => new Map<string, Client>(
        (clients as Client[]).map((c: Client) => [c.id, c]),
    ), [clients]);
    const supplierMap = useMemo(() => new Map<string, Supplier>(
        (suppliers as Supplier[]).map((s: Supplier) => [s.id, s]),
    ), [suppliers]);

    const { unassigned, overdue, quotesToBook, loadsAwaitingPod } = useMemo(() => {
        return {
            unassigned: (loadConfirmations || []).filter(lc => lc.status === 'Booked'),
            overdue: (loadConfirmations || []).filter(lc => ['Booked', 'Driver Assigned'].includes(lc.status) && lc.collectionDate && isPast(new Date(lc.collectionDate)) && !isToday(new Date(lc.collectionDate))),
            quotesToBook: (quotes || []).filter(q => q.status === 'Accepted' && !(loadConfirmations || []).some(lc => lc.quoteId === q.id)),
            loadsAwaitingPod: (loadConfirmations || []).filter(lc => lc.status === 'Delivered' && !lc.podPhoto)
        };
    }, [loadConfirmations, quotes]);
    
    const handlePodSubmit = (loadConId: string, podData: { photo: Attachment, signature: string, analysisResult?: PodAnalysisResult }) => {
        handleUpdateLoadConfirmation(loadConId, {
            podPhoto: podData.photo,
            podSignature: podData.signature,
            podAnalysis: podData.analysisResult,
            status: 'POD Submitted',
            paymentStatus: 'Awaiting POD'
        });
        showModal('hide');
    };

    const handleCommHubOpen = (load: LoadConfirmation) => {
        const client = clientMap.get(load.clientId);
        const supplier = load.supplierId ? supplierMap.get(load.supplierId) : undefined;
        if (client) {
            setCommHubData({ load, client, supplier });
        }
    };


    return (
        <div className="space-y-8">
            <BrokingAnalytics />
            <OperationsSummaryWidget />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <ActionList
                        title="Accepted Quotes to Book"
                        items={quotesToBook}
                        renderItem={(quote: Quote) => (
                            <>
                                <p className="font-semibold text-white">{clientMap.get(quote.clientId)?.name || 'Unknown Client'}</p>
                                <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">{quote.loadSpec} | {quote.commodity}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{quote.legs[0]?.collectionPoint} &rarr; {quote.legs[0]?.deliveryPoint}</p>
                            </>
                        )}
                        renderAction={(quote: Quote) => (
                            <button onClick={() => showModal('createBooking', { quoteData: quote })} className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded-lg uppercase tracking-wider">Book Now</button>
                        )}
                    />
                     <ActionList
                        title="Loads Awaiting POD"
                        items={loadsAwaitingPod}
                        renderItem={(lc: LoadConfirmation) => (
                             <>
                                <p className="font-semibold text-white">{clientMap.get(lc.clientId)?.name || 'Unknown Client'}</p>
                                <p className="font-mono text-xs text-gray-500">{lc.loadConNumber}</p>
                            </>
                        )}
                        renderAction={(lc: LoadConfirmation) => (
                            <div className="flex gap-2">
                                <button onClick={() => handleCommHubOpen(lc)} className="text-[10px] font-bold bg-gray-700 hover:bg-gray-600 text-blue-400 py-1.5 px-3 rounded-lg uppercase">Update Hub</button>
                                <button onClick={() => showModal('pod', { loadCon: lc, isManualUpload: true, onSubmit: handlePodSubmit })} className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-lg uppercase">Upload POD</button>
                            </div>
                        )}
                    />
                </div>
                <div className="lg:col-span-1 bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-semibold text-white mb-3 flex items-center">
                        <span className="w-1.5 h-4 bg-orange-500 rounded mr-2"></span>
                        Priority Actions
                    </h3>
                    <div className="space-y-4">
                        <ActionList
                            title="Unassigned Jobs"
                            items={unassigned}
                            renderItem={(lc: LoadConfirmation) => (
                                <>
                                    <p className="font-semibold text-white">{clientMap.get(lc.clientId)?.name || 'N/A'}</p>
                                    <p className="text-[10px] text-orange-400 font-bold uppercase">{lc.loadSpec}</p>
                                    <p className="text-xs text-gray-400">{lc.collectionPoint} &rarr; {lc.deliveryPoint}</p>
                                </>
                            )}
                            renderAction={(lc: LoadConfirmation) => (
                                <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white py-1.5 px-3 rounded-lg">Assign</button>
                            )}
                        />
                        <ActionList
                            title="Overdue Collections"
                            items={overdue}
                            renderItem={(lc: LoadConfirmation) => (
                                <>
                                    <p className="font-semibold text-white">{clientMap.get(lc.clientId)?.name || 'N/A'}</p>
                                    <p className="text-xs text-red-400 font-bold">{lc.collectionDate && formatDistanceToNowStrict(new Date(lc.collectionDate), { addSuffix: true })}</p>
                                </>
                            )}
                        />
                    </div>
                </div>
            </div>

            {commHubData && (
                <Modal isOpen={!!commHubData} onClose={() => setCommHubData(null)} size="2xl">
                    <CommunicationHubModal 
                        load={commHubData.load} 
                        client={commHubData.client} 
                        supplier={commHubData.supplier} 
                        onClose={() => setCommHubData(null)} 
                    />
                </Modal>
            )}
        </div>
    );
};

const ActionList: React.FC<{ title: string; items: any[]; renderItem: (item: any) => React.ReactNode; renderAction?: (item: any) => React.ReactNode }> = ({ title, items, renderItem, renderAction }) => (
    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
        <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">{title} ({items.length})</h4>
        <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {items.length > 0 ? items.map(item => (
                <div key={item.id} className="bg-gray-900/60 p-3 rounded-xl border border-white/5 transition-all hover:border-blue-500/30">
                    <div className="flex justify-between items-center">
                        <div>{renderItem(item)}</div>
                        {renderAction && <div>{renderAction(item)}</div>}
                    </div>
                </div>
            )) : <p className="text-xs text-gray-600 text-center py-6 italic font-medium">No items in this queue.</p>}
        </div>
    </div>
);

export default OperationsDashboard;
