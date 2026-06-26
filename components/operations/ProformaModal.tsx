import React, { useMemo, useState } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import { supabase } from '../../lib/supabase';

const QUOTES_FROM = 'quotes@fbn-transport.co.za';
const DEBTORS = 'fbndebtors@fbn-transport.co.za';
const money = (n: any) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Preview + edit a COD proforma before sending: confirm recipient, add extra CC, and
// capture the client's VAT / invoicing details (saved to the client) so the tax
// invoice is correct. Then send (quote-proforma).
const ProformaModal: React.FC = () => {
    const { modal, hideModal, showToast } = useUIState();
    const { handleUpdateClient } = useOperations() as any;
    const quote = modal.payload?.quote;
    const client = modal.payload?.client;

    const [vatNo, setVatNo] = useState(client?.vatNo || '');
    const [invoiceDetails, setInvoiceDetails] = useState(client?.invoiceDetails || '');
    const [extraCc, setExtraCc] = useState('');
    const [sending, setSending] = useState(false);

    const items = useMemo(() => Array.isArray(quote?.items) ? quote.items : [], [quote]);
    const excl = Number(quote?.totalAmount || 0);
    const vat = excl * 0.15;
    const incl = excl * 1.15;

    if (!quote) return <div className="p-4 text-slate-700">No quote selected.</div>;

    const send = async () => {
        setSending(true);
        try {
            // Save VAT / invoicing details to the client first (so the proforma + future invoices use them).
            if (client?.id && (vatNo.trim() !== (client.vatNo || '') || invoiceDetails.trim() !== (client.invoiceDetails || ''))) {
                await handleUpdateClient?.(client.id, { vatNo: vatNo.trim() || undefined, invoiceDetails: invoiceDetails.trim() || undefined } as any);
            }
            const extra = extraCc.split(/[,;]/).map(s => s.trim()).filter(Boolean);
            const { data: { session } } = await supabase.auth.getSession();
            const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-proforma`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}` },
                body: JSON.stringify({ quote_id: quote.id, extra_cc: extra }),
            });
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            showToast(`Proforma ${quote.quoteNumber} sent to ${data.sent_to} (cc debtors${extra.length ? ' + ' + extra.length + ' more' : ''}).`);
            hideModal();
        } catch (e: any) {
            showToast(`Failed to send proforma: ${e.message}`);
        } finally { setSending(false); }
    };

    const inp = 'w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
    const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';

    return (
        <div className="text-slate-800">
            <h2 className="text-xl font-black text-[#13294b]">Proforma — {quote.quoteNumber}</h2>
            <p className="text-xs text-slate-500 mb-3">Check it, add any details, then send. The client pays before collection (COD).</p>

            {/* Recipients */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mb-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div><span className={lbl}>To (client)</span><span className="font-semibold text-slate-800 break-all">{client?.contactEmail || '— no email on file —'}</span></div>
                    <div><span className={lbl}>From</span><span className="text-slate-700">{QUOTES_FROM}</span></div>
                    <div><span className={lbl}>CC</span><span className="text-slate-700">{DEBTORS}{extraCc.trim() ? ' + extras' : ''}</span></div>
                </div>
            </div>

            {/* Totals preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
                <table className="w-full text-sm">
                    <thead><tr className="bg-[#13294b] text-white text-left text-[11px] uppercase"><th className="py-1.5 px-2">Description</th><th className="py-1.5 px-2 text-center">Qty</th><th className="py-1.5 px-2 text-right">Rate</th><th className="py-1.5 px-2 text-right">Total</th></tr></thead>
                    <tbody>{items.map((it: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100"><td className="py-1.5 px-2">{it.description}</td><td className="py-1.5 px-2 text-center">{it.quantity}</td><td className="py-1.5 px-2 text-right">{money(it.rate)}</td><td className="py-1.5 px-2 text-right">{money(it.total != null ? it.total : it.rate)}</td></tr>
                    ))}</tbody>
                </table>
                <div className="flex justify-end gap-6 px-3 py-2 bg-slate-50 text-sm">
                    <span className="text-slate-500">Excl: <strong className="text-slate-800">{money(excl)}</strong></span>
                    <span className="text-slate-500">VAT: <strong className="text-slate-800">{money(vat)}</strong></span>
                    <span className="text-[#13294b] font-black">Incl: {money(incl)}</span>
                </div>
            </div>

            {/* Client invoicing details + extra recipients */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Client VAT no</label><input value={vatNo} onChange={e => setVatNo(e.target.value)} className={inp} placeholder="client's VAT number" /></div>
                <div><label className={lbl}>Extra email(s) to copy</label><input value={extraCc} onChange={e => setExtraCc(e.target.value)} className={inp + ' normal-case'} style={{ textTransform: 'none' }} placeholder="comma-separated" /></div>
                <div className="sm:col-span-2"><label className={lbl}>Client invoicing / billing details</label><textarea value={invoiceDetails} onChange={e => setInvoiceDetails(e.target.value)} rows={2} className={inp + ' normal-case'} style={{ textTransform: 'none' }} placeholder="Registered company name, billing address, accounts email…" /></div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">VAT &amp; invoicing details are saved to this client. If left blank, the proforma asks the client to reply with them.</p>

            <div className="flex justify-end gap-2 mt-4">
                <button onClick={hideModal} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={send} disabled={sending || !client?.contactEmail} className="px-5 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{sending ? 'Sending…' : 'Send proforma →'}</button>
            </div>
        </div>
    );
};

export default ProformaModal;
