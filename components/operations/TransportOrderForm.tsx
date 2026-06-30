import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Client, Branch, Contact } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import DateField from './DateField';
import RecipientPicker from './RecipientPicker';
import { bothDatesPast } from '../../lib/format';

interface TransportOrderFormProps {
    onSubmit: (data: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'>) => Promise<any> | void;
}

const ARRANGING_BRANCHES = ['FBNDBN', 'FBNJHB', 'FBN KZN', 'FBN CPT', 'FBN PE', 'FBN EL'];
const ROUTES = ['DBN - JHB', 'JHB - DBN', 'DBN - EL - DBN', 'DBN - PE - DBN', 'DBN - CPT - DBN', 'JHB - CPT - JHB', 'JHB - PE - JHB', 'JHB - EL - JHB'];
// Smallest → largest, so the dropdown reads in ascending order.
const LOAD_TYPES = ['LCL', 'PART LOAD', '6M', '6M CONTAINER', '12M', '12M CONTAINER', 'TRI AXLE', 'LINK', 'FLAT DECK', '6M FLAT DECK', '12M FLAT DECK', 'TRI-AXLE FLAT', 'SUPERLINK'];
const PACKAGING = ['PALLETS', 'CARTONS', 'CASES', 'COILS', 'DRUMS', 'BAGS', 'BUNDLES', 'LOOSE', 'LENGTHS', 'FULL LOAD', '6M CONTAINER', 'BULK'];
const EQUIPMENT = ['Straps', 'Corner Plates', 'Tarps', 'Nets', 'Chains', 'Rubber Mats', 'Dunnage', 'Container Locks', 'Labour', 'Uprights', 'Side Poles', 'Headboard'];
// FBN representatives — management can extend this list later from settings.
const FBN_REPS = ['Vinesh', 'Saiesh', 'Lawrence', 'Craig', 'Lourenzo', 'Ramon', 'Shoes', 'Jared', 'Marc', 'Len'];

const arrangingToBranch = (a: string): Branch =>
    a === 'FBNJHB' ? 'FBN JHB' : a === 'FBN CPT' ? 'FBN CPT' : 'FBN DBN';

// Merge a base list (table) with names actually used on past loadcons, ranked
// most-used first, so the dropdowns "learn" your real clients/subcontractors.
const rankNames = (base: (string | undefined)[], used: (string | undefined)[]): string[] => {
    const count = new Map<string, number>();
    used.forEach(n => { const v = (n || '').trim(); if (v) count.set(v, (count.get(v) || 0) + 1); });
    const all = new Set<string>([...base.map(b => (b || '').trim()).filter(Boolean), ...count.keys()]);
    return [...all].sort((a, b) => (count.get(b) || 0) - (count.get(a) || 0) || a.localeCompare(b));
};

const inputCls = "w-full bg-gray-900/60 text-white p-2.5 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent text-sm transition";
const labelCls = "block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1";

// Defined at module scope (NOT inside the form) so inputs keep focus while typing.
const Section: React.FC<{ title: string; accent?: string; children: React.ReactNode }> = ({ title, accent = 'bg-gray-600', children }) => (
    <div className="bg-gray-800/50 rounded-2xl border border-gray-700/60 p-5">
        <h3 className="flex items-center text-xs font-black text-gray-300 uppercase tracking-[0.18em] mb-4">
            <span className={`w-1.5 h-4 rounded-full mr-2.5 ${accent}`} />{title}
        </h3>
        {children}
    </div>
);

const TransportOrderForm: React.FC<TransportOrderFormProps> = ({ onSubmit }) => {
    const { hideModal } = useUIState();
    const { clients = [], suppliers = [], loadConfirmations = [], handleUpdateSupplier, handleUpdateClient } = useOperations() as any;
    const { currentUser } = useAuth();

    const today = new Date().toISOString().split('T')[0];
    const [saving, setSaving] = useState(false);

    const clientSuggestions = useMemo(
        () => rankNames((clients as any[]).map(c => c.name), (loadConfirmations as any[]).map(l => l.clientName)),
        [clients, loadConfirmations]);
    const subbieSuggestions = useMemo(
        () => rankNames((suppliers as any[]).map(s => s.name), (loadConfirmations as any[]).map(l => l.subcontractorName)),
        [suppliers, loadConfirmations]);
    // Routes: the built-in list plus any route ever typed on past loads, shown in
    // plain A–Z order so the list is easy to scan (not usage-ranked like names).
    const routeSuggestions = useMemo(() => {
        const set = new Set<string>([...ROUTES]);
        (loadConfirmations as any[]).forEach(l => { const r = (l.route || '').trim(); if (r) set.add(r); });
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [loadConfirmations]);

    // Order
    const [arrangingBranch, setArrangingBranch] = useState(ARRANGING_BRANCHES[0]);
    // Route via a transit depot: subbie drops at an FBN depot, FBN runs the onward leg.
    const [transitVia, setTransitVia] = useState(false);
    const [transitDepot, setTransitDepot] = useState('FBN JHB');
    const [finalBranch, setFinalBranch] = useState('FBN DBN');
    const [loadRefNo, setLoadRefNo] = useState('');
    const [fbnRepresentative, setFbnRepresentative] = useState(currentUser?.name || '');
    const [route, setRoute] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

    // Client side
    const [existingClientId, setExistingClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [customerOrderNumber, setCustomerOrderNumber] = useState('');
    const [clientRate, setClientRate] = useState('');

    // Collection
    const [collectionPoint, setCollectionPoint] = useState('');
    const [collectionContact, setCollectionContact] = useState('');
    const [collectionTelephone, setCollectionTelephone] = useState('');
    const [collectionDate, setCollectionDate] = useState(today);
    const [loadingTime, setLoadingTime] = useState('');

    // Delivery
    const [deliveryPoint, setDeliveryPoint] = useState('');
    const [deliveryContact, setDeliveryContact] = useState('');
    const [deliveryTelephone, setDeliveryTelephone] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [offloadingTime, setOffloadingTime] = useState('');

    // Cargo
    const [loadType, setLoadType] = useState('');
    const [quantity, setQuantity] = useState('');
    const [commodity, setCommodity] = useState('');
    const [packaging, setPackaging] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [volume, setVolume] = useState('');
    const [cargoValue, setCargoValue] = useState('');
    const [equipmentRequired, setEquipmentRequired] = useState<string[]>([]);
    const [specialInstructions, setSpecialInstructions] = useState('');

    // Container (optional)
    const [containerNo, setContainerNo] = useState('');
    const [containerOperator, setContainerOperator] = useState('');
    const [containerSealNo, setContainerSealNo] = useState('');
    const [containerTurnInAddress, setContainerTurnInAddress] = useState('');

    // Subcontractor side
    const [subcontractorName, setSubcontractorName] = useState('');
    const [forAttention, setForAttention] = useState('');
    const [subcontractorEmail, setSubcontractorEmail] = useState('');
    const [podEmail, setPodEmail] = useState('');
    const [ccEmail, setCcEmail] = useState('');
    const [subcontractorDriverName, setSubcontractorDriverName] = useState('');
    const [subcontractorDriverCell, setSubcontractorDriverCell] = useState('');
    const [transportRate, setTransportRate] = useState('');

    const toggleEquipment = (e: string) =>
        setEquipmentRequired(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

    // Most-frequent value for a field across this client's past loadcons.
    const modeForClient = (name: string, key: string): string => {
        const past = (loadConfirmations as any[]).filter(l => (l.clientName || '').toLowerCase() === name.toLowerCase());
        const counts = new Map<string, number>();
        past.forEach(l => { const v = (l[key] || '').toString().trim(); if (v) counts.set(v, (counts.get(v) || 0) + 1); });
        let best = '', n = 0;
        counts.forEach((c, v) => { if (c > n) { n = c; best = v; } });
        return best;
    };

    // Saved contacts for the currently-typed client / subcontractor — these feed
    // the "Contact Person" dropdowns. Choosing a person auto-fills their email.
    const clientContacts: Contact[] = useMemo(
        () => (clients as any[]).find(c => (c.name || '').toLowerCase() === clientName.toLowerCase())?.contacts || [],
        [clients, clientName]);
    const subbieContacts: Contact[] = useMemo(
        () => (suppliers as any[]).find(s => (s.name || '').toLowerCase() === subcontractorName.toLowerCase())?.contacts || [],
        [suppliers, subcontractorName]);

    // The matched company records — so the recipient picker can add a new person
    // back onto the right company permanently.
    const subbieCompany = useMemo(
        () => (suppliers as any[]).find(s => (s.name || '').toLowerCase() === subcontractorName.toLowerCase()),
        [suppliers, subcontractorName]);
    const clientCompany = useMemo(
        () => (clients as any[]).find(c => (c.name || '').toLowerCase() === clientName.toLowerCase()),
        [clients, clientName]);

    // The recipient picker is driven by (and writes back to) the existing email + CC
    // fields, so there's one source of truth: first selected = To, the rest = CC.
    const uniqEmails = (arr: (string | undefined)[]) => {
        const seen = new Set<string>(); const out: string[] = [];
        arr.forEach(e => { const v = (e || '').trim(); if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); } });
        return out;
    };
    const subbieSelected = useMemo(
        () => uniqEmails([subcontractorEmail, ...ccEmail.split(',')]),
        [subcontractorEmail, ccEmail]);
    const onSubbieRecipients = (emails: string[]) => {
        const list = uniqEmails(emails);
        setSubcontractorEmail(list[0] || '');
        setCcEmail(list.slice(1).join(', '));
        // Keep "For Attention" aligned to whoever is the primary recipient.
        const primary = subbieContacts.find(c => c.email && c.email.toLowerCase() === (list[0] || '').toLowerCase());
        if (primary?.name) setForAttention(primary.name);
    };
    const onAddSubbieContact = (c: Contact) => {
        if (!subbieCompany || !handleUpdateSupplier) return;
        handleUpdateSupplier(subbieCompany.id, { contacts: [...(subbieCompany.contacts || []), c] });
    };
    const clientSelected = useMemo(
        () => uniqEmails([clientEmail]),
        [clientEmail]);
    const onClientRecipients = (emails: string[]) => {
        const list = uniqEmails(emails);
        setClientEmail(list.join(', '));
        const primary = clientContacts.find(c => c.email && c.email.toLowerCase() === (list[0] || '').toLowerCase());
        if (primary?.name) setClientContact(primary.name);
    };
    const onAddClientContact = (c: Contact) => {
        if (!clientCompany || !handleUpdateClient) return;
        handleUpdateClient(clientCompany.id, { contacts: [...(clientCompany.contacts || []), c] });
    };

    const onClientContactChange = (name: string) => {
        setClientContact(name);
        const match = clientContacts.find(c => (c.name || '').toLowerCase() === name.toLowerCase());
        if (match?.email) setClientEmail(match.email);
    };

    const onSubbieContactChange = (name: string) => {
        setForAttention(name);
        const match = subbieContacts.find(c => (c.name || '').toLowerCase() === name.toLowerCase());
        if (match?.email) setSubcontractorEmail(match.email);
    };

    const onClientNameChange = (name: string) => {
        setClientName(name);
        const c = (clients as any[]).find(c => (c.name || '').toLowerCase() === name.toLowerCase());
        setExistingClientId(c ? c.id : '');
        // Default to the client's first saved contact (person + email); fall back
        // to the legacy single contact email if no contacts list exists yet.
        const cs: Contact[] = c?.contacts || [];
        if (cs.length) {
            if (!clientContact) setClientContact(cs[0].name || '');
            if (cs[0].email) setClientEmail(cs[0].email);
        } else if (c?.contactEmail || c?.email) {
            setClientEmail(c.contactEmail || c.email);
        }
        // Prefill from this client's MOST RECENT load so a repeat booking is mostly
        // done — you just tweak what changed. Only fills fields you've left blank.
        const past = (loadConfirmations as any[])
            .filter(l => (l.clientName || '').toLowerCase() === name.toLowerCase());
        const latest = past.slice().sort((a, b) =>
            new Date(b.date || b.collectionDate || 0).getTime() - new Date(a.date || a.collectionDate || 0).getTime())[0];
        const pick = (key: string) => (latest && latest[key] != null && `${latest[key]}` !== '') ? `${latest[key]}` : modeForClient(name, key);
        const fill = (cur: string, setter: (v: string) => void, key: string) => { if (!cur) { const v = pick(key); if (v) setter(v); } };
        fill(collectionPoint, setCollectionPoint, 'collectionPoint');
        fill(deliveryPoint, setDeliveryPoint, 'deliveryPoint');
        fill(collectionContact, setCollectionContact, 'collectionContact');
        fill(collectionTelephone, setCollectionTelephone, 'collectionTelephone');
        fill(deliveryContact, setDeliveryContact, 'deliveryContact');
        fill(deliveryTelephone, setDeliveryTelephone, 'deliveryTelephone');
        fill(route, setRoute, 'route');
        fill(commodity, setCommodity, 'commodity');
        fill(packaging, setPackaging, 'packaging');
        fill(loadType, setLoadType, 'loadType');
        fill(weightKg, setWeightKg, 'weightKg');
        // Carry the last agreed client rate forward as a starting point.
        if (!clientRate && latest?.totalAmount) setClientRate(`${latest.totalAmount}`);
    };

    const onSubbieNameChange = (name: string) => {
        setSubcontractorName(name);
        const s = (suppliers as any[]).find(s => (s.name || '').toLowerCase() === name.toLowerCase());
        if (s) {
            const cs: Contact[] = s.contacts || [];
            if (cs.length) {
                if (!forAttention) setForAttention(cs[0].name || '');
                if (cs[0].email && !subcontractorEmail) setSubcontractorEmail(cs[0].email);
                // CC the supplier's contacts flagged to receive docs (LoadCon + POD)
                // — accounts + any other controllers ticked for docs. Routing for
                // updates vs docs is finalised from the saved prefs when the load saves.
                const others = cs.slice(1).filter(c => c.email && (c.getsDocs ?? true)).map(c => c.email) as string[];
                if (others.length && !ccEmail) setCcEmail(others.join(', '));
            } else {
                if (s.contactPerson && !forAttention) setForAttention(s.contactPerson);
                if (s.contactEmail && !subcontractorEmail) setSubcontractorEmail(s.contactEmail);
            }
        }
        // Pull this subbie's most recent transport rate through so it pre-fills
        // (you just tweak it). Only fills when the rate box is still blank.
        if (!transportRate) {
            const past = (loadConfirmations as any[])
                .filter(l => (l.subcontractorName || '').toLowerCase() === name.toLowerCase() && l.supplierRate)
                .sort((a, b) => new Date(b.date || b.collectionDate || 0).getTime() - new Date(a.date || a.collectionDate || 0).getTime());
            if (past[0]?.supplierRate) setTransportRate(String(past[0].supplierRate));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Only the client + route are required up front. A load can be raised
        // unassigned (no subbie/buy-rate yet) and assigned later from the board.
        if (!clientName || !collectionPoint || !deliveryPoint) {
            alert('Please fill: Client, Collection address and Delivery address. (Subcontractor & rates can be added when you assign.)');
            return;
        }
        if (!deliveryDate) {
            alert('Please set a Delivery date — it is required (a time is optional; the driver/subbie updates the ETA at the loading point).');
            return;
        }
        // Both dates in the past = the load is created as already Delivered. Confirm
        // so a date typo doesn't silently mark a brand-new load delivered.
        if (bothDatesPast(collectionDate, deliveryDate) && !window.confirm('Both the loading and delivery dates are in the past — this load will be created as ALREADY DELIVERED (awaiting POD). Continue?')) return;
        const data: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'> = {
            clientId: existingClientId || '',
            items: [],
            legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Subcontracted' }],
            totalAmount: parseFloat(clientRate) || 0,
            supplierRate: parseFloat(transportRate) || 0,
            collectionBranch: arrangingToBranch(arrangingBranch),
            destinationBranch: transitVia ? (finalBranch as any) : arrangingToBranch(arrangingBranch),
            ...(transitVia ? { transitDepot: transitDepot as any } : {}),
            priority,
            collectionPoint,
            deliveryPoint,
            collectionDate,
            deliveryDate: deliveryDate || undefined,
            customerOrderNumber: customerOrderNumber || undefined,
            commodity: commodity || undefined,
            packaging: packaging || undefined,
            arrangingBranch,
            loadRefNo: loadRefNo || undefined,
            clientName,
            clientContact: clientContact || undefined,
            clientEmail: clientEmail || undefined,
            route: route || undefined,
            fbnRepresentative: fbnRepresentative || undefined,
            loadingTime: loadingTime || undefined,
            offloadingTime: offloadingTime || undefined,
            collectionContact: collectionContact || undefined,
            collectionTelephone: collectionTelephone || undefined,
            deliveryContact: deliveryContact || undefined,
            deliveryTelephone: deliveryTelephone || undefined,
            loadType: loadType || undefined,
            quantity: quantity || undefined,
            weightKg: weightKg || undefined,
            volume: volume || undefined,
            cargoValue: cargoValue || undefined,
            equipmentRequired: equipmentRequired.length ? equipmentRequired : undefined,
            containerNo: containerNo || undefined,
            containerTurnInAddress: containerTurnInAddress || undefined,
            containerOperator: containerOperator || undefined,
            containerSealNo: containerSealNo || undefined,
            specialInstructions: specialInstructions || undefined,
            subcontractorName,
            forAttention: forAttention || undefined,
            subcontractorEmail: subcontractorEmail || undefined,
            podEmail: podEmail || undefined,
            ccEmail: ccEmail || undefined,
            subcontractorDriverName: subcontractorDriverName || undefined,
            subcontractorDriverCell: subcontractorDriverCell || undefined,
        };
        setSaving(true);
        try {
            // Never let the button hang forever — if the save stalls (e.g. a slow
            // connection), time out after 25s with a clear message.
            const res = await Promise.race([
                Promise.resolve(onSubmit(data)),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timed out — please check your connection and try again.')), 40000)),
            ]) as any;
            if (res && res.ok === false) { alert(`Could not create the Transport Order: ${res.error || 'unknown error'}`); return; }
            hideModal();
        } catch (e) {
            alert(`Could not create the Transport Order: ${e instanceof Error ? e.message : 'unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-1">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black text-white flex items-center">
                    <span className="w-2 h-8 bg-brand-secondary rounded mr-3" />New Transport Order
                </h2>
                <span className="text-[11px] text-gray-500 font-semibold hidden sm:block">Client rate & subbie rate stay private to each side</span>
            </div>

            <div className="space-y-5 max-h-[74vh] overflow-y-auto pr-3 custom-scrollbar">
                <Section title="Order Details" accent="bg-brand-secondary">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className={labelCls}>Arranging Branch</label>
                            <select value={arrangingBranch} onChange={e => setArrangingBranch(e.target.value)} className={inputCls}>
                                {ARRANGING_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                            </select></div>
                        <div><label className={labelCls}>FBN DI / Waybill no</label>
                            <input value={loadRefNo} onChange={e => setLoadRefNo(e.target.value)} className={inputCls} placeholder="manual waybill / DI no (tracking + invoicing)" /></div>
                        <div className="md:col-span-3 bg-gray-900/30 rounded-lg p-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-200">
                                <input type="checkbox" checked={transitVia} onChange={e => setTransitVia(e.target.checked)} /> 🔄 Subbie delivers to an FBN depot for inter-depot transfer (transit)
                            </label>
                            {transitVia && (
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div><label className={labelCls}>Transit depot (subbie drops here)</label>
                                        <select value={transitDepot} onChange={e => setTransitDepot(e.target.value)} className={inputCls}>{['FBN DBN', 'FBN JHB', 'FBN CPT'].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                    <div><label className={labelCls}>Final delivery region (FBN runs onward)</label>
                                        <select value={finalBranch} onChange={e => setFinalBranch(e.target.value)} className={inputCls}>{['FBN DBN', 'FBN JHB', 'FBN CPT'].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                    <p className="col-span-2 text-[11px] text-indigo-300">The subbie LoadCon will show delivery to <strong>{transitDepot}</strong>; FBN then plans the onward leg to <strong>{finalBranch}</strong> from the load (received at depot → assign fleet/subbie → deliver).</p>
                                </div>
                            )}
                        </div>
                        <div><label className={labelCls}>FBN Representative</label>
                            <select value={fbnRepresentative} onChange={e => setFbnRepresentative(e.target.value)} className={inputCls}>
                                {!FBN_REPS.includes(fbnRepresentative) && fbnRepresentative && <option value={fbnRepresentative}>{fbnRepresentative}</option>}
                                <option value="">-- Select --</option>
                                {FBN_REPS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select></div>
                        <div><label className={labelCls}>Route</label>
                            {/* Plain text input (fully editable / deletable) + a separate
                                quick-pick. A <datalist> here fought backspace in Chrome
                                whenever the text matched a saved route. */}
                            <div className="flex gap-2">
                                <input value={route} onChange={e => setRoute(e.target.value)} className={inputCls} placeholder="type a route e.g. DBN - JHB" />
                                <select value="" onChange={e => { if (e.target.value) setRoute(e.target.value); }} title="Quick-pick a saved route" className={`${inputCls} w-auto shrink-0`}>
                                    <option value="">Pick…</option>
                                    {routeSuggestions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div></div>
                        <div><label className={labelCls}>Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value as any)} className={inputCls}>
                                <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                            </select></div>
                    </div>
                </Section>

                <Section title="Client  ·  goes on the Client Order only" accent="bg-blue-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={labelCls}>Client (company) *</label>
                            <input list="clientList" value={clientName} onChange={e => onClientNameChange(e.target.value)} className={inputCls} required placeholder="start typing — picks from your clients" />
                            <datalist id="clientList">{clientSuggestions.map(n => <option key={n} value={n} />)}</datalist></div>
                        <div><label className={labelCls}>Contact Person {clientContacts.length > 0 && <span className="text-blue-400 normal-case font-semibold">· {clientContacts.length} saved</span>}</label>
                            <input list="clientContactList" value={clientContact} onChange={e => onClientContactChange(e.target.value)} className={inputCls} placeholder={clientName ? 'who are we dealing with?' : 'pick the client first'} />
                            <datalist id="clientContactList">{clientContacts.map(c => <option key={c.name} value={c.name}>{c.email ? `${c.name} — ${c.email}` : c.name}</option>)}</datalist></div>
                        <div><label className={labelCls}>Client Email</label>
                            <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inputCls} placeholder="auto-fills when you pick the person" /></div>
                        <div><label className={labelCls}>Customer Order No</label>
                            <input value={customerOrderNumber} onChange={e => setCustomerOrderNumber(e.target.value)} className={inputCls} /></div>
                        <div className="md:col-span-2"><label className={labelCls}>Client Rate (excl VAT) *</label>
                            <div className="relative"><span className="absolute left-3 top-2.5 text-blue-400 font-mono text-xs">R</span>
                                <input type="number" step="0.01" value={clientRate} onChange={e => setClientRate(e.target.value)} className={`${inputCls} pl-7`} /></div></div>
                    </div>
                    {clientName && (
                        <div className="mt-4">
                            <RecipientPicker kind="client" contacts={clientContacts} selectedEmails={clientSelected} onChange={onClientRecipients} onAddContact={clientCompany ? onAddClientContact : undefined} />
                        </div>
                    )}
                </Section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Section title="Collection">
                        <div className="space-y-3">
                            <div><label className={labelCls}>Collection Address *</label>
                                <AddressAutocompleteInput value={collectionPoint} onChange={setCollectionPoint} placeholder="Search Google Maps address…" required className={inputCls}
                                    onPlace={info => { if (info.name && !collectionContact) setCollectionContact(info.name); if (info.phone && !collectionTelephone) setCollectionTelephone(info.phone); }} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelCls}>Contact</label><input value={collectionContact} onChange={e => setCollectionContact(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Telephone</label><input value={collectionTelephone} onChange={e => setCollectionTelephone(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Loading Date</label><DateField value={collectionDate} onChange={setCollectionDate} className={inputCls} /></div>
                                <div><label className={labelCls}>Loading Time</label><input type="time" value={loadingTime} onChange={e => setLoadingTime(e.target.value)} className={inputCls} /></div>
                            </div>
                        </div>
                    </Section>
                    <Section title="Delivery">
                        <div className="space-y-3">
                            <div><label className={labelCls}>Delivery Address *</label>
                                <AddressAutocompleteInput value={deliveryPoint} onChange={setDeliveryPoint} placeholder="Search Google Maps address…" required className={inputCls}
                                    onPlace={info => { if (info.name && !deliveryContact) setDeliveryContact(info.name); if (info.phone && !deliveryTelephone) setDeliveryTelephone(info.phone); }} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelCls}>Contact</label><input value={deliveryContact} onChange={e => setDeliveryContact(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Telephone</label><input value={deliveryTelephone} onChange={e => setDeliveryTelephone(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Delivery Date *</label><DateField value={deliveryDate} onChange={setDeliveryDate} className={inputCls} /></div>
                                <div><label className={labelCls}>Offloading Time</label><input type="time" value={offloadingTime} onChange={e => setOffloadingTime(e.target.value)} className={inputCls} /></div>
                            </div>
                        </div>
                    </Section>
                </div>

                <Section title="Cargo">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><label className={labelCls}>Load Type</label>
                            <select value={loadType} onChange={e => setLoadType(e.target.value)} className={inputCls}><option value="">--</option>{LOAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div><label className={labelCls}>Quantity</label><input value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} /></div>
                        <div><label className={labelCls}>Commodity</label><input value={commodity} onChange={e => setCommodity(e.target.value)} className={inputCls} /></div>
                        <div><label className={labelCls}>Packaging</label>
                            <select value={packaging} onChange={e => setPackaging(e.target.value)} className={inputCls}><option value="">--</option>{PACKAGING.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                        <div><label className={labelCls}>Weight (kg)</label><input value={weightKg} onChange={e => setWeightKg(e.target.value)} className={inputCls} /></div>
                        <div><label className={labelCls}>Volume / Cubes</label><input value={volume} onChange={e => setVolume(e.target.value)} className={inputCls} /></div>
                        <div className="col-span-2"><label className={labelCls}>Cargo Value (GIT)</label>
                            <div className="relative"><span className="absolute left-3 top-2.5 text-gray-500 font-mono text-xs">R</span>
                                <input type="number" value={cargoValue} onChange={e => setCargoValue(e.target.value)} className={`${inputCls} pl-7`} /></div></div>
                    </div>
                    <div className="mt-4">
                        <label className={labelCls}>Equipment Required</label>
                        <div className="flex flex-wrap gap-2">
                            {EQUIPMENT.map(eq => (
                                <button type="button" key={eq} onClick={() => toggleEquipment(eq)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${equipmentRequired.includes(eq) ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-gray-900/40 text-gray-300 border-gray-700 hover:border-gray-500'}`}>
                                    {eq}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4"><label className={labelCls}>Special Instructions</label>
                        <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={2} className={inputCls} /></div>
                    <details className="mt-4">
                        <summary className="text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white">Container details (if applicable)</summary>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                            <div><label className={labelCls}>Container No</label><input value={containerNo} onChange={e => setContainerNo(e.target.value)} className={inputCls} /></div>
                            <div><label className={labelCls}>Operator</label><input value={containerOperator} onChange={e => setContainerOperator(e.target.value)} className={inputCls} /></div>
                            <div><label className={labelCls}>Seal No</label><input value={containerSealNo} onChange={e => setContainerSealNo(e.target.value)} className={inputCls} /></div>
                            <div><label className={labelCls}>Turn-in Address</label><input value={containerTurnInAddress} onChange={e => setContainerTurnInAddress(e.target.value)} className={inputCls} /></div>
                        </div>
                    </details>
                </Section>

                <Section title="Subcontractor  ·  goes on the LoadCon only" accent="bg-amber-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className={labelCls}>Subcontractor *</label>
                            <input list="subbieList" value={subcontractorName} onChange={e => onSubbieNameChange(e.target.value)} className={inputCls} placeholder="optional — leave blank to assign later" />
                            <datalist id="subbieList">{subbieSuggestions.map(n => <option key={n} value={n} />)}</datalist></div>
                        <div><label className={labelCls}>For Attention {subbieContacts.length > 0 && <span className="text-amber-400 normal-case font-semibold">· {subbieContacts.length} saved</span>}</label>
                            <input list="subbieContactList" value={forAttention} onChange={e => onSubbieContactChange(e.target.value)} className={inputCls} placeholder={subcontractorName ? 'controller / contact' : 'pick the subbie first'} />
                            <datalist id="subbieContactList">{subbieContacts.map(c => <option key={c.name} value={c.name}>{c.email ? `${c.name} — ${c.email}` : c.name}</option>)}</datalist></div>
                        <div><label className={labelCls}>Subcontractor Email</label><input type="email" value={subcontractorEmail} onChange={e => setSubcontractorEmail(e.target.value)} className={inputCls} placeholder="auto-fills when you pick the person" /></div>
                        <div><label className={labelCls}>Reg + Driver Name</label><input value={subcontractorDriverName} onChange={e => setSubcontractorDriverName(e.target.value)} className={inputCls} /></div>
                        <div><label className={labelCls}>Driver Cell</label><input value={subcontractorDriverCell} onChange={e => setSubcontractorDriverCell(e.target.value)} className={inputCls} /></div>
                        <div><label className={labelCls}>Transport Rate (excl VAT) *</label>
                            <div className="relative"><span className="absolute left-3 top-2.5 text-amber-400 font-mono text-xs">R</span>
                                <input type="number" step="0.01" value={transportRate} onChange={e => setTransportRate(e.target.value)} className={`${inputCls} pl-7`} /></div></div>
                        <div><label className={labelCls}>POD Email</label><input type="email" value={podEmail} onChange={e => setPodEmail(e.target.value)} className={inputCls} /></div>
                        <div className="md:col-span-2"><label className={labelCls}>CC for updates · accounts / other controllers</label>
                            <input value={ccEmail} onChange={e => setCcEmail(e.target.value)} className={inputCls} placeholder="comma-separated — pre-fills from the subbie's saved contacts" />
                            <p className="text-[10px] text-gray-500 mt-1">These get the LoadCon and every status update. New ones are saved to this subcontractor for next time.</p></div>
                        {subcontractorName && (
                            <div className="md:col-span-3">
                                <RecipientPicker kind="supplier" contacts={subbieContacts} selectedEmails={subbieSelected} onChange={onSubbieRecipients} onAddContact={subbieCompany ? onAddSubbieContact : undefined} />
                            </div>
                        )}
                    </div>
                </Section>
            </div>

            <div className="flex justify-end items-center gap-3 mt-6 pt-5 border-t border-gray-700/60">
                <button type="button" onClick={hideModal} className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition">Cancel</button>
                <button type="submit" disabled={saving} className="bg-brand-primary hover:bg-brand-secondary text-white font-black py-2.5 px-10 rounded-xl shadow-lg transition active:scale-95 uppercase tracking-wider disabled:opacity-60">
                    {saving ? 'Creating…' : 'Create Transport Order'}
                </button>
            </div>
        </form>
    );
};

export default TransportOrderForm;
