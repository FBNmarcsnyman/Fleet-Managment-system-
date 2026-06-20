
import React, { useState, useMemo } from 'react';
import { Quote, Client, Supplier, QuoteStatus } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { PlusIcon } from '../icons/PlusIcon';
import { format } from 'date-fns';
import { EditIcon } from '../icons/EditIcon';
import { MailIcon } from '../icons/MailIcon';
import { ShareIcon } from '../icons/ShareIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import Modal from '../Modal';
import AcceptQuoteModal from './AcceptQuoteModal';
import RfqBoard from './RfqBoard';

const QuotesView: React.FC<{
    quotes: Quote[];
    clients: Client[];
    suppliers: Supplier[];
    onShowPdf: (quote: Quote, client: Client) => void;
}> = ({ quotes = [], clients = [], suppliers = [], onShowPdf }) => {
    const { showModal, showToast } = useUIState();
    const { loadConfirmations = [], handleCreateQuote, handleUpdateQuote } = useOperations();
    const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'All'>('All');
    const [quoteToAccept, setQuoteToAccept] = useState<Quote | null>(null);
    const [tab, setTab] = useState<'quotes' | 'rfq'>('quotes');
    
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const filteredQuotes = useMemo(() => {
        return (quotes || [])
            .filter(q => statusFilter === 'All' || q.status === statusFilter)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [quotes, statusFilter]);

    // Wrap the async handlers so the modal sees void-returning onSubmit
    // (matches CreateQuoteForm's contract) but the Result surfaces as a toast.
    const handleCreateQuoteClick = () => {
        showModal('createQuote', {
            clients,
            suppliers,
            onSubmit: async (quote: any) => {
                const result = await handleCreateQuote(quote);
                if (result.ok) showToast(`Quote ${result.value!.quoteNumber} created.`);
                else showToast(`Failed to create quote: ${result.error}`);
            },
        });
    };

    const handleEditQuote = (quote: Quote) => {
        showModal('editQuote', {
            quoteData: quote,
            clients,
            suppliers,
            onSubmit: async (q: Quote) => {
                const result = await handleUpdateQuote(q);
                if (result.ok) showToast(`Quote ${q.quoteNumber} updated.`);
                else showToast(`Failed to update quote: ${result.error}`);
            },
        });
    };

    const getStatusColor = (status: QuoteStatus) => ({
        'Draft': 'bg-gray-700 text-gray-300',
        'Sent': 'bg-blue-900/50 text-blue-300',
        'Accepted': 'bg-green-900/50 text-green-300',
        'Rejected': 'bg-red-900/50 text-red-300',
        'Expired': 'bg-yellow-900/50 text-yellow-300',
    })[status];

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-2 mb-5 border-b border-gray-700">
                <button onClick={() => setTab('quotes')} className={`px-4 py-2 text-sm font-bold -mb-px border-b-2 ${tab === 'quotes' ? 'border-brand-secondary text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Client Quotes</button>
                <button onClick={() => setTab('rfq')} className={`px-4 py-2 text-sm font-bold -mb-px border-b-2 ${tab === 'rfq' ? 'border-brand-secondary text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Carrier RFQs</button>
            </div>

            {tab === 'rfq' ? <RfqBoard suppliers={suppliers} /> : (
            <>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Quotes</h3>
                <div className="flex items-center space-x-2">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-gray-700 p-2 rounded-md text-sm">
                        <option value="All">All Statuses</option>
                        {(['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as QuoteStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={handleCreateQuoteClick} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                        <PlusIcon className="h-5 w-5 mr-2" /> New Quote
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="p-2">Quote #</th>
                            <th className="p-2">Client</th>
                            <th className="p-2">Date</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2 text-center">Status</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredQuotes.map(quote => {
                            const client = clients.find(c => c.id === quote.clientId);
                            const isBooked = (loadConfirmations || []).some(lc => lc.quoteId === quote.id);
                            return (
                            <tr key={quote.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                <td className="p-2 font-mono font-semibold text-white">{quote.quoteNumber}</td>
                                <td className="p-2">{clientMap.get(quote.clientId) || 'Unknown'}</td>
                                <td className="p-2">{format(new Date(quote.date), 'dd MMM yyyy')}</td>
                                <td className="p-2 text-right font-mono">R {quote.totalAmount.toFixed(2)}</td>
                                <td className="p-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(quote.status)}`}>{quote.status}</span></td>
                                <td className="p-2 text-right space-x-1">
                                    {(quote.status === 'Sent' || quote.status === 'Draft') && !isBooked && (
                                        <button 
                                            onClick={() => setQuoteToAccept(quote)} 
                                            className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-lg flex items-center inline-flex"
                                        >
                                            <CheckCircleIcon className="h-4 w-4 mr-1"/> Accept
                                        </button>
                                    )}
                                    <button onClick={() => client && onShowPdf(quote, client)} className="p-1 text-gray-400 hover:text-white" title="View PDF"><ShareIcon className="h-4 w-4"/></button>
                                    <button className="p-1 text-gray-400 hover:text-white" title="Send to Client"><MailIcon className="h-4 w-4"/></button>
                                    <button onClick={() => handleEditQuote(quote)} className="p-1 text-gray-400 hover:text-white" title="Edit"><EditIcon className="h-4 w-4"/></button>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {quoteToAccept && (
                <Modal isOpen={!!quoteToAccept} onClose={() => setQuoteToAccept(null)} size="2xl">
                    <AcceptQuoteModal 
                        quote={quoteToAccept} 
                        client={clients.find(c => c.id === quoteToAccept.clientId)!}
                        suppliers={suppliers}
                        onSuccess={() => {
                            setQuoteToAccept(null);
                            showToast("Quote converted to Load Confirmation successfully.");
                        }}
                        onCancel={() => setQuoteToAccept(null)}
                    />
                </Modal>
            )}
            </>
            )}
        </div>
    );
};

export default QuotesView;
