import React, { useMemo, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { Quote } from '../../types';

const rand = (n?: number) => `R ${(Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';
const STATUS_STYLE: Record<string, string> = {
    Requested: 'bg-amber-100 text-amber-700', 'More Info Requested': 'bg-amber-100 text-amber-700',
    Draft: 'bg-slate-200 text-slate-600', Sent: 'bg-blue-100 text-blue-700',
    Accepted: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700',
    Expired: 'bg-slate-200 text-slate-500', Archived: 'bg-slate-200 text-slate-500',
};

const ClientQuotesView: React.FC<{ clientId?: string; onRequest: () => void }> = ({ clientId, onRequest }) => {
    const { quotes = [], handleAcceptQuote, handleRejectQuote } = useOperations() as any;
    const { showToast } = useUIState();
    const [busy, setBusy] = useState<string | null>(null);

    const mine = useMemo(() => (quotes as Quote[])
        .filter(q => q.clientId === clientId && q.status !== 'Archived')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [quotes, clientId]);

    const act = async (q: Quote, accept: boolean) => {
        setBusy(q.id);
        const res = accept ? await handleAcceptQuote(q) : await handleRejectQuote(q);
        setBusy(null);
        showToast(res?.ok ? (accept ? 'Quote accepted — thank you!' : 'Quote declined.') : `Failed: ${res?.error}`);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">My Quotes</h2>
                <button onClick={onRequest} className="text-xs font-bold bg-[#13294b] hover:bg-[#1d3a66] text-white py-2 px-4 rounded-lg">＋ Request a quote</button>
            </div>
            <p className="text-slate-500 mb-6">Your quote requests and quotes from FBN.</p>
            <div className="space-y-2">
                {mine.map(q => {
                    const rd: any = (q as any).requestData || {};
                    const lane = rd.collect_from || rd.collection_area ? `${rd.collect_from || rd.collection_area} → ${rd.deliver_to || rd.delivery_area || ''}` : (q.legs?.[0] ? `${q.legs[0].collectionPoint} → ${q.legs[0].deliveryPoint}` : '');
                    return (
                        <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-sm">{q.quoteNumber}<span className="font-normal text-slate-500"> · {fmt(q.date)}</span></p>
                                    <p className="text-[12px] text-slate-500 truncate">{lane}{q.commodity ? ` · ${q.commodity}` : ''}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${STATUS_STYLE[q.status] || 'bg-slate-200 text-slate-600'}`}>{q.status}</span>
                                    {q.totalAmount > 0 && <p className="text-sm font-black text-emerald-600 mt-1">{rand(q.totalAmount)}</p>}
                                </div>
                            </div>
                            {q.status === 'Sent' && (
                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                                    <button onClick={() => act(q, false)} disabled={busy === q.id} className="text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-1.5 px-3 rounded-lg disabled:opacity-50">Decline</button>
                                    <button onClick={() => act(q, true)} disabled={busy === q.id} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-lg disabled:opacity-50">{busy === q.id ? '…' : 'Accept quote'}</button>
                                </div>
                            )}
                        </div>
                    );
                })}
                {mine.length === 0 && <p className="text-center text-slate-400 py-12">No quotes yet. <button onClick={onRequest} className="text-blue-600 font-bold hover:underline">Request one</button>.</p>}
            </div>
        </div>
    );
};

export default ClientQuotesView;
