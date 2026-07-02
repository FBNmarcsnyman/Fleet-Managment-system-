import React, { useMemo, useState } from 'react';
import { Client, Contact, Supplier, Branch } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import { directInsert } from '../../lib/supabase';
import { FBN_ORGANIZATION_ID } from '../../lib/mappers';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import DateField from './DateField';
import { usePickOptions, addPickOption } from '../../hooks/usePickOptions';

const VEHICLE_SIZES = ['2 TON', '5 TON', '8 TON', '12 TON', '15 TON', 'TRI-AXLE (28T)', 'SUPERLINK (34T)', 'LINK', 'TAUTLINER', 'FLAT DECK', 'FLAT DECK + UPRIGHTS', '6M FLAT DECK', '12M FLAT DECK', 'TRI-AXLE FLAT', 'LDV', 'TANKER', 'REEFER', 'ABNORMAL'];
const FBN_BRANCHES: { code: Branch; label: string }[] = [
    { code: 'FBN CPT', label: 'Cape Town' }, { code: 'FBN JHB', label: 'Johannesburg' }, { code: 'FBN DBN', label: 'Durban' },
];
const CONTAINER_SIZES = ['20FT', '40FT', '40HC', '45FT', 'REEFER 20FT', 'REEFER 40FT', 'FLAT RACK', 'OPEN TOP'];

