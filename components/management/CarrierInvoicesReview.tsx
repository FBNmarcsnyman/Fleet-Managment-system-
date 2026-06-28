import React, { useMemo, useState } from 'react';
import { SubcontractorInvoice, Supplier } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import Modal from '../Modal';
import DateField from '../operations/DateField';

const rand = (n?: number) => `R ${(Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';
const STATUS_STYLE: Record<string, string> = {
    Submitted: 'bg-blue-100 text-blue-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Queried: 'bg-amber-100 text-amber-700',
    Paid: 'bg-slate-200 text-slate-600',
};

// FBN accounts review of carrier invoices: approve, query (with note), or mark paid.
const CarrierInvoicesReview: React.FC = () => {
    const { subcontractorInvoices = [], suppliers = [], handleUpdateSupplierInvoice } = useOperations() as any;
    const { showToast } = useUIState();
    const [filter, setFilter] = useState<'all' | SubcontractorInvoice['status']>('Submitted');
    const [action, setAction] = useState<{ inv: SubcontractorInvoice; kind: 'query' | 'paid' } | null>(null);
    const [note, setNote] = useState('');
    const [payRef, setPayRef] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
    const [busy, setBusy] = useState(false);

    const supName = (id: string) => (suppliers as Supplier[]).find(s => s.id === id)?.name || 'Carrier';
    const invoices = useMemo(() => (subcontractorInvoices as SubcontractorInvoice[])
        .slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [subcontractorInvoices]);
    const shown = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
    const counts = useMemo(() => ({
        Submitted: invoices.filter(i => i.status === 'Submitted').length,
        Approved: invoices.filter(i => i.status === 'Approved').length,
        Queried: invoices.filter(i => i.status === 'Queried').length,
        Paid: invoices.filter(i => i.status === 'Paid').length,
    }), [invoices]);

    const setStatus = async (inv: SubcontractorInvoice, status: SubcontractorInvoice['status'], extra: Partial<SubcontractorInvoice> = {}) => {
        const res = await handleUpdateSupplierInvoice(inv.id, { status, ...extra });
        showToast(res?.ok ? `${inv.invoiceNumber} → ${status}.` : `Failed: ${res?.error}`);
    };
    const openAction = (inv: SubcontractorInvoice, kind: 'query' | 'paid') => { setAction({ inv, kind }); setNote(''); setPayRef(''); setPayDate(new Date().toISOString().slice(0, 10)); };
    const confirmAction = async () => {
        if (!action) return;
        if (action.kind === 'query' && !note.trim()) { showToast('Enter a query note.'); return; }
        if (action.kind === 'paid' && !payRef.trim()) { showToast('Enter the payment reference.'); return; }
        setBusy(true);
        await setStatus(action.inv, action.kind === 'query' ? 'Queried' : 'Paid',
            action.kind === 'query' ? { queryNote: note.trim() } : { paymentReference: payRef.trim(), paymentDate: payDate });
        setBusy(false); setAction(null);
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-1">Carrier Invoices</h3>
            <p className="text-xs text-slate-500 mb-4">Review subcontractor invoices — approve, query, or mark paid. The carrier is emailed on each decision.</p>
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['Submitted', 'Approved', 'Queried', 'Paid', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${filter === f ? 'bg-[#13294b] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {f === 'all' ? 'All' : f}{f !== 'all' && counts[f] ? ` (${counts[f]})` : ''}
                    </button>
                ))}
            </div>
            {shown.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No invoices{filter !== 'all' ? ` with status ${filter}` : ''}.</p> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead><tr className="border-b border-slate-200 text-slate-500">
                            <th className="p-2 font-bold">Carrier</th><th className="p-2 font-bold">Invoice</th><th className="p-2 font-bold">Load</th><th className="p-2 font-bold text-right">Total</th><th className="p-2 font-bold text-center">Status</th><th className="p-2 font-bold text-right">Actions</th>
                        </tr></thead>
                        <tbody>
                            {shown.map(i => (
                                <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-2 font-bold text-slate-900">{supName(i.supplierId)}</td>
                                    <td className="p-2 text-slate-600">{i.invoiceNumber}<span className="block text-[11px] text-slate-400">{fmt(i.invoiceDate)}{i.invoicePdfUrl ? <> · <a href={i.invoicePdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">PDF</a></> : ''}</span></td>
                                    <td className="p-2 text-slate-500">{i.loadConNumber || '-'}</td>
                                    <td className="p-2 text-right font-mono text-slate-800">{rand(i.total)}<span className="block text-[10px] text-slate-400">excl {rand(i.amountExclVat)}</span></td>
                                    <td className="p-2 text-center"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[i.status]}`}>{i.status}</span>{i.status === 'Queried' && i.queryNote && <span className="block text-[10px] text-amber-600 mt-0.5 max-w-[160px] truncate" title={i.queryNote}>{i.queryNote}</span>}</td>
                                    <td className="p-2 text-right whitespace-nowrap">
                                        {(i.status === 'Submitted' || i.status === 'Queried') && <button onClick={() => setStatus(i, 'Approved')} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 mr-3">Approve</button>}
                                        {i.status !== 'Paid' && i.status !== 'Queried' && <button onClick={() => openAction(i, 'query')} className="text-[11px] font-bold text-amber-600 hover:text-amber-800 mr-3">Query</button>}
                                        {i.status === 'Approved' && <button onClick={() => openAction(i, 'paid')} className="text-[11px] font-bold text-[#13294b] hover:underline">Mark paid</button>}
                                        {i.status === 'Paid' && <span className="text-[11px] text-slate-400">{i.paymentReference}</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {action && (
                <Modal isOpen={!!action} onClose={() => setAction(null)}>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 mb-1">{action.kind === 'query' ? 'Query invoice' : 'Mark invoice paid'}</h2>
                        <p className="text-slate-500 text-sm mb-4">{action.inv.invoiceNumber} · {supName(action.inv.supplierId)} · {rand(action.inv.total)}</p>
                        {action.kind === 'query' ? (
                            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="What needs fixing? (emailed to the carrier)" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment date</label><DateField value={payDate} onChange={setPayDate} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reference</label><input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="EFT ref" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" /></div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-5">
                            <button onClick={() => setAction(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={confirmAction} disabled={busy} className={`px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${action.kind === 'query' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{busy ? 'Saving…' : action.kind === 'query' ? 'Send query' : 'Confirm paid'}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default CarrierInvoicesReview;
