import React, { useMemo, useState } from 'react';
import { Client, Contact, Branch, ClientBranch } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import { directInsert } from '../../lib/supabase';
import { FBN_ORGANIZATION_ID } from '../../lib/mappers';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import DateField from './DateField';

const CONTAINER_SIZES = ['20FT', '40FT', '40HC', '45FT', 'REEFER 20FT', 'REEFER 40FT', 'FLAT RACK', 'OPEN TOP'];

// Structured load-type selection (Marc, 2026-07-01).
const LOAD_CATEGORIES = ['Consol', 'Part Load', 'Full Load'] as const;
type LoadCategory = typeof LOAD_CATEGORIES[number];
const DECK_SPACES = ['1m', '3m', '6m', '9m', '12m'];                                    // Part load
const FULL_VEHICLES = ['5 Tonner', '8 Tonner', '12 Tonner', '15 Tonner', '12m', 'Tri-axle', 'Superlink']; // Full load
const BODY_TYPES = ['Tautliner', 'Flat deck', 'Flat deck + uprights'];

// Areas where FBN ops can action a collection. Value = Branch code stored on the load.
const AREAS: { code: Branch; label: string }[] = [
    { code: 'FBN JHB', label: 'Johannesburg' },
    { code: 'FBN DBN', label: 'Durban' },
    { code: 'FBN CPT', label: 'Cape Town' },
];

// Read the ops AREA straight off the address (so the dropdowns follow what's typed).
// Returns null when nothing matches (leave the area as-is).
const classifyArea = (text: string): Branch | null => {
    const t = (text || '').toLowerCase();
    if (/johannesburg|jhb|gauteng|germiston|wadeville|kempton|isando|midrand|pretoria|\bpta\b|boksburg|edenvale|jet park|alberton|roodepoort|sandton|centurion|benoni|brakpan|springs|vereeniging|vanderbijl|krugersdorp|chamdor|nigel|heidelberg/.test(t)) return 'FBN JHB';
    if (/cape town|\bcpt\b|western cape|bellville|paarl|stellenbosch|somerset west|epping|montague|maitland|parow|brackenfell|killarney/.test(t)) return 'FBN CPT';
    if (/durban|\bdbn\b|kzn|kwazulu|pinetown|phoenix|umhlanga|pietermaritzburg|\bpmb\b|mobeni|jacobs|prospecton|congella|westmead|new germany|hammarsdale|cato ridge|richards bay/.test(t)) return 'FBN DBN';
    return null;
};

