import React, { useMemo, useState } from 'react';
import { Supplier, RfqRequest, CarrierQuote } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { format } from 'date-fns';

const rand = (n?: number | null) => n || n === 0 ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const input = 'w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-secondary outline-none';
const label = 'block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1';

const QuoteForm: React.FC<{ rfq: RfqRequest; supplier: Supplier; existing?: CarrierQuote; onDone: () => void }> = ({ rfq, supplier, existing, onDone }) => {
    const { handleSubmitCarrierQuote } = useOperations() as any;
    const { showToast } = useUIState();
    const [price, setPrice] = useState(existing?.price ? String(existing.price) : '');
    const [vehicle, setVehicle] = useState(existing?.vehicleOffered || rfq.vehicleType || '');
    const [eta, setEta] = useState(existing?.eta || '');
    const [notes, setNotes] = useState(existing?.notes || '');
    const [saving, setSaving] = useState(false);

    const send = async (canAssist: boolean) => {
        if (saving) return;
        if (canAssist && !price) { showToast('Enter your rate, or choose "Can\'t assist".'); return; }
        const recipient = rfq.recipients.find(r => r.supplierId === supplier.id);
        setSaving(true);
        const res = await handleSubmitCarrierQuote(rfq.id, {
            recipientId: recipient?.id, supplierId: supplier.id, companyName: supplier.name,
            canAssist, price: canAssist && price ? Number(price) : undefined,
            vehicleOffered: vehicle || undefined, eta: eta || undefined, notes: notes || undefined,
        });
        setSaving(false);
        if (res?.ok) { showToast(canAssist ? 'Quote submitted — thank you!' : 'Noted, thanks for letting us know.'); onDone(); }
        else showToast(`Could not submit: ${res?.error}`);
    };

    return (
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={label}>Your rate (R)</label><input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 18500" className={input} /></div>
            <div><label className={label}>Vehicle offered</label><input value={vehicle} onChange={e => setVehicle(e.target.value)} className={input} /></div>
            <div><label className={label}>Availability / ETA</label><input value={eta} onChange={e => setEta(e.target.value)} placeholder="e.g. truck available from 06:00" className={input} /></div>
            <div><label className={label}>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className={input} /></div>
            <div className="sm:col-span-2 flex flex-wrap gap-3 mt-1">
                <button onClick={() => send(true)} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">{existing ? 'Update quote' : 'Submit quote'}</button>
                <button onClick={() => send(false)} disabled={saving} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-300 hover:text-white border border-white/10">Can't assist</button>
            </div>
        </div>
    );
};

const RfqCard: React.FC<{ rfq: RfqRequest; supplier: Supplier }> = ({ rfq, supplier }) => {
    const mine = rfq.quotes.find(q => q.supplierId === supplier.id);
    const [open, setOpen] = useState(!mine);
    const spec = [rfq.vehicleType, rfq.loadType, rfq.commodity, rfq.weightKg ? `${Number(rfq.weightKg).toLocaleString('en-ZA')}kg` : null, rfq.gitRequired ? 'GIT required' : null].filter(Boolean).join(' · ');

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex justify-between items-start gap-3">
                <div>
                    <span className="font-mono text-[11px] text-gray-500">{rfq.requestNumber}{rfq.arrangingBranch ? ` · ${rfq.arrangingBranch}` : ''}</span>
                    <h4 className="text-lg font-black text-white mt-0.5">{rfq.origin} → {rfq.destination}</h4>
                    <p className="text-xs text-gray-400 mt-1">{spec}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        {rfq.collectionDate ? `Collect ${rfq.collectionDate}${rfq.collectionTime ? ' · onsite by ' + rfq.collectionTime : ''}` : ''}
                        {rfq.deliveryDate ? ` → Deliver ${rfq.deliveryDate}${rfq.deliveryTime ? ' ' + rfq.deliveryTime : ''}` : ''}
                    </p>
                    {rfq.notes && <p className="text-[11px] text-gray-400 mt-1 italic">{rfq.notes}</p>}
                </div>
                <span className="text-[10px] text-gray-600 whitespace-nowrap">{format(new Date(rfq.createdAt), 'dd MMM')}</span>
            </div>

            {rfq.status === 'Awarded' && (
                <p className={`mt-3 text-xs font-bold ${mine?.status === 'Awarded' ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {mine?.status === 'Awarded' ? '🎉 You were awarded this load — ops will be in touch.' : 'This load has been awarded.'}
                </p>
            )}

            {rfq.status !== 'Awarded' && rfq.status !== 'Cancelled' && (
                mine && !open ? (
                    <div className="mt-3 flex items-center justify-between bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-3">
                        <p className="text-sm text-emerald-200">Your quote: <strong>{mine.canAssist ? rand(mine.price) : "Can't assist"}</strong></p>
                        <button onClick={() => setOpen(true)} className="text-xs font-bold text-brand-secondary hover:text-blue-300">Edit</button>
                    </div>
                ) : <QuoteForm rfq={rfq} supplier={supplier} existing={mine} onDone={() => setOpen(false)} />
            )}
        </div>
    );
};

const SupplierRfqList: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    const { rfqRequests = [] } = useOperations() as any;
    const mine = useMemo(() => (rfqRequests as RfqRequest[])
        .filter(r => r.recipients.some(rec => rec.supplierId === supplier.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [rfqRequests, supplier.id]);
    const open = mine.filter(r => r.status === 'Open');
    const past = mine.filter(r => r.status !== 'Open');

    return (
        <div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-1">Quote Requests</h2>
            <p className="text-gray-400 mb-6">Loads we'd like your rate on. Submit a price if you can assist.</p>

            {open.length > 0 && <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3">Open · {open.length}</h3>}
            <div className="space-y-4">{open.map(r => <RfqCard key={r.id} rfq={r} supplier={supplier} />)}</div>

            {past.length > 0 && <h3 className="text-xs font-black uppercase tracking-widest text-gray-600 mt-8 mb-3">Closed · {past.length}</h3>}
            <div className="space-y-4">{past.map(r => <RfqCard key={r.id} rfq={r} supplier={supplier} />)}</div>

            {mine.length === 0 && <p className="text-center text-gray-500 py-20">No quote requests yet. When ops broadcast a load on your lanes, it'll appear here.</p>}
        </div>
    );
};

export default SupplierRfqList;
