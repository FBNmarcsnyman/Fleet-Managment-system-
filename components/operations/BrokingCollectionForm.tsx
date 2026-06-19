import React, { useMemo, useState } from 'react';
import { Client, Contact, Supplier } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import DateField from './DateField';

const VEHICLE_SIZES = ['1 TON', '1.5 TON', '4 TON', '8 TON', 'LDV', 'FLATBED', 'TAUTLINER', 'TRI-AXLE', 'SUPERLINK', 'LINK', 'TANKER', 'REEFER'];

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
    const [clientCc, setClientCc] = useState('');
    const [collectionPoint, setCollectionPoint] = useState('');
    const [deliveryPoint, setDeliveryPoint] = useState('');
    const [packages, setPackages] = useState('');
    const [deckSpace, setDeckSpace] = useState('');
    const [vehicleSize, setVehicleSize] = useState('');
    const [weight, setWeight] = useState('');
    const [collectionDate, setCollectionDate] = useState(today);
    // transporter
    const [supName, setSupName] = useState('');
    const [supId, setSupId] = useState('');
    const [supEmail, setSupEmail] = useState('');
    const [supContact, setSupContact] = useState('');
    const [supCc, setSupCc] = useState('');
    const [rate, setRate] = useState('');
    const [busy, setBusy] = useState(false);

    const clientNames = useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);
    const supplierNames = useMemo(() => [...new Set((suppliers as any[]).map(s => s.name).filter(Boolean))].sort(), [suppliers]);

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
            setSupCc((docs.length ? docs : cs).slice(1).map(x => x.email).filter(Boolean).join(', '));
            // Pull the rate from this transporter's last load.
            const past = (loadConfirmations as any[]).filter(l => (l.subcontractorName || '').toLowerCase() === name.toLowerCase() && l.supplierRate).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            if (past[0]?.supplierRate && !rate) setRate(String(past[0].supplierRate));
        } else setSupId('');
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !collectionPoint) { showToast('Add the client and collection address.'); return; }
        setBusy(true);
        const data: any = {
            clientId: clientId || '', clientName, clientEmail: clientEmail || undefined, clientContact: clientContact || undefined, clientCc: clientCc || undefined,
            items: [], legs: [{ id: 'leg-1', collectionPoint, deliveryPoint, movementType: 'Delivery' }],
            collectionPoint, deliveryPoint: deliveryPoint || collectionPoint, collectionDate,
            loadType: vehicleSize || undefined,
            packaging: packages ? `${packages}` : undefined,
            loadedPackages: packages ? Number(String(packages).replace(/[^\d]/g, '')) || undefined : undefined,
            weightKg: weight || undefined, volume: deckSpace || undefined,
            // transporter (brokered) — triggers LoadCon-to-supplier + Order-to-client.
            supplierId: supId || undefined, subcontractorName: supName || undefined,
            subcontractorEmail: supEmail || undefined, forAttention: supContact || undefined, ccEmail: supCc || undefined,
            supplierRate: rate ? Number(rate) : 0,
            status: supId || supName ? 'Driver Assigned' : 'Booked',
            priority: 'Medium', totalAmount: 0, isCollection: false, repEmail: currentUser?.email,
        };
        try {
            const res = await onSubmit?.(data);
            if (res && res.ok === false) { showToast(`Could not log: ${res.error}`); setBusy(false); return; }
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Contact</label><input value={clientContact} onChange={e => setClientContact(e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Client email</label><input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inp} /></div>
                </div>
                <div><label className={lbl}>Collect from *</label><AddressAutocompleteInput value={collectionPoint} onChange={setCollectionPoint} placeholder="Search address…" required className={inp} /></div>
                <div><label className={lbl}>Deliver to</label><AddressAutocompleteInput value={deliveryPoint} onChange={setDeliveryPoint} placeholder="Search address…" className={inp} /></div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Packages</label><input value={packages} onChange={e => setPackages(e.target.value)} className={inp} placeholder="e.g. 12" /></div>
                    <div><label className={lbl}>Deck space</label><input value={deckSpace} onChange={e => setDeckSpace(e.target.value)} className={inp} placeholder="e.g. 6 m" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Vehicle size</label><input list="bkSizes" value={vehicleSize} onChange={e => setVehicleSize(e.target.value)} className={inp} placeholder="e.g. Superlink" /><datalist id="bkSizes">{VEHICLE_SIZES.map(s => <option key={s} value={s} />)}</datalist></div>
                    <div><label className={lbl}>Weight (kg)</label><input value={weight} onChange={e => setWeight(e.target.value)} className={inp} /></div>
                </div>
                <div><label className={lbl}>Loading date</label><DateField value={collectionDate} onChange={setCollectionDate} className={inp} /></div>
                <div className="border-t border-gray-700 pt-3">
                    <label className={lbl}>Assign transporter</label>
                    <input list="bkSups" value={supName} onChange={e => onSup(e.target.value)} className={inp} placeholder="transporter / subcontractor" />
                    <datalist id="bkSups">{supplierNames.map(n => <option key={n} value={n} />)}</datalist>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div><label className={lbl}>Transporter email</label><input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Transport rate (R)</label><input value={rate} onChange={e => setRate(e.target.value)} className={inp} placeholder="e.g. 8500" /></div>
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