// Quick BROKING collection — the mirror of the ops Quick Collection, but the job
// is brokered to a transporter. On send it creates a (partial) Load Confirmation
// that auto-emails the LoadCon to the transporter (accept link) AND the order to
// the client. Full details get added later by FBN, or by the transporter/client
// from their own links. It rides the normal LoadCon rails from there.
const BrokingCollectionForm: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { clients = [], suppliers = [], loadConfirmations = [] } = useOperations() as any;
    const { currentUser } = useAuth();
    const onSubmit = modal.payload?.onSubmit as (data: any) => Promise<any>;

    const today = new Date().toISOString().split('T')[0];
    const [clientName, setClientName] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [clientPhone, setClientPhone] = useState(''); // client cell — esp. one-off/COD clients
    const [clientCc, setClientCc] = useState('');
    // Selectable keep-in-copy recipients (client people) + one-off/COD flag — mirrors
    // the ops Quick Collection so the whole client group stays on one email thread.
    const [ccEmails, setCcEmails] = useState<string[]>([]);
    const [addCc, setAddCc] = useState('');
    const [oneOffCod, setOneOffCod] = useState(false);
    const [loadRefNo, setLoadRefNo] = useState('');
    const [collectionPoint, setCollectionPoint] = useState('');
    const [deliveryPoint, setDeliveryPoint] = useState('');
    const [packages, setPackages] = useState('');       // no. of packages
    const [pkgType, setPkgType] = useState('');         // packaging type — pallets / cases / bags (managed)
    const [pkgBreakdown, setPkgBreakdown] = useState(''); // e.g. "120 bags on 12 pallets"
    const [hazardous, setHazardous] = useState(false);  // dangerous goods flag
    const [deckSpace, setDeckSpace] = useState('');
    const [vehicleSize, setVehicleSize] = useState('');
    const [commodity, setCommodity] = useState('');
    const [dimensions, setDimensions] = useState('');
    const [remarks, setRemarks] = useState('');
    const [weight, setWeight] = useState('');
    const [collectionDate, setCollectionDate] = useState(today);
    const [deliveryDate, setDeliveryDate] = useState(''); // required delivery date
    // transporter
    const [supName, setSupName] = useState('');
    const [supId, setSupId] = useState('');
    const [supEmail, setSupEmail] = useState('');
    const [supContact, setSupContact] = useState('');
    const [supCell, setSupCell] = useState('');         // transporter contact cell (when adding a new one)
    const [supCc, setSupCc] = useState('');
    const [rate, setRate] = useState('');
    const [clientRate, setClientRate] = useState('');
    // Route via a TRANSIT depot: subbie collects → drops at an FBN depot → FBN
    // plans the onward leg to the final delivery. (e.g. CPT → FBN JHB → DBN.)
    const [transitVia, setTransitVia] = useState(false);
    const [transitDepot, setTransitDepot] = useState<Branch>('FBN JHB');
    const [collBranch, setCollBranch] = useState<Branch>('FBN CPT');
    const [delBranch, setDelBranch] = useState<Branch>('FBN DBN');
    // Container collection (FCL): capture the box details + empty turn-in.
    const [isContainer, setIsContainer] = useState(false);
    const [ctrNo, setCtrNo] = useState('');
    const [seal, setSeal] = useState('');
    const [ctrSize, setCtrSize] = useState('');
    const [turnIn, setTurnIn] = useState('');
    const [operator, setOperator] = useState('');
    const [busy, setBusy] = useState(false);

    const clientNames = useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);
    const supplierNames = useMemo(() => [...new Set((suppliers as any[]).map(s => s.name).filter(Boolean))].sort(), [suppliers]);
    const commodities = usePickOptions('commodity'); // managed, learn-as-you-go list
    const packagingTypes = usePickOptions('packaging');
    const selClient = useMemo(() => (clients as any[]).find(c => c.id === clientId), [clients, clientId]);
    // This client's people (company + every branch), for the contact dropdown + CC picker.
    const clientContacts: Contact[] = useMemo(() => {
        const seen = new Set<string>(); const out: Contact[] = [];
        const add = (c: any) => { const key = `${c?.name || ''}|${c?.email || ''}`.toLowerCase(); if ((c?.name || c?.email) && !seen.has(key)) { seen.add(key); out.push(c); } };
        (selClient?.contacts || []).forEach(add);
        if (selClient?.contactEmail || selClient?.contactPerson) add({ name: selClient?.contactPerson, email: selClient?.contactEmail });
        (selClient?.branches || []).forEach((b: any) => { (b.contacts || []).forEach(add); if (b.contactEmail || b.contactPerson) add({ name: b.contactPerson, email: b.contactEmail }); });
        return out;
    }, [selClient]);
    const ccCandidates = useMemo(() => clientContacts.filter(c => c.email && c.email.toLowerCase() !== (clientEmail || '').toLowerCase()), [clientContacts, clientEmail]);
    const pickContact = (name: string) => { const c = clientContacts.find(x => x.name === name); if (c) { setClientContact(c.name || ''); if (c.email) setClientEmail(c.email); } };
    const toggleCc = (email: string) => setCcEmails(list => list.includes(email) ? list.filter(e => e !== email) : [...list, email]);
    const addCcEmail = () => { const e = addCc.trim(); if (e && !ccEmails.some(x => x.toLowerCase() === e.toLowerCase())) setCcEmails([...ccEmails, e]); setAddCc(''); };

    const onClient = (name: string) => {
        setClientName(name);
        const c = (clients as any[]).find(x => (x.name || '').toLowerCase() === name.toLowerCase()) as Client | undefined;
        if (c) {
            setClientId(c.id);
            const cs: Contact[] = (c as any).contacts || [];
            setClientEmail(cs[0]?.email || (c as any).contactEmail || '');
            setClientContact(cs[0]?.name || c.contactPerson || '');
            setClientCc(cs.slice(1).map(x => x.email).filter(Boolean).join(', '));
        } else setClientId('');
    };
    const onSup = (name: string) => {
        setSupName(name);
        const s = (suppliers as any[]).find(x => (x.name || '').toLowerCase() === name.toLowerCase()) as Supplier | undefined;
        if (s) {
            setSupId(s.id);
            const cs: Contact[] = (s as any).contacts || [];
            const docs = cs.filter(x => (x as any).getsDocs !== false);
            setSupEmail(docs[0]?.email || cs[0]?.email || (s as any).contactEmail || (s as any).email || '');
            setSupContact(docs[0]?.name || cs[0]?.name || (s as any).contactPerson || '');
            setSupCell((docs[0] as any)?.phone || (cs[0] as any)?.phone || (s as any).contactPhone || '');
            setSupCc((docs.length ? docs : cs).slice(1).map(x => x.email).filter(Boolean).join(', '));
            // Pull the rate from this transporter's last load.
            const past = (loadConfirmations as any[]).filter(l => (l.subcontractorName || '').toLowerCase() === name.toLowerCase() && l.supplierRate).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            if (past[0]?.supplierRate && !rate) setRate(String(past[0].supplierRate));
        } else setSupId('');
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !collectionPoint) { showToast('Add the client and collection address.'); return; }
        if (isContainer && !ctrNo.trim()) { showToast('Add the container number.'); return; }
        setBusy(true);
        // Learn a newly-typed commodity + packaging type so they're offered next time.
        if (commodity.trim() && !commodities.some(c => c.toUpperCase() === commodity.trim().toUpperCase())) void addPickOption('commodity', commodity);
        if (pkgType.trim() && !packagingTypes.some(c => c.toUpperCase() === pkgType.trim().toUpperCase())) void addPickOption('packaging', pkgType);
        const containerNote = isContainer
            ? `CONTAINER #${ctrNo.toUpperCase()}${seal ? ` · Seal ${seal.toUpperCase()}` : ''}${ctrSize ? ` · ${ctrSize}` : ''}${operator ? ` · Operator ${operator.toUpperCase()}` : ''}${turnIn ? ` · Empty turn-in: ${turnIn.toUpperCase()}` : ''}`
            : '';
        const data: any = {
            clientId: clientId || '', clientName, clientEmail: clientEmail || undefined, clientContact: clientContact || undefined,
            clientPhone: clientPhone.trim() || undefined,
            clientCc: (ccEmails.length ? ccEmails.filter(e => e && e.toLowerCase() !== (clientEmail || '').toLowerCase()).join(', ') : clientCc) || undefined,
            // One-off / COD: don't add to the client directory, hold the cargo as COD.
            skipClientDirectory: oneOffCod || undefined, codHold: oneOffCod || undefined,
            items: [], legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Delivery' }],
            collectionPoint, deliveryPoint: deliveryPoint || collectionPoint, collectionDate,
            deliveryDate: deliveryDate || undefined,
            loadRefNo: loadRefNo ? loadRefNo.toUpperCase() : undefined,
            // Transit-depot routing: cross-branch so the depot flow fires, and the
            // subbie's leg-1 LoadCon delivers to the transit depot (not the final).
            ...(transitVia ? { transitDepot, collectionBranch: collBranch, destinationBranch: delBranch, arrangingBranch: collBranch } : {}),
            loadType: isContainer ? (ctrSize ? `CONTAINER ${ctrSize}` : 'CONTAINER') : (vehicleSize || undefined),
            commodity: commodity || undefined,
            specialInstructions: [remarks, pkgBreakdown.trim() ? `Packages: ${pkgBreakdown.trim()}` : '', hazardous ? 'HAZARDOUS / DANGEROUS GOODS' : '', dimensions ? `Total cubes: ${dimensions} m³` : '', containerNote].filter(Boolean).join(' · ') || undefined,
            packaging: pkgType.trim() || undefined,           // packaging TYPE (pallets/cases/bags)
            quantity: packages.trim() || undefined,            // no. of packages
            hazardous: hazardous || undefined,
            loadedPackages: packages ? Number(String(packages).replace(/[^\d]/g, '')) || undefined : undefined,
            weightKg: weight || undefined, volume: deckSpace || undefined,
            // transporter (brokered) — triggers LoadCon-to-supplier + Order-to-client.
            supplierId: supId || undefined, subcontractorName: supName || undefined,
            subcontractorEmail: supEmail || undefined, forAttention: supContact || undefined, ccEmail: supCc || undefined,
            subcontractorDriverCell: supCell.trim() || undefined,
            supplierRate: rate ? Number(rate) : 0,
            status: supId || supName ? 'Driver Assigned' : 'Booked',
            priority: 'Medium', totalAmount: clientRate ? Number(clientRate) : 0, isCollection: false,
            repEmail: currentUser?.email,
            // Capture WHO logged it + their branch (shows as FBN REP / FBN BRANCH).
            fbnRepresentative: currentUser?.name || currentUser?.email,
            arrangingBranch: (currentUser?.assignedBranches || []).find((b: string) => ['FBN DBN', 'FBN JHB', 'FBN CPT'].includes(b)) || undefined,
        };
        try {
            const res = await onSubmit?.(data);
            if (res && res.ok === false) { showToast(`Could not log: ${res.error}`); setBusy(false); return; }
            // Container collection → also log it on the Containers board for monitoring.
            if (isContainer) {
                void directInsert('containers', {
                    organization_id: FBN_ORGANIZATION_ID, container_no: ctrNo.toUpperCase(), seal_no: seal ? seal.toUpperCase() : null,
                    size: ctrSize || null, client_id: clientId || null, client_name: clientName || null,
                    status: 'Collected', plan: 'full_delivery', turn_in_area: turnIn ? turnIn.toUpperCase() : null,
                    notes: [operator ? `Operator: ${operator.toUpperCase()}` : '', res?.value?.loadConNumber ? `From collection ${res.value.loadConNumber}` : ''].filter(Boolean).join(' · ') || null,
                }).then(() => window.dispatchEvent(new Event('containers-changed')));
            }
            hideModal();
            showToast(supName ? 'Broking collection logged — LoadCon sent to transporter, order sent to client.' : 'Broking collection logged — assign a transporter to send the LoadCon.');
        } catch (err) { showToast(`Could not log: ${err instanceof Error ? err.message : 'error'}`); setBusy(false); }
    };

    const inp = 'w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 text-base focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <form onSubmit={submit}>
            <h2 className="text-xl font-black text-white mb-1">Broking Collection</h2>
            <p className="text-xs text-gray-400 mb-4">Quick capture + assign a transporter. Sends the LoadCon &amp; client order; add full details later.</p>
            <div className="space-y-3.5">
                <div>
                    <label className={lbl}>Client *</label>
                    <input list="bkClients" value={clientName} onChange={e => onClient(e.target.value)} className={inp} placeholder="start typing the client" required />
                    <datalist id="bkClients">{clientNames.map(n => <option key={n} value={n} />)}</datalist>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-300 mt-2">
                        <input type="checkbox" checked={oneOffCod} onChange={e => setOneOffCod(e.target.checked)} />
                        One-off / COD customer — don't save to Clients (hold cargo as COD until paid)
                    </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={lbl}>Contact (main — goes on To)</label>
                        {clientContacts.length > 0 ? (
                            <select value={clientContacts.some(c => c.name === clientContact) ? clientContact : '__manual__'} onChange={e => { if (e.target.value === '__manual__') setClientContact(''); else pickContact(e.target.value); }} className={inp}>
                                {clientContacts.map((c, i) => <option key={i} value={c.name}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>)}
                                <option value="__manual__">＋ type a new name…</option>
                            </select>
                        ) : (
                            <input value={clientContact} onChange={e => setClientContact(e.target.value)} className={inp} />
                        )}
                        {clientContacts.length > 0 && !clientContacts.some(c => c.name === clientContact) && (
                            <input value={clientContact} onChange={e => setClientContact(e.target.value)} placeholder="contact name" className={inp + ' mt-1.5'} />
                        )}
                    </div>
                    <div><label className={lbl}>Client email (main — goes on To)</label><input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inp + ' normal-case'} style={{ textTransform: 'none' }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {/* Client cell — captured even for one-off / COD clients not saved to the directory. */}
                    <div><label className={lbl}>Client cell / phone</label><input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={inp + ' normal-case'} style={{ textTransform: 'none' }} placeholder="e.g. 082 123 4567" /></div>
                    {/* Client rate lives UP HERE by the client — never mixed up with the transporter cost below. */}
                    <div><label className={lbl}>Client rate (R) <span className="text-emerald-300 normal-case font-normal">— what WE bill the client</span></label><input value={clientRate} onChange={e => setClientRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="e.g. 11000" /></div>
                </div>
                {/* Keep-in-copy recipients — one email, everyone (loader/receiver/etc.) in the loop. */}
                <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700 space-y-2">
                    <label className={lbl}>Also keep in copy (CC) — one email, everyone in the loop</label>
                    {ccCandidates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {ccCandidates.map((c, i) => {
                                const on = ccEmails.some(e => e.toLowerCase() === (c.email || '').toLowerCase());
                                return <button type="button" key={i} onClick={() => toggleCc(c.email!)} title={c.email} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}>{on ? '✓ ' : ''}{c.name || c.email}</button>;
                            })}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input value={addCc} onChange={e => setAddCc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCcEmail(); } }} placeholder="add another email — loading / delivery contact, etc." type="email" className={inp + ' normal-case flex-1'} style={{ textTransform: 'none' }} />
                        <button type="button" onClick={addCcEmail} disabled={!addCc.trim()} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold px-4 rounded-lg text-sm">Add</button>
                    </div>
                    {ccEmails.filter(e => !ccCandidates.some(c => (c.email || '').toLowerCase() === e.toLowerCase())).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {ccEmails.filter(e => !ccCandidates.some(c => (c.email || '').toLowerCase() === e.toLowerCase())).map((e, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-full">{e}<button type="button" onClick={() => toggleCc(e)} className="hover:text-rose-200">×</button></span>
                            ))}
                        </div>
                    )}
                </div>
                <div><label className={lbl}>FBN DI / Waybill no</label><input value={loadRefNo} onChange={e => setLoadRefNo(e.target.value)} className={inp} placeholder="manual waybill / DI no (for tracking + invoicing)" /></div>
                <div><label className={lbl}>Collect from *</label><AddressAutocompleteInput value={collectionPoint} onChange={setCollectionPoint} placeholder="Search address…" required className={inp} /></div>
                <div><label className={lbl}>Deliver to {transitVia ? '(FINAL destination)' : ''}</label><AddressAutocompleteInput value={deliveryPoint} onChange={setDeliveryPoint} placeholder="Search address…" className={inp} /></div>

                <div className="border-t border-gray-700 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-200">
                        <input type="checkbox" checked={transitVia} onChange={e => setTransitVia(e.target.checked)} /> Route via a transit depot (cross-dock)
                    </label>
                    {transitVia && (
                        <div className="mt-3 space-y-3">
                            <p className="text-[11px] text-purple-300">Subbie collects &amp; drops at the transit depot; FBN then plans the onward leg to the final delivery.</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={lbl}>Collecting area</label><select value={collBranch} onChange={e => setCollBranch(e.target.value as Branch)} className={inp}>{FBN_BRANCHES.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}</select></div>
                                <div><label className={lbl}>Transit depot</label><select value={transitDepot} onChange={e => setTransitDepot(e.target.value as Branch)} className={inp}>{FBN_BRANCHES.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}</select></div>
                                <div><label className={lbl}>Final delivery area</label><select value={delBranch} onChange={e => setDelBranch(e.target.value as Branch)} className={inp}>{FBN_BRANCHES.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}</select></div>
                            </div>
                            <p className="text-[11px] text-gray-400">Leg 1 (subbie): <strong className="text-gray-200">{collBranch.replace('FBN ', '')} → {transitDepot}</strong> · Leg 2 (FBN plans): <strong className="text-gray-200">{transitDepot} → {delBranch.replace('FBN ', '')}</strong></p>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Commodity</label><input list="bkComm" value={commodity} onChange={e => setCommodity(e.target.value)} className={inp} placeholder="e.g. steel" /><datalist id="bkComm">{commodities.map(c => <option key={c} value={c} />)}</datalist></div>
                    <div><label className={lbl}>Packaging type</label><input list="bkPkg" value={pkgType} onChange={e => setPkgType(e.target.value)} className={inp} placeholder="pallets / cases / bags" /><datalist id="bkPkg">{packagingTypes.map(p => <option key={p} value={p} />)}</datalist></div>
                    <div><label className={lbl}>No. of packages</label><input value={packages} onChange={e => setPackages(e.target.value)} className={inp} placeholder="e.g. 12" /></div>
                    <div><label className={lbl}>Deck space</label><input value={deckSpace} onChange={e => setDeckSpace(e.target.value)} className={inp} placeholder="e.g. 6 m" /></div>
                    <div className="col-span-2"><label className={lbl}>Package breakdown (if pallets carry loose items)</label><input value={pkgBreakdown} onChange={e => setPkgBreakdown(e.target.value)} className={inp} placeholder="e.g. 120 bags on 12 pallets" style={{ textTransform: 'none' }} /></div>
                    <label className="col-span-2 flex items-center gap-2 cursor-pointer text-sm font-bold text-amber-300">
                        <input type="checkbox" checked={hazardous} onChange={e => setHazardous(e.target.checked)} /> ⚠ Hazardous / dangerous goods
                    </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Vehicle size</label><input list="bkSizes" value={vehicleSize} onChange={e => setVehicleSize(e.target.value)} className={inp} placeholder="e.g. Superlink" /><datalist id="bkSizes">{VEHICLE_SIZES.map(s => <option key={s} value={s} />)}</datalist></div>
                    <div><label className={lbl}>Weight (kg)</label><input value={weight} onChange={e => setWeight(e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Total cubes (m³)</label><input value={dimensions} onChange={e => setDimensions(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="e.g. 12.5" /></div>
                    <div className="col-span-2"><label className={lbl}>Remarks / notes</label><textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className={inp} placeholder="anything ops/the subbie should know" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Loading date</label><DateField value={collectionDate} onChange={setCollectionDate} className={inp} /></div>
                    <div><label className={lbl}>Required delivery date</label><DateField value={deliveryDate} onChange={setDeliveryDate} className={inp} /></div>
                </div>
                <div className="border-t border-gray-700 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-200">
                        <input type="checkbox" checked={isContainer} onChange={e => setIsContainer(e.target.checked)} /> Container collection
                    </label>
                    {isContainer && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div><label className={lbl}>Container #</label><input value={ctrNo} onChange={e => setCtrNo(e.target.value)} className={inp} placeholder="ABCU1234567" /></div>
                            <div><label className={lbl}>Seal #</label><input value={seal} onChange={e => setSeal(e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Size</label><input list="brkCtrSizes" value={ctrSize} onChange={e => setCtrSize(e.target.value)} className={inp} placeholder="40HC" /><datalist id="brkCtrSizes">{CONTAINER_SIZES.map(s => <option key={s} value={s} />)}</datalist></div>
                            <div><label className={lbl}>Operator</label><input value={operator} onChange={e => setOperator(e.target.value)} className={inp} placeholder="e.g. shipping line / depot" /></div>
                            <div className="col-span-2"><label className={lbl}>Empty turn-in address</label><input value={turnIn} onChange={e => setTurnIn(e.target.value)} className={inp} placeholder="where the empty goes back" /></div>
                        </div>
                    )}
                </div>
                <div className="border-t border-gray-700 pt-3">
                    <label className={lbl}>Assign transporter</label>
                    <input list="bkSups" value={supName} onChange={e => onSup(e.target.value)} className={inp} placeholder="transporter / subcontractor" />
                    <datalist id="bkSups">{supplierNames.map(n => <option key={n} value={n} />)}</datalist>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div><label className={lbl}>Transporter email</label><input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} className={inp + ' normal-case'} style={{ textTransform: 'none' }} /></div>
                        <div><label className={lbl}>Transporter cell</label><input type="tel" value={supCell} onChange={e => setSupCell(e.target.value)} className={inp + ' normal-case'} style={{ textTransform: 'none' }} placeholder="e.g. 082 123 4567" /></div>
                        <div className="col-span-2"><label className={lbl}>Transport rate (R) <span className="text-gray-500 normal-case font-normal">— what WE pay the transporter</span></label><input value={rate} onChange={e => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inp} placeholder="e.g. 8500" /></div>
                    </div>
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={busy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Sending…' : 'Log & Send'}</button>
            </div>
        </form>
    );
};

export default BrokingCollectionForm;