// Fast, mobile-first "log a collection" form. A collection IS a load — on send it
// creates the load (flagged is_collection), emails ops in that area to assign a
// driver + ETA, and acknowledges the client. Then it rides the normal LoadCon rails.
const QuickCollectionForm: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { clients = [], loadConfirmations = [], handleUpdateClient } = useOperations() as any;
    const { currentUser } = useAuth();
    const onSubmit = modal.payload?.onSubmit as (data: any) => Promise<any>;

    const today = new Date().toISOString().split('T')[0];
    const [clientName, setClientName] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientContact, setClientContact] = useState('');
    // Multi-branch clients (e.g. Waco → Formscaff DBN/Ballito/…): a transfer can collect
    // from one site and deliver to / be billed to another. Two separate pickers.
    const [collectBranch, setCollectBranch] = useState(''); // where we COLLECT (drives collection area)
    const [billBranch, setBillBranch] = useState('');       // who ORDERED / pays + deliver-to (drives delivery area + contact)
    const [loadRefNo, setLoadRefNo] = useState('');
    const [collectionPoint, setCollectionPoint] = useState('');
    const [deliveryPoint, setDeliveryPoint] = useState('');
    const [commodity, setCommodity] = useState('');
    const [packages, setPackages] = useState('');
    const [collectionDate, setCollectionDate] = useState(today);
    const [collArea, setCollArea] = useState<Branch>('FBN JHB');
    const [delArea, setDelArea] = useState<Branch>('FBN JHB');
    const [notes, setNotes] = useState('');
    // Structured load type + the fields that depend on it.
    const [loadCategory, setLoadCategory] = useState<LoadCategory | ''>('');
    const [deckSpace, setDeckSpace] = useState('');   // Part load
    const [fullVehicle, setFullVehicle] = useState(''); // Full load
    const [bodyType, setBodyType] = useState('');       // Tautliner / Flat deck / Flat deck + uprights
    const [pkgDims, setPkgDims] = useState('');         // Consol — dims per package if they differ
    const [weightKg, setWeightKg] = useState('');
    const [dimensions, setDimensions] = useState('');   // total cubes (m³)
    // Rate (expandable).
    const [showDetails, setShowDetails] = useState(false);
    const [rate, setRate] = useState('');
    // Composed load-type label stored on the load (drives the board "Size" column).
    const composedLoadType = [loadCategory, loadCategory === 'Part Load' ? deckSpace : loadCategory === 'Full Load' ? fullVehicle : '', bodyType].filter(Boolean).join(' · ');
    // Add a new person against the chosen client (saved for next time).
    const [addingPerson, setAddingPerson] = useState(false);
    const [np, setNp] = useState({ name: '', email: '' });
    // Everyone else to keep in copy (CC) on this load's comms — the primary contact
    // goes on To, all of these are CC'd so the whole group stays on one email thread
    // (client people, a loading-point or delivery-point contact, etc.). Marc's rule.
    const [ccEmails, setCcEmails] = useState<string[]>([]);
    const [addCc, setAddCc] = useState('');
    const [isContainer, setIsContainer] = useState(false);
    const [ctrNo, setCtrNo] = useState('');
    const [seal, setSeal] = useState('');
    const [ctrSize, setCtrSize] = useState('');
    const [turnIn, setTurnIn] = useState('');
    const [operator, setOperator] = useState('');
    const [busy, setBusy] = useState(false);

    const clientNames = useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);
    const commodities = useMemo(() => [...new Set((loadConfirmations as any[]).map(l => l.commodity).filter(Boolean))].sort(), [loadConfirmations]);

    const onClient = (name: string) => {
        setClientName(name);
        const c = (clients as any[]).find(x => (x.name || '').toLowerCase() === name.toLowerCase()) as Client | undefined;
        if (c) {
            setClientId(c.id);
            const cs: Contact[] = (c as any).contacts || [];
            if (cs[0]?.email) setClientEmail(cs[0].email); else if ((c as any).contactEmail) setClientEmail((c as any).contactEmail);
            if (cs[0]?.name) setClientContact(cs[0].name); else if (c.contactPerson) setClientContact(c.contactPerson);
            // Prefill the usual collection point from this client's last collection.
            const past = (loadConfirmations as any[]).filter(l => (l.clientName || '').toLowerCase() === name.toLowerCase())
                .sort((a, b) => new Date(b.date || b.collectionDate || 0).getTime() - new Date(a.date || a.collectionDate || 0).getTime());
            if (past[0]?.collectionPoint && !collectionPoint) setCollectionPoint(past[0].collectionPoint);
        } else { setClientId(''); }
        setCollectBranch(''); setBillBranch(''); // reset branches when the client changes
    };

    const selClient = useMemo(() => (clients as any[]).find(c => c.id === clientId), [clients, clientId]);
    const branchList: ClientBranch[] = (selClient?.branches || []) as ClientBranch[];
    const selBillBranch = branchList.find(b => b.name === billBranch);
    // Contacts to pick from = the ordering/paying branch's people if picked, else the company's.
    const clientContacts: Contact[] = ((selBillBranch ? selBillBranch.contacts : selClient?.contacts) || []) as Contact[];
    // Collect-from site → fills the collection address + FBN collection area. The area
    // is read from the address, and — because a branch address is often just the company
    // name with no city (e.g. PERI) — falls back to the BRANCH NAME (JHB/DBN/CPT), which
    // is the reliable signal. That fixes "the routing didn't pull the area" (Marc).
    const onCollectBranch = (name: string) => {
        setCollectBranch(name);
        const b = branchList.find(x => x.name === name);
        if (b?.address) setCollectionPoint(b.address);
        const a = classifyArea(b?.address || '') || classifyArea(name);
        if (a) setCollArea(a);
    };
    // Ordering / paying site → deliver-to address + FBN delivery area + the billing contact.
    const onBillBranch = (name: string) => {
        setBillBranch(name);
        const b = branchList.find(x => x.name === name);
        if (!b) return;
        if (b.address) setDeliveryPoint(b.address);
        const a = classifyArea(b.address || '') || classifyArea(name);
        if (a) setDelArea(a);
        const bc = (b.contacts || [])[0];
        const cName = bc?.name || b.contactPerson; const cEmail = bc?.email || b.contactEmail;
        if (cName) setClientContact(cName); if (cEmail) setClientEmail(cEmail);
    };
    // Pick a saved person for this company → fills contact + email.
    const pickContact = (name: string) => {
        const c = clientContacts.find(x => x.name === name);
        if (c) { setClientContact(c.name || ''); if (c.email) setClientEmail(c.email); }
    };
    // Everyone with an email we could keep in copy: the company's people + every
    // branch's people (deduped). Shown as CC toggles below the primary contact.
    const ccCandidates = useMemo(() => {
        const seen = new Set<string>(); const out: { name?: string; email: string }[] = [];
        const add = (name?: string, email?: string) => { const e = (email || '').trim(); if (e && !seen.has(e.toLowerCase())) { seen.add(e.toLowerCase()); out.push({ name, email: e }); } };
        ((selClient?.contacts || []) as Contact[]).forEach(c => add(c.name, c.email));
        if ((selClient as any)?.contactEmail) add((selClient as any)?.contactPerson, (selClient as any)?.contactEmail);
        (branchList || []).forEach(b => { (b.contacts || []).forEach((c: any) => add(c.name, c.email)); if ((b as any).contactEmail) add((b as any).contactPerson, (b as any).contactEmail); });
        return out;
    }, [selClient, branchList]);
    const toggleCc = (email: string) => setCcEmails(list => list.includes(email) ? list.filter(e => e !== email) : [...list, email]);
    const addCcEmail = () => { const e = addCc.trim(); if (e && !ccEmails.some(x => x.toLowerCase() === e.toLowerCase())) setCcEmails([...ccEmails, e]); setAddCc(''); };
    // Add a NEW person and save it against the client for next time.
    const addPerson = async () => {
        if (!np.name.trim() || !selClient) return;
        const contact: any = { name: np.name.trim().toUpperCase(), email: np.email.trim() || undefined };
        setClientContact(contact.name); if (contact.email) setClientEmail(contact.email);
        setAddingPerson(false); setNp({ name: '', email: '' });
        try {
            if (selBillBranch) {
                // Save the person against the chosen branch, not the whole company.
                const nextBranches = branchList.map(b => b.name === selBillBranch.name ? { ...b, contacts: [...(b.contacts || []), contact] } : b);
                await handleUpdateClient?.(selClient.id, { branches: nextBranches } as any);
                showToast(`Person saved to ${selBillBranch.name}.`);
            } else {
                await handleUpdateClient?.(selClient.id, { contacts: [...clientContacts, contact] } as any);
                showToast('Person saved to this client.');
            }
        } catch { showToast('Selected for this load (could not save).'); }
    };

    // Area dropdowns follow the address typed (override still possible afterwards).
    const onCollPoint = (v: string) => { setCollectionPoint(v); const a = classifyArea(v); if (a) { setCollArea(a); } };
    const onDelPoint = (v: string) => { setDeliveryPoint(v); const a = classifyArea(v); if (a) setDelArea(a); };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !collectionPoint) { showToast('Add the client and collection address.'); return; }
        if (isContainer && !ctrNo.trim()) { showToast('Add the container number.'); return; }
        setBusy(true);
        const containerNote = isContainer
            ? `CONTAINER #${ctrNo.toUpperCase()}${seal ? ` · Seal ${seal.toUpperCase()}` : ''}${ctrSize ? ` · ${ctrSize}` : ''}${operator ? ` · Operator ${operator.toUpperCase()}` : ''}${turnIn ? ` · Empty turn-in: ${turnIn.toUpperCase()}` : ''}`
            : '';
        const data: any = {
            clientId: clientId || '', clientName, clientBranch: billBranch || undefined, collectionBranchSite: collectBranch || undefined, clientEmail: clientEmail || undefined, clientContact: clientContact || undefined,
            ccEmail: ccEmails.filter(e => e && e.toLowerCase() !== (clientEmail || '').toLowerCase()).join(', ') || undefined,
            items: [], legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Collection' }],
            collectionPoint, deliveryPoint: deliveryPoint || collectionPoint,
            collectionDate, commodity: commodity || undefined,
            loadRefNo: loadRefNo ? loadRefNo.toUpperCase() : undefined,
            loadType: isContainer ? (ctrSize ? `CONTAINER ${ctrSize}` : 'CONTAINER') : (composedLoadType || undefined),
            loadSpec: (loadCategory === 'Part Load' ? deckSpace : loadCategory === 'Full Load' ? fullVehicle : bodyType) || undefined,
            packaging: packages ? `${packages}` : undefined,
            weightKg: weightKg || undefined,
            volume: dimensions || undefined,
            specialInstructions: [notes, pkgDims ? `Package dims: ${pkgDims}` : '', containerNote].filter(Boolean).join(' · ') || undefined,
            arrangingBranch: collArea, collectionBranch: collArea, destinationBranch: delArea,
            priority: 'Medium', totalAmount: rate ? Number(rate) : 0, supplierRate: 0,
            isCollection: true, repEmail: currentUser?.email,
            fbnRepresentative: currentUser?.name || currentUser?.email,
        };
        try {
            const res = await onSubmit?.(data);
            if (res && res.ok === false) { showToast(`Could not log collection: ${res.error}`); setBusy(false); return; }
            if (isContainer) {
                void directInsert('containers', {
                    organization_id: FBN_ORGANIZATION_ID, container_no: ctrNo.toUpperCase(), seal_no: seal ? seal.toUpperCase() : null,
                    size: ctrSize || null, client_id: clientId || null, client_name: clientName || null,
                    status: 'Collected', plan: 'full_delivery', branch: collArea, turn_in_area: turnIn ? turnIn.toUpperCase() : null,
                    notes: [operator ? `Operator: ${operator.toUpperCase()}` : '', res?.value?.loadConNumber ? `From collection ${res.value.loadConNumber}` : ''].filter(Boolean).join(' · ') || null,
                }).then(() => window.dispatchEvent(new Event('containers-changed')));
            }
            hideModal();
            showToast('Collection logged — ops notified to assign a driver.');
        } catch (err) { showToast(`Could not log: ${err instanceof Error ? err.message : 'error'}`); setBusy(false); }
    };

    const inp = 'w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 text-base focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <form onSubmit={submit}>
            <h2 className="text-xl font-black text-white mb-1">Log a Collection</h2>
            <p className="text-xs text-gray-400 mb-4">Quick capture — ops will assign a driver &amp; ETA.</p>
            <div className="space-y-3.5">
                <div>
                    <label className={lbl}>Client *</label>
                    <input list="qcClients" value={clientName} onChange={e => onClient(e.target.value)} className={inp} placeholder="start typing the client" required />
                    <datalist id="qcClients">{clientNames.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                {branchList.length > 0 && (
                    <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700 space-y-2">
                        <p className="text-[11px] text-blue-300 font-bold uppercase tracking-wider">{selClient?.name} sites ({branchList.length}) — a transfer can collect from one and bill/deliver to another</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={lbl}>Collect from — site</label>
                                <select value={collectBranch} onChange={e => onCollectBranch(e.target.value)} className={inp}>
                                    <option value="">— select / manual —</option>
                                    {branchList.map((b, i) => <option key={i} value={b.name}>{b.name}{b.address ? ` · ${b.address.split(',')[0]}` : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Deliver to / bill to — site</label>
                                <select value={billBranch} onChange={e => onBillBranch(e.target.value)} className={inp}>
                                    <option value="">— select / manual —</option>
                                    {branchList.map((b, i) => <option key={i} value={b.name}>{b.name}{b.address ? ` · ${b.address.split(',')[0]}` : ''}</option>)}
                                </select>
                            </div>
                        </div>
                        {collectBranch && billBranch && collectBranch !== billBranch && (
                            <p className="text-[11px] text-purple-300">Inter-branch transfer: collect <strong>{collectBranch}</strong> → deliver &amp; bill <strong>{billBranch}</strong>.</p>
                        )}
                    </div>
                )}
                {clientId && (clientContacts.length > 0 || true) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {clientContacts.length > 0 && (
                            <select value={clientContacts.find(c => c.name === clientContact) ? clientContact : ''} onChange={e => pickContact(e.target.value)} className={inp + ' flex-1 min-w-[160px]'}>
                                <option value="">— pick a saved person —</option>
                                {clientContacts.map((c, i) => <option key={i} value={c.name}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>)}
                            </select>
                        )}
                        <button type="button" onClick={() => setAddingPerson(s => !s)} className="text-xs font-bold text-brand-secondary hover:underline">{addingPerson ? '× Cancel' : '+ New person'}</button>
                    </div>
                )}
                {addingPerson && (
                    <div className="grid grid-cols-2 gap-2 bg-gray-900/40 p-2 rounded-lg border border-brand-secondary/40">
                        <input value={np.name} onChange={e => setNp({ ...np, name: e.target.value })} placeholder="Person name *" className={inp} />
                        <input value={np.email} onChange={e => setNp({ ...np, email: e.target.value })} placeholder="Email" type="email" className={inp + ' normal-case'} style={{ textTransform: 'none' }} />
                        <button type="button" onClick={addPerson} disabled={!np.name.trim()} className="col-span-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm">+ Add &amp; save to {selClient?.name || 'client'}</button>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Contact (main — goes on To)</label><input value={clientContact} onChange={e => setClientContact(e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Client email (main — goes on To)</label><input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inp + ' normal-case'} style={{ textTransform: 'none' }} /></div>
                </div>
                {/* Keep-in-copy recipients: main contact goes on To, everyone here is CC'd so
                    the whole group stays together on one email thread (Marc's rule). */}
                <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700 space-y-2">
                    <label className={lbl}>Also keep in copy (CC) — one email, everyone in the loop</label>
                    {ccCandidates.filter(c => c.email.toLowerCase() !== (clientEmail || '').toLowerCase()).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {ccCandidates.filter(c => c.email.toLowerCase() !== (clientEmail || '').toLowerCase()).map((c, i) => {
                                const on = ccEmails.some(e => e.toLowerCase() === c.email.toLowerCase());
                                return <button type="button" key={i} onClick={() => toggleCc(c.email)} title={c.email} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}>{on ? '✓ ' : ''}{c.name || c.email}</button>;
                            })}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input value={addCc} onChange={e => setAddCc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCcEmail(); } }} placeholder="add another email — loading / delivery contact, etc." type="email" className={inp + ' normal-case flex-1'} style={{ textTransform: 'none' }} />
                        <button type="button" onClick={addCcEmail} disabled={!addCc.trim()} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold px-4 rounded-lg text-sm">Add</button>
                    </div>
                    {ccEmails.filter(e => !ccCandidates.some(c => c.email.toLowerCase() === e.toLowerCase())).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {ccEmails.filter(e => !ccCandidates.some(c => c.email.toLowerCase() === e.toLowerCase())).map((e, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full">{e}<button type="button" onClick={() => toggleCc(e)} className="hover:text-rose-200">×</button></span>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <label className={lbl}>FBN DI / Waybill no</label>
                    <input value={loadRefNo} onChange={e => setLoadRefNo(e.target.value)} className={inp} placeholder="manual waybill / DI no (for tracking + invoicing)" />
                </div>
                <div>
                    <label className={lbl}>Collect from *</label>
                    <AddressAutocompleteInput value={collectionPoint} onChange={onCollPoint} placeholder="Search address…" required className={inp} />
                </div>
                <div>
                    <label className={lbl}>Deliver to</label>
                    <AddressAutocompleteInput value={deliveryPoint} onChange={onDelPoint} placeholder="Search address…" className={inp} />
                </div>
                <div><label className={lbl}>Commodity</label><input list="qcComm" value={commodity} onChange={e => setCommodity(e.target.value)} className={inp} placeholder="e.g. flour" /><datalist id="qcComm">{commodities.map(c => <option key={c} value={c} />)}</datalist></div>

                {/* Load type — Consol / Part load / Full load, each with its own fields. */}
                {!isContainer && (
                    <div>
                        <label className={lbl}>Load type</label>
                        <div className="flex gap-1.5 mb-2">
                            {LOAD_CATEGORIES.map(c => (
                                <button key={c} type="button" onClick={() => setLoadCategory(loadCategory === c ? '' : c)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold border ${loadCategory === c ? 'bg-brand-secondary text-white border-brand-secondary' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}>{c}</button>
                            ))}
                        </div>
                        {loadCategory && (
                            <div className="grid grid-cols-2 gap-3 bg-gray-900/40 p-3 rounded-lg border border-gray-700">
                                {loadCategory === 'Consol' && (
                                    <>
                                        <div><label className={lbl}>No. of packages</label><input value={packages} onChange={e => setPackages(e.target.value)} className={inp} placeholder="e.g. 12" /></div>
                                        <div><label className={lbl}>Weight (kg)</label><input value={weightKg} onChange={e => setWeightKg(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="total kg" /></div>
                                        <div><label className={lbl}>Total cubes (m³)</label><input value={dimensions} onChange={e => setDimensions(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="e.g. 4.5" /></div>
                                        <div className="col-span-2"><label className={lbl}>Dimensions per package (if they differ)</label><textarea value={pkgDims} onChange={e => setPkgDims(e.target.value)} rows={2} className={inp} placeholder="e.g. 2× 1.2×1.0×1.5m · 1× 0.8×0.6×0.9m" style={{ textTransform: 'none' }} /></div>
                                    </>
                                )}
                                {loadCategory === 'Part Load' && (
                                    <>
                                        <div><label className={lbl}>Deck space</label><select value={deckSpace} onChange={e => setDeckSpace(e.target.value)} className={inp}><option value="">— select —</option>{DECK_SPACES.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                                        <div><label className={lbl}>Weight (kg)</label><input value={weightKg} onChange={e => setWeightKg(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="total kg" /></div>
                                    </>
                                )}
                                {loadCategory === 'Full Load' && (
                                    <>
                                        <div><label className={lbl}>Vehicle size</label><select value={fullVehicle} onChange={e => setFullVehicle(e.target.value)} className={inp}><option value="">— select —</option>{FULL_VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                                        <div><label className={lbl}>Weight (kg)</label><input value={weightKg} onChange={e => setWeightKg(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="total kg" /></div>
                                    </>
                                )}
                                <div className="col-span-2"><label className={lbl}>Vehicle type</label>
                                    <div className="flex gap-1.5">
                                        {BODY_TYPES.map(b => (
                                            <button key={b} type="button" onClick={() => setBodyType(bodyType === b ? '' : b)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${bodyType === b ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}>{b}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Collection area (ops)</label><select value={collArea} onChange={e => { setCollArea(e.target.value as Branch); setDelArea(e.target.value as Branch); }} className={inp}>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
                    <div><label className={lbl}>Delivery area</label><select value={delArea} onChange={e => setDelArea(e.target.value as Branch)} className={inp}>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
                </div>
                {collArea !== delArea && <p className="text-[11px] text-purple-300">Inter-branch: {collArea} → {delArea} (handed over at the depot).</p>}
                <div><label className={lbl}>Loading date</label><DateField value={collectionDate} onChange={setCollectionDate} className={inp} /></div>
                {/* Rate — optional, expandable */}
                <div>
                    <button type="button" onClick={() => setShowDetails(s => !s)} className="text-xs font-bold text-brand-secondary hover:underline">{showDetails ? '− Hide rate' : '+ Add client rate (optional)'}</button>
                    {showDetails && (
                        <div className="mt-2 bg-gray-900/40 p-3 rounded-lg border border-gray-700">
                            <label className={lbl}>Rate (R, client)</label><input value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="optional" />
                        </div>
                    )}
                </div>
                <div className="border-t border-gray-700 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-200">
                        <input type="checkbox" checked={isContainer} onChange={e => setIsContainer(e.target.checked)} /> Container collection
                    </label>
                    {isContainer && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div><label className={lbl}>Container #</label><input value={ctrNo} onChange={e => setCtrNo(e.target.value)} className={inp} placeholder="ABCU1234567" /></div>
                            <div><label className={lbl}>Seal #</label><input value={seal} onChange={e => setSeal(e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Size</label><input list="qcCtrSizes" value={ctrSize} onChange={e => setCtrSize(e.target.value)} className={inp} placeholder="40HC" /><datalist id="qcCtrSizes">{CONTAINER_SIZES.map(s => <option key={s} value={s} />)}</datalist></div>
                            <div><label className={lbl}>Operator</label><input value={operator} onChange={e => setOperator(e.target.value)} className={inp} placeholder="shipping line / depot" /></div>
                            <div className="col-span-2"><label className={lbl}>Empty turn-in address</label><input value={turnIn} onChange={e => setTurnIn(e.target.value)} className={inp} placeholder="where the empty goes back" /></div>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={busy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Sending…' : 'Send to Ops'}</button>
            </div>
        </form>
    );
};

export default QuickCollectionForm;
