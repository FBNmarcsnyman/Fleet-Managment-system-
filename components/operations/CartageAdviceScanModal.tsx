import React, { useMemo, useState } from 'react';
import { Client, Contact, Branch } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import DocScanButton from '../shared/DocScanButton';
import { CARTAGE_DOC_PROMPT, CARTAGE_DOC_SCHEMA } from '../../lib/docScan';
import { usePickOptions } from '../../hooks/usePickOptions';

const DEPOTS = ['ZACPAK', 'CHC', 'ICS', 'IWS', 'SACD'];
const AREAS: { code: Branch; label: string }[] = [
    { code: 'FBN DBN', label: 'Durban' }, { code: 'FBN JHB', label: 'Johannesburg' }, { code: 'FBN CPT', label: 'Cape Town' },
];

// Guess the FBN branch area from an address string.
const inferArea = (addr: string): Branch | '' => {
    const A = (addr || '').toUpperCase();
    if (/BOKSBURG|KEMPTON|JET ?PARK|JOHANNESBURG|GERMISTON|MIDRAND|PRETORIA|SANDTON|EDENVALE|ELANDSFONTEIN|ISANDO|ALBERTON|ROODEPOORT|CENTURION|JNB|GAUTENG/.test(A)) return 'FBN JHB';
    if (/DURBAN|PINETOWN|UMHLANGA|NEW GERMANY|MOBENI|PROSPECTON|CONGELLA|JACOBS|WESTMEAD|HAMMARSDALE|RIVERHORSE|ZADUR|DUR\b/.test(A)) return 'FBN DBN';
    if (/CAPE TOWN|BELLVILLE|EPPING|MILNERTON|MONTAGUE|PAROW|ATLANTIS|BLACKHEATH|CPT/.test(A)) return 'FBN CPT';
    return '';
};
const detectDepot = (addr: string): string => {
    const A = (addr || '').toUpperCase();
    return DEPOTS.find(d => A.includes(d)) || '';
};

