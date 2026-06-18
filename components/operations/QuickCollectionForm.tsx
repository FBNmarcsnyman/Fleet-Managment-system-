import React, { useMemo, useState } from 'react';
import { Client, Contact, Branch } from '../../types';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import DateField from './DateField';

// Areas where FBN ops can action a collection. Value = Branch code stored on the load.
const AREAS: { code: Branch; label: string }[] = [
    { code: 'FBN JHB', label: 'Johannesburg' },
    { code: 'FBN DBN', label: 'Durban' },
    { code: 'FBN CPT', label: 'Cape Town' },
];

// Fast, mobile-first "log a collection" form. A collection IS a load — on send it
// creates the load (flagged is_collection), emails ops in that area to assign a
// driver + ETA, and acknowledges the client. Then it rides the normal LoadCon rails.
const QuickCollectionForm: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { clients = [], loadConfirmations = [] } = useOperations() as any;
    const onSubmit = modal.payload?.onSubmit as (data: any) => Promise<any>;

    const today = new Date().toISOString().split('T')[0];
    const [clientName, setClientName] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [collectionPoint, setCollectionPoint] = useState('');
    const [deliveryPoint, setDeliveryPoint] = useState('');
    const [commodity, setCommodity] = useState('');
    const [packages, setPackages] = useState('');
    const [collectionDate, setCollectionDate] = useState(today);
    const [collArea, setCollArea] = useState<Branch>('FBN JHB');
    const [delArea, setDelArea] = useState<Branch>('FBN JHB');
    const [notes, setNotes] = useState('');
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
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !collectionPoint) { showToast('Add the client and collection address.'); return; }
        setBusy(true);
        const data: any = {
            clientId: clientId || '', clientName, clientEmail: clientEmail || undefined, clientContact: clientContact || undefined,
            items: [], legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Collection' }],
            collectionPoint, deliveryPoint: deliveryPoint || collectionPoint,
            collectionDate, commodity: commodity || undefined,
            packaging: packages ? `${packages}` : undefined,
            specialInstructions: notes || undefined,
            arrangingBranch: collArea, collectionBranch: collArea, destinationBranch: delArea,
            priority: 'Medium', totalAmount: 0, supplierRate: 0,
            isCollection: true,
        };
        try {
            const res = await onSubmit?.(data);
            if (res && res.ok === false) { showToast(`Could not log collection: ${res.error}`); setBusy(false); return; }
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
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Contact</label><input value={clientContact} onChange={e => setClientContact(e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Client email</label><input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inp} /></div>
                </div>
                <div>
                    <label className={lbl}>Collect from *</label>
                    <AddressAutocompleteInput value={collectionPoint} onChange={setCollectionPoint} placeholder="Search address…" required className={inp} />
                </div>
                <div>
                    <label className={lbl}>Deliver to</label>
                    <AddressAutocompleteInput value={deliveryPoint} onChange={setDeliveryPoint} placeholder="Search address…" className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Commodity</label><input list="qcComm" value={commodity} onChange={e => setCommodity(e.target.value)} className={inp} placeholder="e.g. flour" /><datalist id="qcComm">{commodities.map(c => <option key={c} value={c} />)}</datalist></div>
                    <div><label className={lbl}>Packages</label><input value={packages} onChange={e => setPackages(e.target.value)} className={inp} placeholder="e.g. 3 cases" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Collection area (ops)</label><select value={collArea} onChange={e => { setCollArea(e.target.value as Branch); setDelArea(e.target.value as Branch); }} className={inp}>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
                    <div><label className={lbl}>Delivery area</label><select value={delArea} onChange={e => setDelArea(e.target.value as Branch)} className={inp}>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
                </div>
                {collArea !== delArea && <p className="text-[11px] text-purple-300">Inter-branch: {collArea} → {delArea} (handed over at the depot).</p>}
                <div><label className={lbl}>Loading date</label><DateField value={collectionDate} onChange={setCollectionDate} className={inp} /></div>
                <div><label className={lbl}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp} placeholder="anything ops should know" /></div>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={busy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Sending…' : 'Send to Ops'}</button>
            </div>
        </form>
    );
};

export default QuickCollectionForm;
