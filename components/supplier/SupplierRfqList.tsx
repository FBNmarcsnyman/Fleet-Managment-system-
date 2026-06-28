import React, { useEffect, useMemo, useState } from 'react';
import { Supplier, RfqRequest, CarrierQuote } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { format } from 'date-fns';

const rand = (n?: number | null) => n || n === 0 ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const input = 'w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-secondary outline-none';
const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1';

// Live countdown to the RFQ response deadline → "2d 4h", "3h 12m", "8m 40s", "closed".
const fmtCountdown = (iso: string | undefined, now: number): { text: string; urgent: boolean; over: boolean } => {
    if (!iso) return { text: 'no deadline', urgent: false, over: false };
    const ms = new Date(iso).getTime() - now;
    if (isNaN(ms)) return { text: '—', urgent: false, over: false };
    if (ms <= 0) return { text: 'closed', urgent: false, over: true };
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
    return { text, urgent: ms < 3600_000, over: false };
};

const QuoteForm: React.FC<{ rfq: RfqRequest; supplier: Supplier; existing?: CarrierQuote; onDone: () => void }> = ({ rfq, supplier, existing, onDone }) => {
    const { handleSubmitCarrierQuote } = useOperations() as any;
    const { showToast } = useUIState();
    const [price, setPrice] = useState(existing?.price ? String(existing.price) : '');
    // Vehicle offered = pick from the carrier's registered fleet types (+ Other free-text).
    const fleetTypes = (supplier.vehicleTypes || []).filter(Boolean);
    const initialVehicle = existing?.vehicleOffered || rfq.vehicleType || '';
    const [vehicle, setVehicle] = useState(initialVehicle && fleetTypes.includes(initialVehicle) ? initialVehicle : (fleetTypes.length ? '' : initialVehicle));
    const [vehicleOther, setVehicleOther] = useState(initialVehicle && !fleetTypes.includes(initialVehicle) ? initialVehicle : '');
    const [eta, setEta] = useState(existing?.eta || '');
    const [notes, setNotes] = useState(existing?.notes || '');
    const [saving, setSaving] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [declineReason, setDeclineReason] = useState('');

    const chosenVehicle = (vehicle === '__other' ? vehicleOther : vehicle) || vehicleOther;

    const send = async (canAssist: boolean) => {
        if (saving) return;
        if (canAssist && !price) { showToast('Enter your rate, or choose "Can\'t assist".'); return; }
        if (!canAssist && !declineReason.trim()) { showToast('Please give a brief reason for declining.'); return; }
        const recipient = rfq.recipients.find(r => r.supplierId === supplier.id);
        setSaving(true);
        const res = await handleSubmitCarrierQuote(rfq.id, {
            recipientId: recipient?.id, supplierId: supplier.id, companyName: supplier.name,
            canAssist, price: canAssist && price ? Number(price) : undefined,
            vehicleOffered: canAssist ? (chosenVehicle || undefined) : undefined, eta: canAssist ? (eta || undefined) : undefined,
            notes: canAssist ? (notes || undefined) : `Declined: ${declineReason.trim()}`,
        });
        setSaving(false);
        if (res?.ok) { showToast(canAssist ? 'Quote submitted — thank you!' : 'Noted, thanks for letting us know.'); onDone(); }
        else showToast(`Could not submit: ${res?.error}`);
    };

    if (declining) {
        return (
            <div className="mt-4 pt-4 border-t border-slate-200">
                <label className={label}>Reason for declining</label>
                <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={2} placeholder="e.g. no truck available on that date / rate too low / off our lanes" className={input} />
                <div className="flex flex-wrap gap-3 mt-3">
                    <button onClick={() => send(false)} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">{saving ? 'Sending…' : 'Submit decline'}</button>
                    <button onClick={() => setDeclining(false)} disabled={saving} className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={label}>Your rate, excl VAT (R)</label><input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 18500" className={input} /></div>
            <div>
                <label className={label}>Vehicle offered</label>
                {fleetTypes.length ? (
                    <select value={vehicle} onChange={e => setVehicle(e.target.value)} className={input}>
                        <option value="">-- choose --</option>
                        {fleetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="__other">Other…</option>
                    </select>
                ) : (
                    <input value={vehicleOther} onChange={e => setVehicleOther(e.target.value)} placeholder="e.g. Tri-axle" className={input} />
                )}
                {fleetTypes.length > 0 && vehicle === '__other' && (
                    <input value={vehicleOther} onChange={e => setVehicleOther(e.target.value)} placeholder="Specify vehicle" className={input + ' mt-2'} />
                )}
            </div>
            <div><label className={label}>Availability / ETA</label><input value={eta} onChange={e => setEta(e.target.value)} placeholder="e.g. truck available from 06:00" className={input} /></div>
            <div><label className={label}>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className={input} /></div>
            <div className="sm:col-span-2 flex flex-wrap gap-3 mt-1">
                <button onClick={() => send(true)} disabled={saving} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">{existing ? 'Update quote' : 'Submit quote'}</button>
                <button onClick={() => setDeclining(true)} disabled={saving} className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Can't assist</button>
            </div>
        </div>
    );
};

const RfqCard: React.FC<{ rfq: RfqRequest; supplier: Supplier; now: number }> = ({ rfq, supplier, now }) => {
    const mine = rfq.quotes.find(q => q.supplierId === supplier.id);
    const [open, setOpen] = useState(!mine);
    const spec = [rfq.vehicleType, rfq.loadType, rfq.commodity, rfq.weightKg ? `${Number(rfq.weightKg).toLocaleString('en-ZA')}kg` : null, rfq.gitRequired ? 'GIT required' : null].filter(Boolean).join(' · ');
    const cd = fmtCountdown(rfq.closesAt, now);

    return (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
            <div className="flex justify-between items-start gap-3">
                <div>
                    <span className="font-mono text-[11px] text-slate-400">{rfq.requestNumber}{rfq.arrangingBranch ? ` · ${rfq.arrangingBranch}` : ''}</span>
                    <h4 className="text-lg font-black text-slate-900 mt-0.5">{rfq.origin} → {rfq.destination}</h4>
                    <p className="text-xs text-slate-500 mt-1">{spec}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        {rfq.collectionDate ? `Collect ${rfq.collectionDate}${rfq.collectionTime ? ' · onsite by ' + rfq.collectionTime : ''}` : ''}
                        {rfq.deliveryDate ? ` → Deliver ${rfq.deliveryDate}${rfq.deliveryTime ? ' ' + rfq.deliveryTime : ''}` : ''}
                    </p>
                    {rfq.notes && <p className="text-[11px] text-slate-500 mt-1 italic">{rfq.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                    {rfq.status === 'Open' && rfq.closesAt && (
                        <span className={`block text-xs font-black px-2.5 py-1 rounded-lg ${cd.over ? 'bg-slate-200 text-slate-500' : cd.urgent ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {cd.over ? 'closed' : `⏳ ${cd.text}`}
                        </span>
                    )}
                    <span className="block text-[10px] text-slate-400 whitespace-nowrap mt-1">{format(new Date(rfq.createdAt), 'dd MMM')}</span>
                </div>
            </div>

            {rfq.status === 'Awarded' && (
                <p className={`mt-3 text-xs font-bold ${mine?.status === 'Awarded' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {mine?.status === 'Awarded' ? '🎉 You were awarded this load — ops will be in touch.' : 'This load has been awarded.'}
                </p>
            )}

            {rfq.status !== 'Awarded' && rfq.status !== 'Cancelled' && (
                mine && !open ? (
                    <div className="mt-3 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-700">Your quote: <strong>{mine.canAssist ? rand(mine.price) : "Can't assist"}</strong></p>
                        <button onClick={() => setOpen(true)} className="text-xs font-bold text-blue-600 hover:text-blue-800">Edit</button>
                    </div>
                ) : <QuoteForm rfq={rfq} supplier={supplier} existing={mine} onDone={() => setOpen(false)} />
            )}
        </div>
    );
};

const SupplierRfqList: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    const { rfqRequests = [] } = useOperations() as any;
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    const mine = useMemo(() => (rfqRequests as RfqRequest[])
        .filter(r => r.recipients.some(rec => rec.supplierId === supplier.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [rfqRequests, supplier.id]);
    const open = mine.filter(r => r.status === 'Open');
    const past = mine.filter(r => r.status !== 'Open');

    return (
        <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Quote Requests</h2>
            <p className="text-slate-500 mb-6">Loads we'd like your rate on. Submit a price if you can assist, before the deadline.</p>

            {open.length > 0 && <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3">Open · {open.length}</h3>}
            <div className="space-y-4">{open.map(r => <RfqCard key={r.id} rfq={r} supplier={supplier} now={now} />)}</div>

            {past.length > 0 && <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mt-8 mb-3">Closed · {past.length}</h3>}
            <div className="space-y-4">{past.map(r => <RfqCard key={r.id} rfq={r} supplier={supplier} now={now} />)}</div>

            {mine.length === 0 && <p className="text-center text-slate-400 py-20">No quote requests yet. When ops broadcast a load on your lanes, it'll appear here.</p>}
        </div>
    );
};

export default SupplierRfqList;
