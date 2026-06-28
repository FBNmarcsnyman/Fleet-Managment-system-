import React, { useMemo, useRef, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { uploadFile, invokeFn } from '../../lib/supabase';
import { LoadConfirmation } from '../../types';

const rand = (n?: number) => `R ${(Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';

// Lighter Financial Documents (per the agreed scope): invoices derived from each
// load's invoice number/date + payment status (outstanding highlighted), a printable
// statement, and remittance/proof-of-payment upload (emailed to FBN accounts).
const ClientFinancials: React.FC<{ clientId?: string }> = ({ clientId }) => {
    const { loadConfirmations = [], clients = [] } = useOperations() as any;
    const { showToast } = useUIState();
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const clientName = (clients as any[]).find(c => c.id === clientId)?.name || 'Client';

    const invoices = useMemo(() => (loadConfirmations as LoadConfirmation[])
        .filter(l => l.clientId === clientId && (l as any).invoiceNumber)
        .sort((a, b) => new Date((b as any).invoiceDate || b.date).getTime() - new Date((a as any).invoiceDate || a.date).getTime()), [loadConfirmations, clientId]);
    const isPaid = (l: any) => l.paymentStatus === 'Paid';
    const outstanding = invoices.filter(l => !isPaid(l));

    const onRemittance = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const up = await uploadFile('driver-docs', `remittances/${clientId}/${Date.now()}_${safe}`, file);
            if (up.error || !up.url) { showToast(`Upload failed: ${up.error || 'unknown error'}`); return; }
            const html = `<div style="font-family:Arial,sans-serif"><p><strong>${clientName}</strong> uploaded a remittance / proof of payment.</p><p><a href="${up.url}">View document</a></p></div>`;
            await invokeFn('send-email', { body: { to: 'fbndebtors@fbn-transport.co.za', subject: `Remittance uploaded — ${clientName}`, html, fromName: 'FBN Client Portal' } });
            showToast('Remittance sent to FBN accounts — thank you.');
        } catch (err) { showToast(`Upload failed: ${err instanceof Error ? err.message : 'error'}`); }
        finally { setUploading(false); }
    };

    const printStatement = () => {
        const rows = invoices.map(l => `<tr><td>${(l as any).invoiceNumber}</td><td>${fmt((l as any).invoiceDate)}</td><td>${l.loadConNumber || ''}</td><td>${l.collectionPoint || ''} → ${l.deliveryPoint || ''}</td><td style="text-align:right">${rand((l as any).totalAmount)}</td><td>${isPaid(l) ? 'Paid' : 'Outstanding'}</td></tr>`).join('');
        const html = `<html><head><title>Statement — ${clientName}</title><style>body{font-family:Arial,sans-serif;color:#13294b;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th,td{border-bottom:1px solid #e2e8f0;padding:6px;text-align:left}th{background:#13294b;color:#fff}</style></head><body>
            <h1>FBN Transport — Statement of Account</h1><p><strong>${clientName}</strong><br>Generated ${new Date().toLocaleString('en-ZA')}</p>
            <table><thead><tr><th>Invoice</th><th>Date</th><th>Load</th><th>Route</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No invoices.</td></tr>'}</tbody></table>
            </body></html>`;
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Financial Documents</h2>
                <div className="flex gap-2">
                    <button onClick={printStatement} className="text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 px-4 rounded-lg">⬇ Statement</button>
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs font-bold bg-[#13294b] hover:bg-[#1d3a66] text-white py-2 px-4 rounded-lg disabled:opacity-50">{uploading ? 'Uploading…' : '⬆ Upload remittance'}</button>
                    <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onRemittance} />
                </div>
            </div>
            <p className="text-slate-500 mb-6">Your invoices and payment status. Upload proof of payment when you've paid.</p>

            {outstanding.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                    <p className="text-sm font-bold text-red-700">{outstanding.length} outstanding invoice{outstanding.length === 1 ? '' : 's'} · {rand(outstanding.reduce((s, l) => s + ((l as any).totalAmount || 0), 0))}</p>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {invoices.length === 0 ? <p className="text-sm text-slate-400 py-12 text-center">No invoices yet.</p> : (
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-200 text-slate-500 text-left"><th className="p-3 font-bold">Invoice</th><th className="p-3 font-bold">Date</th><th className="p-3 font-bold">Load</th><th className="p-3 font-bold text-right">Amount</th><th className="p-3 font-bold text-center">Status</th></tr></thead>
                        <tbody>
                            {invoices.map(l => (
                                <tr key={l.id} className={`border-b border-slate-100 ${!isPaid(l) ? 'bg-red-50/40' : ''}`}>
                                    <td className="p-3 font-bold text-slate-900">{(l as any).invoiceNumber}</td>
                                    <td className="p-3 text-slate-500">{fmt((l as any).invoiceDate)}</td>
                                    <td className="p-3 text-slate-600">{l.loadConNumber}<span className="block text-[11px] text-slate-400">{l.collectionPoint} → {l.deliveryPoint}</span></td>
                                    <td className="p-3 text-right font-mono text-slate-800">{rand((l as any).totalAmount)}</td>
                                    <td className="p-3 text-center"><span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${isPaid(l) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{(l as any).paymentStatus || 'Outstanding'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ClientFinancials;