// Scan a forwarder's Cartage Advice / Delivery Order → create one import
// consignment. LCL sits in the depot watch list (awaiting unpack) until released
// & batch-collected; FCL is a collect-now job. Billing client is chosen by ops
// (forwarder vs consignee) per job.
const CartageAdviceScanModal: React.FC = () => {
    const { hideModal, showToast } = useUIState();
    const { clients = [], handleCreateLoadConfirmation } = useOperations() as any;
    const { currentUser } = useAuth();
    const commodities = usePickOptions('commodity');

    const today = new Date().toISOString().split('T')[0];
    const [scanned, setScanned] = useState<any>(null); // raw extraction (forwarder/consignee names kept for the chips)
    const [f, setF] = useState<any>({ type: 'LCL', collectionDate: today, collArea: '', delArea: '' });
    const [busy, setBusy] = useState(false);
    const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

    const clientNames = useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);

    const applyScan = (d: any) => {
        if (!d) return;
        setScanned(d);
        const isFcl = !!(d.container_no && String(d.container_no).trim());
        const refs = [
            d.shipment_ref && `Shipment ${d.shipment_ref}`, d.booking_ref && `Booking ${d.booking_ref}`,
            d.house_bill && `HBL ${d.house_bill}`, d.ocean_bill && `OBL ${d.ocean_bill}`,
            d.consignee_name && `Consignee: ${d.consignee_name}`,
            (d.contact_name || d.contact_email) && `Forwarder contact: ${[d.contact_name, d.contact_email, d.contact_phone].filter(Boolean).join(' · ')}`,
            (d.weight || d.volume) && `${d.weight ? d.weight + ' kg' : ''}${d.volume ? ` / ${d.volume} m³` : ''}`,
        ].filter(Boolean).join('\n');
        setF((p: any) => ({
            ...p,
            type: isFcl ? 'FCL' : 'LCL',
            client: (d.client_name || '').trim(),
            consignee: (d.consignee_name || '').trim(),
            forwarder: (d.client_name || '').trim(),
            collectFrom: (d.collect_from || '').trim(),
            deliverTo: (d.deliver_to || '').trim(),
            depot: detectDepot(d.collect_from || ''),
            container: (d.container_no || '').trim(),
            commodity: (d.commodity || '').trim(),
            packages: (d.packages || '').trim(),
            weight: (d.weight || '').toString().replace(/[^\d.]/g, ''),
            volume: (d.volume || '').toString().replace(/[^\d.]/g, ''),
            refs,
            contactEmail: (d.contact_email || '').trim(),
            contactName: (d.contact_name || '').trim(),
            collArea: inferArea(d.collect_from || '') || p.collArea,
            delArea: inferArea(d.deliver_to || '') || p.delArea,
            collectionDate: today,
        }));
        showToast('Document read — check the details, pick who to bill, then save.');
    };

    const save = async () => {
        if (!f.client?.trim()) { showToast('Pick the client to bill.'); return; }
        if (!f.collectFrom?.trim()) { showToast('Add the collect-from address.'); return; }
        setBusy(true);
        const c = (clients as any[]).find(x => (x.name || '').toLowerCase() === (f.client || '').toLowerCase()) as Client | undefined;
        const cs: Contact[] = (c as any)?.contacts || [];
        const isLcl = f.type === 'LCL';
        const data: any = {
            clientId: c?.id || '', clientName: f.client,
            clientEmail: cs[0]?.email || (c as any)?.contactEmail || undefined,
            clientContact: cs[0]?.name || c?.contactPerson || undefined,
            items: [], legs: [{ id: 'leg-1', collectionPoint: f.collectFrom, deliveryPoint: f.deliverTo || f.collectFrom, movementType: 'Collection' }],
            collectionPoint: f.collectFrom, deliveryPoint: f.deliverTo || f.collectFrom,
            collectionDate: f.collectionDate,
            commodity: f.commodity || undefined,
            packaging: f.packages || undefined,
            loadedPackages: f.packages ? Number(String(f.packages).replace(/[^\d]/g, '')) || undefined : undefined,
            weightKg: f.weight || undefined,
            cubeM3: f.volume ? Number(f.volume) : undefined,
            specialInstructions: f.refs || undefined,
            arrangingBranch: f.collArea || 'FBN DBN', collectionBranch: f.collArea || 'FBN DBN', destinationBranch: f.delArea || f.collArea || 'FBN JHB',
            priority: 'Medium', totalAmount: 0, supplierRate: 0,
            isCollection: true, repEmail: currentUser?.email,
            loadRefNo: scanned?.house_bill || undefined,
            customerOrderNumber: scanned?.shipment_ref || scanned?.booking_ref || undefined,
            // Import groupage: LCL waits in the depot watch list (no driver email
            // yet); FCL is ready to collect now.
            unpackDepot: isLcl ? (f.depot || undefined) : undefined,
            importStage: isLcl ? 'awaiting_release' : 'released',
            suppressOpsNotify: isLcl ? true : false,
        };
        try {
            const res = await handleCreateLoadConfirmation(data);
            setBusy(false);
            if (res?.ok === false) { showToast(`Could not save: ${res.error}`); return; }
            hideModal();
            showToast(isLcl ? `Import consignment logged — added to the ${f.depot || 'depot'} watch list.` : `FCL job logged — ready to collect.`);
        } catch (e: any) { setBusy(false); showToast(`Could not save: ${e?.message || 'error'}`); }
    };

    const inp = 'w-full bg-gray-700 text-white p-2.5 rounded-lg border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-black text-white">Import job — scan cartage advice</h2>
                    <p className="text-xs text-gray-400">Scan the cartage advice / delivery order, check, pick who to bill, save.</p>
                </div>
                <DocScanButton prompt={CARTAGE_DOC_PROMPT} schema={CARTAGE_DOC_SCHEMA} onResult={applyScan} label="Scan cartage advice" />
            </div>

            {/* Job type */}
            <div className="flex gap-2 mb-4">
                {(['LCL', 'FCL'] as const).map(t => (
                    <button key={t} type="button" onClick={() => set('type', t)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-black uppercase tracking-wider ${f.type === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                        {t === 'LCL' ? 'LCL (unpack depot)' : 'FCL (full container)'}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="col-span-2 md:col-span-3">
                    <label className={lbl}>Bill to (client) *</label>
                    <input list="caClients" value={f.client || ''} onChange={e => set('client', e.target.value)} className={inp} placeholder="who FBN invoices" />
                    <datalist id="caClients">{clientNames.map(n => <option key={n} value={n} />)}</datalist>
                    {(f.forwarder || f.consignee) && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {f.forwarder && <button type="button" onClick={() => set('client', f.forwarder)} className="text-[11px] bg-gray-700 hover:bg-gray-600 text-blue-300 px-2 py-1 rounded">Forwarder: {f.forwarder}</button>}
                            {f.consignee && <button type="button" onClick={() => set('client', f.consignee)} className="text-[11px] bg-gray-700 hover:bg-gray-600 text-blue-300 px-2 py-1 rounded">Consignee: {f.consignee}</button>}
                        </div>
                    )}
                </div>
                <div className="col-span-2 md:col-span-3"><label className={lbl}>Collect from {f.type === 'LCL' ? '(unpack depot)' : '(terminal)'} *</label><input value={f.collectFrom || ''} onChange={e => set('collectFrom', e.target.value)} className={inp} /></div>
                <div className="col-span-2 md:col-span-3"><label className={lbl}>Deliver to</label><input value={f.deliverTo || ''} onChange={e => set('deliverTo', e.target.value)} className={inp} /></div>
                {f.type === 'LCL' && <div><label className={lbl}>Unpack depot</label><input list="caDepots" value={f.depot || ''} onChange={e => set('depot', e.target.value.toUpperCase())} className={inp} /><datalist id="caDepots">{DEPOTS.map(d => <option key={d} value={d} />)}</datalist></div>}
                {f.type === 'FCL' && <div><label className={lbl}>Container #</label><input value={f.container || ''} onChange={e => set('container', e.target.value)} className={inp} /></div>}
                <div><label className={lbl}>Commodity</label><input list="caComm" value={f.commodity || ''} onChange={e => set('commodity', e.target.value)} className={inp} /><datalist id="caComm">{commodities.map(c => <option key={c} value={c} />)}</datalist></div>
                <div><label className={lbl}>Packages</label><input value={f.packages || ''} onChange={e => set('packages', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Weight (kg)</label><input value={f.weight || ''} onChange={e => set('weight', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Volume (m³)</label><input value={f.volume || ''} onChange={e => set('volume', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Collect area</label><select value={f.collArea || ''} onChange={e => set('collArea', e.target.value)} className={inp}><option value="">—</option>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
                <div><label className={lbl}>Delivery area</label><select value={f.delArea || ''} onChange={e => set('delArea', e.target.value)} className={inp}><option value="">—</option>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
                <div className="col-span-2 md:col-span-3"><label className={lbl}>References / notes</label><textarea value={f.refs || ''} onChange={e => set('refs', e.target.value)} rows={3} className={inp} /></div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-5 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-6 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : f.type === 'LCL' ? 'Add to depot watch' : 'Log FCL job'}</button>
            </div>
        </div>
    );
};

export default CartageAdviceScanModal;
