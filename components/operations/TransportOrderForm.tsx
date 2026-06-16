import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Client, Branch, Contact } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import AddressAutocompleteInput from './AddressAutocompleteInput';

interface TransportOrderFormProps {
    onSubmit: (data: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'>) => Promise<any> | void;
}

const ARRANGING_BRANCHES = ['FBNDBN', 'FBNJHB', 'FBN KZN', 'FBN CPT', 'FBN PE', 'FBN EL'];
const ROUTES = ['DBN - JHB', 'JHB - DBN', 'DBN - EL - DBN', 'DBN - PE - DBN', 'DBN - CPT - DBN', 'JHB - CPT - JHB', 'JHB - PE - JHB', 'JHB - EL - JHB'];
const LOAD_TYPES = ['LCL', 'PART LOAD', '6M', '12M', 'TRI AXLE', 'LINK', '6M CONTAINER', '12M CONTAINER'];
const PACKAGING = ['PALLETS', 'CARTONS', 'CASES', 'COILS', 'DRUMS', 'BAGS', 'BUNDLES', 'LOOSE', 'LENGTHS', 'FULL LOAD', '6M CONTAINER', 'BULK'];
const EQUIPMENT = ['Straps', 'Corner Plates', 'Tarps', 'Nets', 'Chains', 'Rubber Mats', 'Dunnage', 'Container Locks', 'Labour'];
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
    const { clients = [], suppliers = [], loadConfirmations = [] } = useOperations() as any;
    const { currentUser } = useAuth();

    const today = new Date().toISOString().split('T')[0];
    const [saving, setSaving] = useState(false);

    const clientSuggestions = useMemo(
        () => rankNames((clients as any[]).map(c => c.name), (loadConfirmations as any[]).map(l => l.clientName)),
        [clients, loadConfirmations]);
    const subbieSuggestions = useMemo(
        () => rankNames((suppliers as any[]).map(s => s.name), (loadConfirmations as any[]).map(l => l.subcontractorName)),
        [suppliers, loadConfirmations]);

    // Order
    const [arrangingBranch, setArrangingBranch] = useState(ARRANGING_BRANCHES[0]);
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
        // Prefill the rest with this client's most-used details (only empty fields).
        const fill = (cur: string, setter: (v: string) => void, key: string) => { if (!cur) { const v = modeForClient(name, key); if (v) setter(v); } };
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
    };

    const onSubbieNameChange = (name: string) => {
        setSubcontractorName(name);
        const s = (suppliers as any[]).find(s => (s.name || '').toLowerCase() === name.toLowerCase());
        if (s) {
            const cs: Contact[] = s.contacts || [];
            if (cs.length) {
                if (!forAttention) setForAttention(cs[0].name || '');
                if (cs[0].email && !subcontractorEmail) setSubcontractorEmail(cs[0].email);
            } else {
                if (s.contactPerson && !forAttention) setForAttention(s.contactPerson);
                if (s.contactEmail && !subcontractorEmail) setSubcontractorEmail(s.contactEmail);
            }
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
        const data: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'> = {
            clientId: existingClientId || '',
            items: [],
            legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Subcontracted' }],
            totalAmount: parseFloat(clientRate) || 0,
            supplierRate: parseFloat(transportRate) || 0,
            collectionBranch: arrangingToBranch(arrangingBranch),
            destinationBranch: arrangingToBranch(arrangingBranch),
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
        const res = await onSubmit(data);
        setSaving(false);
        if (res && res.ok === false) { alert(`Could not create the Transport Order: ${res.error || 'unknown error'}`); return; }
        hideModal();
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
                        <div><label className={labelCls}>Load Ref No (FBN DI / Manifest)</label>
                            <input value={loadRefNo} onChange={e => setLoadRefNo(e.target.value)} className={inputCls} placeholder="e.g. DI12345" /></div>
                        <div><label className={labelCls}>FBN Representative</label>
                            <select value={fbnRepresentative} onChange={e => setFbnRepresentative(e.target.value)} className={inputCls}>
                                {!FBN_REPS.includes(fbnRepresentative) && fbnRepresentative && <option value={fbnRepresentative}>{fbnRepresentative}</option>}
                                <option value="">-- Select --</option>
                                {FBN_REPS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select></div>
                        <div><label className={labelCls}>Route</label>
                            <select value={route} onChange={e => setRoute(e.target.value)} className={inputCls}>
                                <option value="">-- Select --</option>{ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select></div>
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
                    {clientName && clientContacts.length === 0 && (
                        <p className="text-[11px] text-gray-500 mt-3">New contact — it'll be saved to <span className="text-gray-300 font-semibold">{clientName}</span> for next time.</p>
                    )}
                </Section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Section title="Collection">
                        <div className="space-y-3">
                            <div><label className={labelCls}>Collection Address *</label>
                                <AddressAutocompleteInput value={collectionPoint} onChange={setCollectionPoint} placeholder="Search Google Maps address…" required className={inputCls} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelCls}>Contact</label><input value={collectionContact} onChange={e => setCollectionContact(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Telephone</label><input value={collectionTelephone} onChange={e => setCollectionTelephone(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Loading Date</label><input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Loading Time</label><input type="time" value={loadingTime} onChange={e => setLoadingTime(e.target.value)} className={inputCls} /></div>
                            </div>
                        </div>
                    </Section>
                    <Section title="Delivery">
                        <div className="space-y-3">
                            <div><label className={labelCls}>Delivery Address *</label>
                                <AddressAutocompleteInput value={deliveryPoint} onChange={setDeliveryPoint} placeholder="Search Google Maps address…" required className={inputCls} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelCls}>Contact</label><input value={deliveryContact} onChange={e => setDeliveryContact(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Telephone</label><input value={deliveryTelephone} onChange={e => setDeliveryTelephone(e.target.value)} className={inputCls} /></div>
                                <div><label className={labelCls}>Offloading Date</label><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={inputCls} /></div>
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
                        <div><label className={labelCls}>Copy Email (CC)</label><input type="email" value={ccEmail} onChange={e => setCcEmail(e.target.value)} className={inputCls} /></div>
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
