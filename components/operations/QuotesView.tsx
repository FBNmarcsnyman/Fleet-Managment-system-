
import React, { useState, useMemo, useEffect } from 'react';
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
import QuoteDetailModal from './QuoteDetailModal';

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
    const [quoteDetail, setQuoteDetail] = useState<Quote | null>(null);
    const [sending, setSending] = useState<string | null>(null);
    // Test-quote tidy-up: Marc ticks the ones he wants gone, then archives them
    // (reversible — sets status to 'Archived', never deletes).
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleSelected = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const archiveSelected = async () => {
        const ids = [...selected];
        if (!ids.length) return;
        if (!confirm(`Archive ${ids.length} quote(s)? They move to the "Archived" filter — not deleted, you can restore them.`)) return;
        for (const id of ids) {
            const q = quotes.find(x => x.id === id);
            if (q) await handleUpdateQuote({ ...q, status: 'Archived' as QuoteStatus });
        }
        setSelected(new Set());
        showToast(`Archived ${ids.length} quote(s).`);
    };

    const restoreQuote = async (q: Quote) => {
        await handleUpdateQuote({ ...q, status: 'Requested' as QuoteStatus });
        showToast(`Restored ${q.quoteNumber}.`);
    };

    // Win/loss board — values from accepted vs declined quotes (all quotes, not
    // just the current filter), so the totals reflect the full pipeline.
    const stats = useMemo(() => {
        const accepted = quotes.filter(q => q.status === 'Accepted');
        const rejected = quotes.filter(q => q.status === 'Rejected');
        const open = quotes.filter(q => ['Requested', 'More Info Requested', 'Draft', 'Sent'].includes(q.status));
        const sum = (arr: Quote[]) => arr.reduce((s, q) => s + (q.totalAmount || 0), 0);
        const decided = accepted.length + rejected.length;
        // Average rate per kg across priced quotes (those with a weight + amount).
        const priced = quotes.filter(q => Number(q.requestData?.total_weight) > 0 && (q.totalAmount || 0) > 0);
        const avgPerKg = priced.length
            ? priced.reduce((s, q) => s + (q.totalAmount / Number(q.requestData!.total_weight)), 0) / priced.length
            : 0;
        return {
            acceptedCount: accepted.length, rejectedCount: rejected.length, openCount: open.length,
            acceptedValue: sum(accepted), rejectedValue: sum(rejected), openValue: sum(open),
            winRate: decided ? Math.round((accepted.length / decided) * 100) : 0,
            avgPerKg,
        };
    }, [quotes]);

    // Per-quote rate per kg, or null when we don't have a weight to divide by.
    const ratePerKg = (q: Quote): number | null => {
        const w = Number(q.requestData?.total_weight);
        return w > 0 && (q.totalAmount || 0) > 0 ? q.totalAmount / w : null;
    };

    // Arrived from the "Open Quotes to price" email — open that quote's detail
    // once it's loaded, then clear the stash so it won't re-open. We read from
    // sessionStorage (set before login) or the ?quote= URL param.
    useEffect(() => {
        let qid = '';
        try { qid = sessionStorage.getItem('fbn_pendingQuote') || ''; } catch { /* ignore */ }
        if (!qid) qid = new URLSearchParams(window.location.search).get('quote') || '';
        if (!qid || quoteDetail) return;
        const q = quotes.find(x => x.id === qid);
        if (q) {
            setQuoteDetail(q);
            try { sessionStorage.removeItem('fbn_pendingQuote'); } catch { /* ignore */ }
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [quotes]);

    const handleSendQuote = async (quote: Quote) => {
        if (!confirm(`Send quote ${quote.quoteNumber} to client?`)) return;
        setSending(quote.id);
        try {
            const { data: { session } } = await (await import('../../lib/supabase')).supabase.auth.getSession();
            const resp = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-send`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ quote_id: quote.id }),
                }
            );
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            showToast(`Quote ${quote.quoteNumber} sent to ${data.sent_to}`);
        } catch (e: any) {
            showToast(`Failed to send: ${e.message}`);
        } finally {
            setSending(null);
        }
    };

    const handleSendProforma = async (quote: Quote) => {
        if (!confirm(`Email a COD proforma invoice for ${quote.quoteNumber} to the client (cc debtors)?`)) return;
        setSending(quote.id);
        try {
            const { data: { session } } = await (await import('../../lib/supabase')).supabase.auth.getSession();
            const resp = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-proforma`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ quote_id: quote.id }),
                }
            );
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            showToast(`Proforma ${quote.quoteNumber} sent to ${data.sent_to} (cc debtors)`);
        } catch (e: any) {
            showToast(`Failed to send proforma: ${e.message}`);
        } finally {
            setSending(null);
        }
    };

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const filteredQuotes = useMemo(() => {
        return (quotes || [])
            // Hide archived from the default view; show them only when explicitly filtered.
            .filter(q => statusFilter === 'All' ? q.status !== 'Archived' : q.status === statusFilter)
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
        'Requested': 'bg-amber-900/50 text-amber-300',
        'More Info Requested': 'bg-purple-900/50 text-purple-300',
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
            {/* Win / loss dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <div className="rounded-xl p-4 bg-green-900/20 border border-green-700/40">
                    <div className="text-xs font-bold text-green-400 uppercase tracking-widest">Accepted</div>
                    <div className="text-2xl font-black text-white mt-1">R {stats.acceptedValue.toLocaleString()}</div>
                    <div className="text-xs text-green-300/70 mt-0.5">{stats.acceptedCount} quote{stats.acceptedCount === 1 ? '' : 's'}</div>
                </div>
                <div className="rounded-xl p-4 bg-red-900/20 border border-red-700/40">
                    <div className="text-xs font-bold text-red-400 uppercase tracking-widest">Declined</div>
                    <div className="text-2xl font-black text-white mt-1">R {stats.rejectedValue.toLocaleString()}</div>
                    <div className="text-xs text-red-300/70 mt-0.5">{stats.rejectedCount} quote{stats.rejectedCount === 1 ? '' : 's'}</div>
                </div>
                <div className="rounded-xl p-4 bg-blue-900/20 border border-blue-700/40">
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-widest">Open Pipeline</div>
                    <div className="text-2xl font-black text-white mt-1">R {stats.openValue.toLocaleString()}</div>
                    <div className="text-xs text-blue-300/70 mt-0.5">{stats.openCount} awaiting</div>
                </div>
                <div className="rounded-xl p-4 bg-amber-900/20 border border-amber-700/40">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">Win Rate</div>
                    <div className="text-2xl font-black text-white mt-1">{stats.winRate}%</div>
                    <div className="text-xs text-amber-300/70 mt-0.5">accepted vs declined</div>
                </div>
                <div className="rounded-xl p-4 bg-slate-700/30 border border-slate-500/40">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-widest">Avg Rate / kg</div>
                    <div className="text-2xl font-black text-white mt-1">R {stats.avgPerKg.toFixed(2)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">across priced quotes</div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Quotes</h3>
                <div className="flex items-center space-x-2">
                    {selected.size > 0 && (
                        <button onClick={archiveSelected} className="flex items-center font-bold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-sm">
                            Archive {selected.size} selected
                        </button>
                    )}
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="bg-gray-700 p-2 rounded-md text-sm">
                        <option value="All">All Statuses</option>
                        {(['Requested', 'More Info Requested', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Archived'] as QuoteStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
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
                            <th className="p-2 w-8"></th>
                            <th className="p-2">Quote #</th>
                            <th className="p-2">Client</th>
                            <th className="p-2">Date</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2 text-right">R / kg</th>
                            <th className="p-2 text-center">Status</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredQuotes.map(quote => {
                            const client = clients.find(c => c.id === quote.clientId);
                            const isBooked = (loadConfirmations || []).some(lc => lc.quoteId === quote.id);
                            return (
                            <tr key={quote.id} className="border-b border-gray-700/50 hover:bg-gray-700/50 cursor-pointer" onClick={() => setQuoteDetail(quote)}>
                                <td className="p-2" onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={selected.has(quote.id)} onChange={() => toggleSelected(quote.id)} className="w-4 h-4 accent-blue-500 cursor-pointer" title="Select to archive" />
                                </td>
                                <td className="p-2 font-mono font-semibold text-white">{quote.quoteNumber}</td>
                                <td className="p-2">{clientMap.get(quote.clientId) || 'Unknown'}</td>
                                <td className="p-2">{format(new Date(quote.date), 'dd MMM yyyy')}</td>
                                <td className="p-2 text-right font-mono">R {quote.totalAmount.toFixed(2)}</td>
                                <td className="p-2 text-right font-mono text-green-400">{ratePerKg(quote) !== null ? `R ${ratePerKg(quote)!.toFixed(2)}` : '—'}</td>
                                <td className="p-2 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(quote.status)}`}>{quote.status}</span>
                                    {quote.requestMoreInfo?.last_requested_at && (
                                        <div className="flex items-center justify-center text-green-400 text-xs mt-1" title="More info request sent to the client">
                                            <CheckCircleIcon className="h-4 w-4 mr-1" />Info req {format(new Date(quote.requestMoreInfo.last_requested_at), 'dd MMM')}{Number(quote.requestMoreInfo.count) > 1 ? ` ·${quote.requestMoreInfo.count}x` : ''}
                                        </div>
                                    )}
                                </td>
                                <td className="p-2 text-right space-x-1" onClick={e => e.stopPropagation()}>
                                    {quote.status === 'Archived' && (
                                        <button onClick={() => restoreQuote(quote)} className="text-xs font-bold bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded-lg inline-flex items-center">
                                            Restore
                                        </button>
                                    )}
                                    {(quote.status === 'Requested' || quote.status === 'More Info Requested') && (
                                        <button
                                            onClick={() => setQuoteDetail(quote)}
                                            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white py-1 px-3 rounded-lg inline-flex items-center"
                                        >
                                            View Request
                                        </button>
                                    )}
                                    {(quote.status === 'Sent' || quote.status === 'Draft') && !isBooked && (
                                        <button
                                            onClick={() => setQuoteToAccept(quote)}
                                            className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-lg inline-flex items-center"
                                        >
                                            <CheckCircleIcon className="h-4 w-4 mr-1"/> Accept
                                        </button>
                                    )}
                                    {(quote.status === 'Draft' || quote.status === 'Sent' || quote.status === 'Accepted') && (
                                        <button onClick={() => handleSendProforma(quote)} disabled={sending === quote.id} className="text-[10px] font-black bg-slate-600 hover:bg-slate-500 text-white py-1 px-2 rounded-lg uppercase" title="Email COD proforma invoice (cc debtors)">Proforma</button>
                                    )}
                                    <button onClick={() => client && onShowPdf(quote, client)} className="p-1 text-gray-400 hover:text-white" title="View PDF"><ShareIcon className="h-4 w-4"/></button>
                                    <button onClick={() => handleSendQuote(quote)} disabled={sending === quote.id} className="p-1 text-gray-400 hover:text-white" title="Send to Client">{sending === quote.id ? <span className="text-xs">...</span> : <MailIcon className="h-4 w-4"/>}</button>
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

            {quoteDetail && (
                <Modal isOpen={!!quoteDetail} onClose={() => setQuoteDetail(null)} size="2xl">
                    <QuoteDetailModal
                        quote={quoteDetail}
                        client={clients.find(c => c.id === quoteDetail.clientId)}
                        onClose={() => setQuoteDetail(null)}
                        onSendQuote={async (q) => { await handleSendQuote(q); }}
                        onSendProforma={async (q) => { await handleSendProforma(q); }}
                        onQuoteIt={(q) => {
                            setQuoteDetail(null);
                            // Price the SAME quote in place — keep its number, just move
                            // it from "Requested" to a priced "Draft". No duplicate row.
                            showModal('editQuote', {
                                quoteData: q,
                                clients,
                                suppliers,
                                onSubmit: async (updated: any) => {
                                    const next = {
                                        ...updated,
                                        status: (updated.status === 'Requested' || updated.status === 'More Info Requested') ? 'Draft' : updated.status,
                                    };
                                    const result = await handleUpdateQuote(next);
                                    if (result.ok) showToast(`Quote ${next.quoteNumber} priced — ready to send.`);
                                    else showToast(`Failed to update quote: ${result.error}`);
                                },
                            });
                        }}
                    />
                </Modal>
            )}
            </>
            )}
        </div>
    );
};

export default QuotesView;
