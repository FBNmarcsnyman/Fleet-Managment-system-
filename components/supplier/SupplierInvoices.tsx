import React, { useMemo, useState } from 'react';
import { Supplier, SubcontractorInvoice, LoadConfirmation } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { uploadFile } from '../../lib/supabase';
import Modal from '../Modal';
import DateField from '../operations/DateField';

const rand = (n?: number) => `R ${(Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';
const cls = 'w-full bg-white text-slate-800 p-2.5 rounded-md border border-slate-300 text-sm';
const label = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1';

const STATUS_STYLE: Record<string, string> = {
    Submitted: 'bg-blue-100 text-blue-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Queried: 'bg-amber-100 text-amber-700',
    Paid: 'bg-slate-200 text-slate-600',
};

// Create an invoice against a completed (POD'd) load.
const CreateInvoiceModal: React.FC<{ supplier: Supplier; load: LoadConfirmation; onClose: () => void }> = ({ supplier, load, onClose }) => {
    const { handleCreateSupplierInvoice } = useOperations() as any;
    const { showToast } = useUIState();
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [excl, setExcl] = useState(load.supplierRate ? String(load.supplierRate) : '');
    const [vat, setVat] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    // Default VAT to 15% of excl when the excl changes and VAT not manually set.
    const exclN = Number(excl) || 0;
    const vatN = vat === '' ? Math.round(exclN * 0.15 * 100) / 100 : Number(vat) || 0;
    const total = exclN + vatN;

    const submit = async () => {
        if (saving) return;
        if (!invoiceNumber.trim()) { showToast('Enter your invoice number.'); return; }
        if (!exclN) { showToast('Enter the amount (excl VAT).'); return; }
        setSaving(true);
        try {
            let pdfUrl: string | undefined;
            if (file) {
                const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const up = await uploadFile('driver-docs', `invoices/${supplier.id}/${Date.now()}_${safe}`, file);
                if (up.error || !up.url) { showToast(`Invoice PDF upload failed: ${up.error || 'unknown error'}`); setSaving(false); return; }
                pdfUrl = up.url;
            }
            const res = await handleCreateSupplierInvoice({
                supplierId: supplier.id, loadId: load.id, loadConNumber: load.loadConNumber,
                invoiceNumber: invoiceNumber.trim(), invoiceDate, amountExclVat: exclN, vatAmount: vatN, total,
                invoicePdfUrl: pdfUrl, createdByName: supplier.name,
            });
            if (res?.ok) { showToast('Invoice submitted — FBN accounts will review.'); onClose(); }
            else showToast(`Could not submit: ${res?.error}`);
        } finally { setSaving(false); }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-1 text-slate-900">Create invoice</h2>
            <p className="text-slate-500 mb-6 font-mono text-sm">{load.loadConNumber} · {load.collectionPoint} → {load.deliveryPoint}</p>
            <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Invoice number</label><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={cls} /></div>
                <div><label className={label}>Invoice date</label><DateField value={invoiceDate} onChange={setInvoiceDate} className={cls} /></div>
                <div><label className={label}>Amount excl VAT (R)</label><input type="number" value={excl} onChange={e => setExcl(e.target.value)} className={cls} /></div>
                <div><label className={label}>VAT (R) <span className="text-slate-400 normal-case">— 15% default</span></label><input type="number" value={vat} onChange={e => setVat(e.target.value)} placeholder={String(Math.round(exclN * 0.15 * 100) / 100)} className={cls} /></div>
                <div className="col-span-2"><label className={label}>Invoice PDF</label><input type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs text-slate-600" /></div>
            </div>
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-500">Total incl VAT: <span className="text-xl font-black text-emerald-600">{rand(total)}</span></p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="bg-slate-200 text-slate-700 hover:bg-slate-300 py-2 px-4 rounded-lg text-sm">Cancel</button>
                    <button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 py-2 px-5 rounded-lg text-white text-sm font-bold disabled:opacity-50">{saving ? 'Submitting…' : 'Submit invoice'}</button>
                </div>
            </div>
        </div>
    );
};

const SupplierInvoices: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    const { subcontractorInvoices = [], loadConfirmations = [] } = useOperations() as any;
    const [createFor, setCreateFor] = useState<LoadConfirmation | null>(null);
    const [filter, setFilter] = useState<'all' | SubcontractorInvoice['status']>('all');

    const invoices = useMemo(() => (subcontractorInvoices as SubcontractorInvoice[])
        .filter(i => i.supplierId === supplier.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [subcontractorInvoices, supplier.id]);

    const invoicedLoadIds = useMemo(() => new Set(invoices.map(i => i.loadId).filter(Boolean)), [invoices]);
    // Completed loads (POD on file) not yet invoiced.
    const invoiceable = useMemo(() => (loadConfirmations as LoadConfirmation[])
        .filter(l => l.supplierId === supplier.id && l.podPhoto && !invoicedLoadIds.has(l.id)), [loadConfirmations, supplier.id, invoicedLoadIds]);

    const shown = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
    const totals = useMemo(() => ({
        outstanding: invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + i.total, 0),
        paid: invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0),
    }), [invoices]);

    const printStatement = () => {
        const rows = invoices.map(i => `<tr><td>${i.invoiceNumber}</td><td>${fmt(i.invoiceDate)}</td><td>${i.loadConNumber || '-'}</td><td style="text-align:right">${rand(i.amountExclVat)}</td><td style="text-align:right">${rand(i.vatAmount)}</td><td style="text-align:right">${rand(i.total)}</td><td>${i.status}</td><td>${i.paymentReference || ''}${i.paymentDate ? ' · ' + fmt(i.paymentDate) : ''}</td></tr>`).join('');
        const html = `<html><head><title>Statement — ${supplier.name}</title><style>body{font-family:Arial,sans-serif;color:#13294b;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th,td{border-bottom:1px solid #e2e8f0;padding:6px;text-align:left}th{background:#13294b;color:#fff}.tot{margin-top:16px;font-size:14px;font-weight:bold}</style></head><body>
            <h1>FBN Transport — Statement of Account</h1>
            <p><strong>${supplier.name}</strong><br>Generated ${new Date().toLocaleString('en-ZA')}</p>
            <table><thead><tr><th>Invoice</th><th>Date</th><th>Load</th><th>Excl VAT</th><th>VAT</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No invoices yet.</td></tr>'}</tbody></table>
            <p class="tot">Outstanding: ${rand(totals.outstanding)} &nbsp;·&nbsp; Paid: ${rand(totals.paid)}</p>
            </body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Invoicing & Payments</h2>
                <button onClick={printStatement} className="text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 px-4 rounded-lg">⬇ Statement</button>
            </div>
            <p className="text-slate-500 mb-6">Invoice a completed load, then track it through approval and payment.</p>

            {/* Ready to invoice */}
            {invoiceable.length > 0 && (
                <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
                    <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest mb-3">Ready to invoice ({invoiceable.length})</h3>
                    <div className="space-y-2">
                        {invoiceable.map(l => (
                            <div key={l.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl p-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-sm truncate">{l.loadConNumber} · {rand(l.supplierRate)}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{l.collectionPoint} → {l.deliveryPoint}</p>
                                </div>
                                <button onClick={() => setCreateFor(l)} className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-lg">Create invoice</button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* History */}
            <div className="flex items-center gap-2 mb-3">
                {(['all', 'Submitted', 'Approved', 'Queried', 'Paid'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${filter === f ? 'bg-brand-primary text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-900'}`}>{f === 'all' ? 'All' : f}</button>
                ))}
            </div>
            <div className="space-y-2">
                {shown.map(i => (
                    <div key={i.id} className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-sm">{i.invoiceNumber} <span className="text-slate-400 font-normal">· {fmt(i.invoiceDate)}{i.loadConNumber ? ` · ${i.loadConNumber}` : ''}</span></p>
                                <p className="text-[11px] text-slate-400">Excl {rand(i.amountExclVat)} · VAT {rand(i.vatAmount)} · <span className="text-emerald-600 font-bold">{rand(i.total)}</span></p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                                {i.invoicePdfUrl && <a href={i.invoicePdfUrl} target="_blank" rel="noreferrer" className="block text-[11px] text-blue-600 hover:text-blue-800 mt-1">View PDF</a>}
                            </div>
                        </div>
                        {i.status === 'Queried' && i.queryNote && <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">Query: {i.queryNote}</p>}
                        {i.status === 'Paid' && (i.paymentReference || i.paymentDate) && <p className="mt-2 text-[11px] text-slate-500">Paid {i.paymentDate ? fmt(i.paymentDate) : ''}{i.paymentReference ? ` · ref ${i.paymentReference}` : ''}</p>}
                    </div>
                ))}
                {shown.length === 0 && <p className="text-center text-slate-400 py-12">No invoices{filter !== 'all' ? ` with status ${filter}` : ' yet'}.</p>}
            </div>

            {createFor && (
                <Modal isOpen={!!createFor} onClose={() => setCreateFor(null)}>
                    <CreateInvoiceModal supplier={supplier} load={createFor} onClose={() => setCreateFor(null)} />
                </Modal>
            )}
        </div>
    );
};

export default SupplierInvoices;
