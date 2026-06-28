import React, { useMemo } from 'react';
import { useOperations } from '../../contexts/AppContexts';
import { LoadConfirmation, Quote } from '../../types';

const TERMINAL = ['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled', 'Completed'];
const OPEN_QUOTE = ['Requested', 'More Info Requested', 'Draft', 'Sent'];
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';

const ClientDashboard: React.FC<{ clientId?: string; clientName?: string; onNavigate: (v: string) => void }> = ({ clientId, clientName, onNavigate }) => {
    const { loadConfirmations = [], quotes = [] } = useOperations() as any;

    const myLoads = useMemo(() => (loadConfirmations as LoadConfirmation[]).filter(l => l.clientId === clientId), [loadConfirmations, clientId]);
    const activeLoads = useMemo(() => myLoads.filter(l => !(l as any).archived && !TERMINAL.includes(l.status)), [myLoads]);
    const openQuotes = useMemo(() => (quotes as Quote[]).filter(q => q.clientId === clientId && OPEN_QUOTE.includes(q.status)), [quotes, clientId]);
    const invoicedLoads = useMemo(() => myLoads.filter(l => (l as any).invoiceNumber).sort((a, b) => new Date((b as any).invoiceDate || b.date).getTime() - new Date((a as any).invoiceDate || a.date).getTime()), [myLoads]);
    const outstanding = useMemo(() => invoicedLoads.filter(l => (l as any).paymentStatus !== 'Paid'), [invoicedLoads]);

    const kpi = (label: string, value: React.ReactNode, sub: string, onClick?: () => void, accent = 'text-slate-900') => (
        <button onClick={onClick} disabled={!onClick} className={`text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ${onClick ? 'hover:border-[#13294b]/40 transition' : 'cursor-default'}`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-3xl font-black ${accent}`}>{value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
        </button>
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome, {clientName}</h1>
                    <p className="text-slate-500 text-sm mt-1">Your shipments, quotes and invoices at a glance.</p>
                </div>
                <button onClick={() => onNavigate('request')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-5 rounded-lg text-sm shrink-0">＋ Request a quote</button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpi('Active loads', activeLoads.length, 'in progress', () => onNavigate('loads'), 'text-blue-600')}
                {kpi('Open quotes', openQuotes.length, 'awaiting / to review', () => onNavigate('quotes'), 'text-amber-600')}
                {kpi('Outstanding invoices', outstanding.length, outstanding.length ? 'awaiting payment' : 'all settled', () => onNavigate('financial'), outstanding.length ? 'text-red-600' : 'text-slate-900')}
                {kpi('Total loads', myLoads.length, 'all time', () => onNavigate('loads'))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active loads</h2><button onClick={() => onNavigate('loads')} className="text-xs font-bold text-blue-600 hover:text-blue-800">All loads →</button></div>
                    {activeLoads.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">No active loads.</p> : (
                        <div className="space-y-2">{activeLoads.slice(0, 6).map(l => (
                            <button key={l.id} onClick={() => onNavigate('loads')} className="w-full text-left flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 rounded-xl p-3">
                                <div className="min-w-0"><p className="font-bold text-slate-900 text-sm truncate">{l.loadConNumber || (l as any).loadRefNo || '—'}</p><p className="text-[11px] text-slate-500 truncate">{l.collectionPoint} → {l.deliveryPoint}</p></div>
                                <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700">{l.status}</span>
                            </button>
                        ))}</div>
                    )}
                </section>

                <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Open quotes</h2><button onClick={() => onNavigate('quotes')} className="text-xs font-bold text-blue-600 hover:text-blue-800">My quotes →</button></div>
                    {openQuotes.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">No open quotes.</p> : (
                        <div className="space-y-2">{openQuotes.slice(0, 6).map(q => (
                            <button key={q.id} onClick={() => onNavigate('quotes')} className="w-full text-left flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 rounded-xl p-3">
                                <div className="min-w-0"><p className="font-bold text-slate-900 text-sm truncate">{q.quoteNumber}</p><p className="text-[11px] text-slate-500 truncate">{q.commodity || fmt(q.date)}</p></div>
                                <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700">{q.status}</span>
                            </button>
                        ))}</div>
                    )}
                </section>
            </div>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent invoices</h2><button onClick={() => onNavigate('financial')} className="text-xs font-bold text-blue-600 hover:text-blue-800">Financial →</button></div>
                {invoicedLoads.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">No invoices yet.</p> : (
                    <div className="space-y-2">{invoicedLoads.slice(0, 5).map(l => (
                        <div key={l.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl p-3">
                            <div className="min-w-0"><p className="font-bold text-slate-900 text-sm truncate">{(l as any).invoiceNumber} <span className="font-normal text-slate-500">· {l.loadConNumber}</span></p><p className="text-[11px] text-slate-500">{fmt((l as any).invoiceDate)}</p></div>
                            <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg ${(l as any).paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{(l as any).paymentStatus || 'Unpaid'}</span>
                        </div>
                    ))}</div>
                )}
            </section>
        </div>
    );
};

export default ClientDashboard;
