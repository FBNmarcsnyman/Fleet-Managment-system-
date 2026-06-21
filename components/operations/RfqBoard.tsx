import React, { useMemo, useState } from 'react';
import { Supplier, RfqRequest, RfqRecipient, CarrierQuote } from '../../types';
import { useOperations, useUIState, useFleetData } from '../../contexts/AppContexts';
import { PlusIcon } from '../icons/PlusIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import Modal from '../Modal';
import { format } from 'date-fns';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import DateField from './DateField';

const BRANCHES = ['FBN DBN', 'FBN JHB', 'FBN CPT', 'LOADMASTER'];
const VEHICLE_OPTIONS = ['Superlink', 'Tri-axle', 'Tautliner (6m)', 'Tautliner (12m)', 'Flat deck (6m)', 'Flat deck (12m)', 'Tanker', 'Tipper / Bulk', 'Lowbed / Abnormal', 'Container', '8 Ton', '4 Ton', '1 Ton'];
const LOAD_TYPES = ['Full Load', 'Mixed Load', 'Part Load'];

const input = 'w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1';
const rand = (n?: number | null) => n || n === 0 ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

// ── Raise-RFQ form ───────────────────────────────────────────────────────────
const RfqForm: React.FC<{ suppliers: Supplier[]; onClose: () => void }> = ({ suppliers, onClose }) => {
    const { handleCreateRfq, routes = [], clients = [], quotes = [] } = useOperations() as any;
    const { commodities = [], handleAddCommodity } = useFleetData() as any;
    const { showToast } = useUIState();
    const [saving, setSaving] = useState(false);
    const [f, setF] = useState({
        arrangingBranch: 'FBN DBN', clientId: '', quoteId: '', origin: '', destination: '', vehicleType: VEHICLE_OPTIONS[0],
        loadType: 'Full Load', commodity: '', weightKg: '', gitRequired: true, hazardous: false,
        collectionDate: '', collectionTime: '', deliveryDate: '', deliveryTime: '', notes: '',
    });
    const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }));

    // Quotes the client has requested (or drafts) we can raise this RFQ against.
    const linkableQuotes = useMemo(() => (quotes as any[]).filter(q => q.status === 'Requested' || q.status === 'Draft'), [quotes]);
    const onQuote = (id: string) => {
        const q = (quotes as any[]).find(x => x.id === id);
        setF(prev => ({
            ...prev, quoteId: id,
            clientId: q?.clientId || prev.clientId,
            origin: q?.legs?.[0]?.collectionPoint || prev.origin,
            destination: q?.legs?.[q.legs.length - 1]?.deliveryPoint || prev.destination,
            commodity: q?.commodity || prev.commodity,
        }));
    };
    const clientName = (id: string) => (clients as any[]).find(c => c.id === id)?.name || '';

    const carriers = useMemo(() => (suppliers || []).filter(s => s.type === 'Transport' && s.isActive !== false), [suppliers]);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [extraEmails, setExtraEmails] = useState('');
    const [routeId, setRouteId] = useState('');
    const [onRouteOnly, setOnRouteOnly] = useState(false);
    const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    // Best-effort lane match: does the carrier's regions / specialisations mention
    // either end of the route? (Carriers capture the lanes they run at sign-up.)
    const laneTokens = (origin: string, destination: string) =>
        [origin, destination].flatMap(x => (x || '').toLowerCase().split(/[^a-z0-9]+/))
            .filter(t => t.length >= 3 && !['fbn', 'transport', 'depot', 'the', 'and'].includes(t));
    const runsLane = (c: Supplier, origin: string, destination: string) => {
        const toks = laneTokens(origin, destination);
        if (!toks.length) return true;
        const hay = [c.regions, (c.specializations || []).join(' ')].join(' ').toLowerCase();
        return toks.some(t => hay.includes(t));
    };

    const onRoute = (id: string) => {
        setRouteId(id);
        const r = (routes as any[]).find(x => x.id === id);
        if (!r) return;
        set('origin', r.origin); set('destination', r.destination);
        setOnRouteOnly(true);
        setPicked(new Set(carriers.filter(c => runsLane(c, r.origin, r.destination)).map(c => c.id)));
    };

    const shown = useMemo(() => onRouteOnly ? carriers.filter(c => runsLane(c, f.origin, f.destination)) : carriers, [carriers, onRouteOnly, f.origin, f.destination]);
    const allShownSelected = shown.length > 0 && shown.every(c => picked.has(c.id));
    const toggleAll = () => setPicked(prev => {
        const n = new Set(prev);
        if (allShownSelected) shown.forEach(c => n.delete(c.id)); else shown.forEach(c => n.add(c.id));
        return n;
    });

    const submit = async () => {
        if (saving) return;
        if (!f.origin.trim() || !f.destination.trim()) { showToast('Origin and destination are required.'); return; }
        const recipients: { supplierId?: string; email?: string; companyName?: string; channel?: RfqRecipient['channel'] }[] = [];
        carriers.filter(c => picked.has(c.id)).forEach(c => recipients.push({ supplierId: c.id, email: c.contactEmail || undefined, companyName: c.name, channel: 'email' }));
        extraEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e.includes('@')).forEach(e => recipients.push({ email: e, companyName: e.split('@')[0], channel: 'email' }));
        if (!recipients.length) { showToast('Pick at least one carrier (or add an email).'); return; }
        // Save a newly-typed commodity to the shared pick-list (consistent spelling).
        try {
            const cv = (f.commodity || '').trim();
            if (cv && !commodities.includes(cv) && typeof handleAddCommodity === 'function') handleAddCommodity(cv);
        } catch { /* never block the send */ }
        setSaving(true);
        const res = await handleCreateRfq(
            { ...f, weightKg: f.weightKg ? Number(f.weightKg) : undefined },
            recipients,
        );
        setSaving(false);
        if (res?.ok) { showToast(`RFQ ${res.value.requestNumber} sent to ${recipients.length} carrier(s).`); onClose(); }
        else showToast(`Could not send: ${res?.error || 'unknown error'}`);
    };

    return (
        <div className="p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-1">Raise a quote request</h3>
            <p className="text-sm text-gray-400 mb-5">Broadcast a load to carriers who run the lane. Replies route to the branch ops inbox.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className={label}>Client (optional)</label>
                    <select value={f.clientId} onChange={e => set('clientId', e.target.value)} className={input}>
                        <option value="">No client / sourcing only</option>
                        {(clients as any[]).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label}>Link to client quote (optional)</label>
                    <select value={f.quoteId} onChange={e => onQuote(e.target.value)} className={input}>
                        <option value="">Not from a quote</option>
                        {linkableQuotes.map(q => <option key={q.id} value={q.id}>{q.quoteNumber} · {clientName(q.clientId)}</option>)}
                    </select>
                </div>
            </div>

            {(routes as any[]).length > 0 && (
                <div className="mb-4">
                    <label className={label}>Route (auto-selects carriers on this lane)</label>
                    <select value={routeId} onChange={e => onRoute(e.target.value)} className={input}>
                        <option value="">Custom route (enter below)</option>
                        {(routes as any[]).map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
                    </select>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={label}>Arranging branch</label>
                    <select value={f.arrangingBranch} onChange={e => set('arrangingBranch', e.target.value)} className={input}>
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label}>Vehicle required</label>
                    <select value={f.vehicleType} onChange={e => set('vehicleType', e.target.value)} className={input}>
                        {VEHICLE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <div><label className={label}>Collection point *</label>
                    <AddressAutocompleteInput value={f.origin} onChange={(v: string) => set('origin', v)} placeholder="Search Google Maps address…" className={input} /></div>
                <div><label className={label}>Delivery point *</label>
                    <AddressAutocompleteInput value={f.destination} onChange={(v: string) => set('destination', v)} placeholder="Search Google Maps address…" className={input} /></div>
                <div>
                    <label className={label}>Load type</label>
                    <select value={f.loadType} onChange={e => set('loadType', e.target.value)} className={input}>
                        {LOAD_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label}>Commodity</label>
                    <input list="rfq-commodity-list" value={f.commodity} onChange={e => set('commodity', e.target.value)} placeholder="Type to search or add…" autoComplete="off" className={input} />
                    <datalist id="rfq-commodity-list">{(commodities as string[]).map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div><label className={label}>Weight (kg)</label><input type="number" value={f.weightKg} onChange={e => set('weightKg', e.target.value)} placeholder="34000" className={input} /></div>
                <div className="flex items-end pb-1 gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                        <input type="checkbox" checked={f.gitRequired} onChange={e => set('gitRequired', e.target.checked)} className="h-4 w-4 rounded" /> GIT cover required
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                        <input type="checkbox" checked={f.hazardous} onChange={e => set('hazardous', e.target.checked)} className="h-4 w-4 rounded accent-red-500" /> <span className={f.hazardous ? 'text-red-300 font-bold' : ''}>Hazardous (DG)</span>
                    </label>
                </div>
                <div><label className={label}>Collection date</label><DateField value={f.collectionDate} onChange={(v: string) => set('collectionDate', v)} className={input} /></div>
                <div><label className={label}>Onsite by (time)</label><input type="time" value={f.collectionTime} onChange={e => set('collectionTime', e.target.value)} className={input} /></div>
                <div><label className={label}>Delivery date</label><DateField value={f.deliveryDate} onChange={(v: string) => set('deliveryDate', v)} className={input} /></div>
                <div><label className={label}>Delivery time</label><input type="time" value={f.deliveryTime} onChange={e => set('deliveryTime', e.target.value)} className={input} /></div>
            </div>
            <div className="mt-4"><label className={label}>Notes</label><textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any special requirements…" className={input} /></div>

            <div className="mt-6">
                <div className="flex items-center justify-between mb-1">
                    <label className={label}>Send to carriers ({picked.size} selected)</label>
                    <div className="flex items-center gap-3 text-[11px]">
                        {(f.origin || f.destination) && (
                            <label className="flex items-center gap-1.5 text-gray-400 cursor-pointer">
                                <input type="checkbox" checked={onRouteOnly} onChange={e => setOnRouteOnly(e.target.checked)} className="h-3.5 w-3.5 rounded" /> On this route only
                            </label>
                        )}
                        <button type="button" onClick={toggleAll} className="font-bold text-brand-secondary hover:text-blue-400">{allShownSelected ? 'Clear all' : 'Select all'}</button>
                    </div>
                </div>
                <div className="max-h-44 overflow-y-auto border border-gray-700 rounded-lg divide-y divide-gray-700/60">
                    {shown.length === 0 && <p className="text-sm text-gray-500 p-3">{onRouteOnly ? 'No carriers match this lane — untick "On this route only" to see all.' : 'No active transport carriers yet.'}</p>}
                    {shown.map(c => (
                        <label key={c.id} className="flex items-center gap-3 p-2.5 hover:bg-gray-700/40 cursor-pointer">
                            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded" />
                            <span className="flex-grow min-w-0">
                                <span className="text-sm text-white font-semibold">{c.name}</span>
                                <span className="block text-[11px] text-gray-500 truncate">{[c.regions, (c.vehicleTypes || []).join(', ')].filter(Boolean).join(' · ') || c.contactEmail || 'no lane info'}</span>
                            </span>
                            {!c.contactEmail && <span className="text-[10px] text-amber-400 font-bold">no email</span>}
                        </label>
                    ))}
                </div>
                <input value={extraEmails} onChange={e => setExtraEmails(e.target.value)} placeholder="Add other emails (comma-separated)" className={`${input} mt-2`} />
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white">Cancel</button>
                <button onClick={submit} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">{saving ? 'Sending…' : 'Send request'}</button>
            </div>
        </div>
    );
};

// ── Inline "log a quote" capture (for replies by phone / WhatsApp) ───────────
const LogQuote: React.FC<{ rfq: RfqRequest; onDone: () => void }> = ({ rfq, onDone }) => {
    const { handleAddCarrierQuote } = useOperations() as any;
    const { showToast } = useUIState();
    const [supplierId, setSupplierId] = useState('');
    const [price, setPrice] = useState('');
    const [vehicle, setVehicle] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (saving) return;
        const rec = rfq.recipients.find(r => r.supplierId === supplierId || r.id === supplierId);
        setSaving(true);
        const res = await handleAddCarrierQuote(rfq.id, {
            recipientId: rec?.id, supplierId: rec?.supplierId, companyName: rec?.companyName || 'Carrier',
            price: price ? Number(price) : undefined, vehicleOffered: vehicle || undefined, notes: notes || undefined, canAssist: true,
        });
        setSaving(false);
        if (res?.ok) { showToast('Quote logged.'); onDone(); } else showToast(`Failed: ${res?.error}`);
    };

    return (
        <div className="mt-3 p-3 bg-gray-900/50 rounded-lg grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
            <div className="sm:col-span-2">
                <label className={label}>Carrier</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={input}>
                    <option value="">Select…</option>
                    {rfq.recipients.map(r => <option key={r.id} value={r.supplierId || r.id}>{r.companyName || r.email}</option>)}
                </select>
            </div>
            <div><label className={label}>Price (R)</label><input type="number" value={price} onChange={e => setPrice(e.target.value)} className={input} /></div>
            <div><label className={label}>Vehicle</label><input value={vehicle} onChange={e => setVehicle(e.target.value)} className={input} /></div>
            <button onClick={save} disabled={saving || !supplierId} className="px-3 py-2.5 rounded-lg text-sm font-bold bg-brand-primary hover:bg-brand-secondary text-white disabled:opacity-50">Log</button>
        </div>
    );
};

// ── Award → quote the client (markup slider) → send for approval ─────────────
// The winning carrier rate + markup becomes the client's sell price on a quote.
// After the client approves it, ops convert it to a load and pick the transporter
// via the existing Accept-quote flow. No LoadCon is created here.
const QuoteClientModal: React.FC<{ rfq: RfqRequest; quote: CarrierQuote; markup: number; onClose: () => void }> = ({ rfq, quote, markup, onClose }) => {
    const { handleCreateQuote, handleUpdateQuote, handleAwardRfqQuote, handleUpdateRfq, clients = [], suppliers = [], quotes = [] } = useOperations() as any;
    const { showToast } = useUIState();
    const buy = quote.price || 0;
    const [clientId, setClientId] = useState(rfq.clientId || '');
    const [markupPct, setMarkupPct] = useState(markup);
    const [saving, setSaving] = useState(false);
    const carrier = (suppliers as Supplier[]).find(s => s.id === quote.supplierId);
    const sell = Math.round(buy * (1 + markupPct / 100) * 100) / 100;
    const margin = sell - buy;
    const id = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const subQuote = { id: id(), supplierId: quote.supplierId || '', rate: buy, timestamp: new Date().toISOString() };

    const send = async () => {
        if (saving) return;
        if (!clientId) { showToast('Pick the client to quote.'); return; }
        setSaving(true);
        let quoteNumber = '';
        let res: any;
        const linked = rfq.quoteId ? (quotes as any[]).find(q => q.id === rfq.quoteId) : null;
        if (linked) {
            res = await handleUpdateQuote({
                ...linked,
                clientId,
                totalAmount: sell,
                subcontractorQuotes: [...(linked.subcontractorQuotes || []), subQuote],
                commodity: linked.commodity || rfq.commodity,
            });
            quoteNumber = linked.quoteNumber;
        } else {
            res = await handleCreateQuote({
                clientId,
                date: new Date().toISOString(),
                expiryDate: new Date(Date.now() + 7 * 864e5).toISOString(),
                legs: [{ id: id(), collectionPoint: rfq.origin, deliveryPoint: rfq.destination, movementType: 'External' }],
                items: [{ id: id(), description: `${rfq.origin} → ${rfq.destination}${rfq.vehicleType ? ` (${rfq.vehicleType})` : ''}`, packagingType: 'Load', quantity: 1, rate: sell, total: sell }],
                totalAmount: sell,
                sentToClient: false,
                commodity: rfq.commodity || 'General Cargo',
                packaging: 'Load',
                loadSpec: rfq.vehicleType,
                specialRequirements: [rfq.loadType, rfq.weightKg ? `${Number(rfq.weightKg).toLocaleString('en-ZA')}kg` : null, rfq.gitRequired ? 'GIT required' : null].filter(Boolean).join(' · ') || undefined,
                subcontractorQuotes: [subQuote],
            });
            quoteNumber = res?.value?.quoteNumber || '';
            if (res?.ok && res.value?.id) await handleUpdateRfq(rfq.id, { quoteId: res.value.id });
        }
        if (res?.ok) {
            await handleAwardRfqQuote(rfq.id, quote.id);
            showToast(`Quote ${quoteNumber} ready for ${ (clients as any[]).find(c => c.id === clientId)?.name || 'client' } — review & send for approval.`);
            onClose();
        } else { setSaving(false); showToast(`Could not build quote: ${res?.error || 'unknown error'}`); }
    };

    return (
        <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-1">Quote the client</h3>
            <p className="text-sm text-gray-400 mb-4">{rfq.origin} → {rfq.destination} · winning carrier <span className="text-white font-semibold">{quote.companyName || carrier?.name || 'carrier'}</span></p>

            <label className={label}>Client *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={input}>
                <option value="">Select client…</option>
                {(clients as any[]).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {rfq.quoteId && <p className="text-[11px] text-emerald-400 mt-1">Updating the linked client quote.</p>}

            <div className="mt-5">
                <div className="flex justify-between items-baseline">
                    <label className={label}>Markup</label>
                    <span className="text-sm font-bold text-white">{markupPct}%</span>
                </div>
                <input type="range" min={0} max={50} step={1} value={markupPct} onChange={e => setMarkupPct(Number(e.target.value))} className="w-full accent-emerald-500" />
            </div>

            <div className="mt-4 bg-gray-900/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-400">Carrier rate (buy)</span><span className="font-mono text-white">{rand(buy)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Client price (sell)</span><span className="font-mono text-white font-bold">{rand(sell)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Margin</span><span className={`font-mono font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{rand(margin)}</span></div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 hover:text-white">Cancel</button>
                <button onClick={send} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">{saving ? 'Building…' : 'Build quote for approval'}</button>
            </div>
        </div>
    );
};

// ── One RFQ card with ranked quotes + markup + award ─────────────────────────
const RfqCard: React.FC<{ rfq: RfqRequest }> = ({ rfq }) => {
    const { handleUpdateRfq, clients = [], quotes = [] } = useOperations() as any;
    const { showToast } = useUIState();
    const clientName = rfq.clientId ? ((clients as any[]).find(c => c.id === rfq.clientId)?.name || 'Client') : '';
    const quoteNumber = rfq.quoteId ? ((quotes as any[]).find(q => q.id === rfq.quoteId)?.quoteNumber || '') : '';
    const [markup, setMarkup] = useState(15);
    const [logging, setLogging] = useState(false);
    const [awarding, setAwarding] = useState<CarrierQuote | null>(null);

    const ranked = useMemo(() => [...rfq.quotes].sort((a, b) => {
        if (a.canAssist !== b.canAssist) return a.canAssist ? -1 : 1;
        return (a.price ?? Infinity) - (b.price ?? Infinity);
    }), [rfq.quotes]);

    const statusColor = { Open: 'bg-blue-900/50 text-blue-300', Awarded: 'bg-green-900/50 text-green-300', Closed: 'bg-gray-700 text-gray-300', Cancelled: 'bg-red-900/50 text-red-300' }[rfq.status];

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">{rfq.requestNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>{rfq.status}</span>
                        {rfq.arrangingBranch && <span className="text-[10px] text-gray-500">{rfq.arrangingBranch}</span>}
                    </div>
                    <h4 className="text-white font-bold mt-1">{rfq.origin} → {rfq.destination}</h4>
                    {(clientName || quoteNumber) && (
                        <p className="text-[11px] text-emerald-300/90 mt-0.5">
                            {clientName && <span>👤 {clientName}</span>}
                            {clientName && quoteNumber && <span className="text-gray-600"> · </span>}
                            {quoteNumber && <span className="font-mono">{quoteNumber}</span>}
                        </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                        {[rfq.vehicleType, rfq.loadType, rfq.commodity, rfq.weightKg ? `${Number(rfq.weightKg).toLocaleString('en-ZA')}kg` : null, rfq.gitRequired ? 'GIT' : null]
                            .filter(Boolean).join(' · ')}
                        {rfq.hazardous && <span className="ml-1.5 text-red-400 font-bold">· HAZ (DG)</span>}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        {rfq.collectionDate ? `Collect ${rfq.collectionDate}${rfq.collectionTime ? ' ' + rfq.collectionTime : ''}` : ''}
                        {rfq.deliveryDate ? ` · Deliver ${rfq.deliveryDate}${rfq.deliveryTime ? ' ' + rfq.deliveryTime : ''}` : ''}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[11px] text-gray-500">{rfq.recipients.length} sent · {rfq.quotes.length} quoted</p>
                    <p className="text-[10px] text-gray-600">{format(new Date(rfq.createdAt), 'dd MMM HH:mm')}</p>
                    {rfq.status !== 'Awarded' && rfq.status !== 'Cancelled' && (
                        <button onClick={() => handleUpdateRfq(rfq.id, { status: 'Cancelled' })} className="text-[11px] text-gray-500 hover:text-red-400 mt-1">Cancel</button>
                    )}
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Markup</span>
                <input type="number" value={markup} onChange={e => setMarkup(Number(e.target.value))} className="w-16 bg-gray-700 border border-gray-600 rounded p-1 text-sm text-white" />
                <span className="text-[11px] text-gray-400">% → client price shown per quote</span>
            </div>

            <div className="mt-3 space-y-1.5">
                {ranked.length === 0 && <p className="text-sm text-gray-600 py-2">No quotes yet.</p>}
                {ranked.map((q, i) => {
                    const clientPrice = q.price ? q.price * (1 + markup / 100) : null;
                    const isBest = i === 0 && q.canAssist && q.price != null;
                    const isAwarded = q.id === rfq.awardedQuoteId || q.status === 'Awarded';
                    return (
                        <div key={q.id} className={`flex flex-wrap items-center gap-2 p-2 rounded-lg ${isAwarded ? 'bg-green-900/20 border border-green-800' : 'bg-gray-900/40'}`}>
                            <span className={`text-[10px] font-bold w-5 text-center ${isBest ? 'text-green-400' : 'text-gray-600'}`}>{q.canAssist ? `#${i + 1}` : '—'}</span>
                            <span className="flex-grow min-w-0">
                                <span className="text-sm text-white font-semibold">{q.companyName || 'Carrier'}</span>
                                {!q.canAssist && <span className="ml-2 text-[10px] text-amber-400">can't assist</span>}
                                <span className="block text-[11px] text-gray-500 truncate">{[q.vehicleOffered, q.notes].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span className="text-right">
                                <span className="block text-sm font-mono font-bold text-white">{rand(q.price)}</span>
                                {clientPrice != null && <span className="block text-[10px] text-gray-500">client {rand(clientPrice)}</span>}
                            </span>
                            {rfq.status !== 'Awarded' && q.canAssist && q.price != null && (
                                <button onClick={() => setAwarding(q)} className="text-[11px] font-bold bg-green-600 hover:bg-green-700 text-white py-1 px-2.5 rounded-lg inline-flex items-center">
                                    <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />Pick &amp; quote
                                </button>
                            )}
                            {isAwarded && <span className="text-[11px] font-bold text-green-400 inline-flex items-center"><CheckCircleIcon className="h-3.5 w-3.5 mr-1" />Awarded</span>}
                        </div>
                    );
                })}
            </div>

            {rfq.status !== 'Awarded' && rfq.status !== 'Cancelled' && (
                logging ? <LogQuote rfq={rfq} onDone={() => setLogging(false)} />
                    : <button onClick={() => setLogging(true)} className="mt-3 text-[12px] font-semibold text-brand-secondary hover:text-blue-400">+ Log a quote (phone / WhatsApp reply)</button>
            )}

            <Modal isOpen={!!awarding} onClose={() => setAwarding(null)} size="lg">
                {awarding && <QuoteClientModal rfq={rfq} quote={awarding} markup={markup} onClose={() => setAwarding(null)} />}
            </Modal>
        </div>
    );
};

// ── Board ────────────────────────────────────────────────────────────────────
const RfqBoard: React.FC<{ suppliers: Supplier[] }> = ({ suppliers = [] }) => {
    const { rfqRequests = [] } = useOperations() as any;
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<'Active' | 'All'>('Active');

    const list = useMemo(() => {
        const sorted = [...(rfqRequests as RfqRequest[])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return filter === 'Active' ? sorted.filter(r => r.status === 'Open' || r.status === 'Awarded') : sorted;
    }, [rfqRequests, filter]);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <select value={filter} onChange={e => setFilter(e.target.value as any)} className="bg-gray-700 p-2 rounded-md text-sm">
                        <option value="Active">Active</option>
                        <option value="All">All</option>
                    </select>
                    <span className="text-sm text-gray-500">{list.length} request(s)</span>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center font-bold py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Raise RFQ
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {list.map(rfq => <RfqCard key={rfq.id} rfq={rfq} />)}
            </div>
            {list.length === 0 && <p className="text-center text-gray-500 py-16">No quote requests yet. Raise one to broadcast a load to your carriers.</p>}

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} size="2xl">
                <RfqForm suppliers={suppliers} onClose={() => setShowForm(false)} />
            </Modal>
        </div>
    );
};

export default RfqBoard;
