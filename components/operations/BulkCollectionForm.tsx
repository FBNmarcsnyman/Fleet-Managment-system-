import React, { useMemo, useState } from 'react';
import { Client, Contact, Branch } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import { invokeFn, directInvoke } from '../../lib/supabase';
import { brandedEmail, emailButton } from '../../lib/emailTemplate';
import { usePickOptions } from '../../hooks/usePickOptions';
import DocScanButton from '../shared/DocScanButton';
import { BULK_DOC_PROMPT, BULK_DOC_SCHEMA } from '../../lib/docScan';
import DateField from './DateField';

// Import/export unpack depots we collect groupage from.
const DEPOTS = ['ZACPAK', 'CHC', 'ICS', 'IWS', 'SACD'];
const AREAS: { code: Branch; label: string }[] = [
    { code: 'FBN DBN', label: 'Durban' }, { code: 'FBN JHB', label: 'Johannesburg' }, { code: 'FBN CPT', label: 'Cape Town' },
];

type Row = { client: string; waybill: string; ref: string; door: string; area: Branch; packages: string; weight: string; cube: string; commodity: string };
const blankRow = (): Row => ({ client: '', waybill: '', ref: '', door: '', area: 'FBN DBN', packages: '', weight: '', cube: '', commodity: '' });

// Log ONE depot collection that contains MANY consignments. Each row becomes its
// own shipment (own door/POD/client), all linked by one collection reference so
// the driver gets a single "collect all at <depot>" instruction.
const BulkCollectionForm: React.FC = () => {
    const { hideModal, showToast, showModal } = useUIState();
    const { clients = [], handleCreateLoadConfirmation } = useOperations() as any;
    const { currentUser } = useAuth();
    const commodities = usePickOptions('commodity');

    const today = new Date().toISOString().split('T')[0];
    const [depot, setDepot] = useState('ZACPAK');
    const [collBranch, setCollBranch] = useState<Branch>('FBN DBN');
    const [date, setDate] = useState(today);
    const [rows, setRows] = useState<Row[]>([blankRow(), blankRow(), blankRow()]);
    const [busy, setBusy] = useState(false);

    const clientNames = useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);

    // AI-extracted manifest → replace the rows so the user can review/edit/delete
    // before logging. Area defaults to the collecting branch (the doc rarely
    // states it); the user picks per row if needed.
    const applyScan = (d: any) => {
        const list = Array.isArray(d?.consignments) ? d.consignments : [];
        if (d?.depot && String(d.depot).trim()) setDepot(String(d.depot).trim().toUpperCase());
        const mapped: Row[] = list.map((c: any) => ({
            ...blankRow(),
            area: collBranch,
            client: (c.client || '').toString().trim(),
            waybill: (c.waybill || '').toString().trim(),
            ref: (c.ref || '').toString().trim(),
            door: (c.door || '').toString().trim(),
            packages: (c.packages || '').toString().replace(/[^\d]/g, ''),
            weight: (c.weight || '').toString().replace(/[^\d.]/g, ''),
            cube: (c.cube || '').toString().replace(/[^\d.]/g, ''),
            commodity: (c.commodity || '').toString().trim(),
        }));
        if (!mapped.length) { showToast('No consignments found in that document.'); return; }
        setRows(mapped);
        showToast(`Read ${mapped.length} consignment${mapped.length !== 1 ? 's' : ''} — please check before logging.`);
    };

    const setRow = (i: number, k: keyof Row, v: string) => setRows(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
    const addRow = () => setRows(p => [...p, blankRow()]);
    const removeRow = (i: number) => setRows(p => p.filter((_, idx) => idx !== i));

    const totals = useMemo(() => {
        const valid = rows.filter(r => r.client.trim() && r.door.trim());
        return { count: valid.length, weight: valid.reduce((s, r) => s + (Number(r.weight) || 0), 0), cube: valid.reduce((s, r) => s + (Number(r.cube) || 0), 0) };
    }, [rows]);

    const submit = async () => {
        const valid = rows.filter(r => r.client.trim() && r.door.trim());
        if (!valid.length) { showToast('Add at least one consignment (client + door).'); return; }
        setBusy(true);
        const ref = `COL-${depot}-${String(Date.now()).slice(-6)}`;
        let ok = 0;
        for (const r of valid) {
            const c = (clients as any[]).find(x => (x.name || '').toLowerCase() === r.client.toLowerCase()) as Client | undefined;
            const cs: Contact[] = (c as any)?.contacts || [];
            const data: any = {
                clientId: c?.id || '', clientName: r.client, clientEmail: cs[0]?.email || (c as any)?.contactEmail || undefined, clientContact: cs[0]?.name || c?.contactPerson || undefined,
                items: [], legs: [{ id: 'leg-1', collectionPoint: depot, deliveryPoint: r.door, movementType: 'Collection' }],
                collectionPoint: depot, deliveryPoint: r.door, collectionDate: date,
                loadRefNo: r.waybill || undefined, customerOrderNumber: r.ref || undefined,
                commodity: r.commodity || undefined, packaging: r.packages ? `${r.packages} PKGS` : undefined,
                weightKg: r.weight || undefined, cubeM3: r.cube ? Number(r.cube) : undefined, loadedPackages: r.packages ? Number(r.packages) : undefined,
                arrangingBranch: collBranch, collectionBranch: collBranch, destinationBranch: r.area,
                priority: 'Medium', totalAmount: 0, supplierRate: 0,
                isCollection: true, collectionRef: ref, suppressOpsNotify: true, repEmail: currentUser?.email,
            };
            try { const res = await handleCreateLoadConfirmation(data); if (res?.ok) ok++; } catch (e) { console.error('[bulk] row', e); }
        }
        // One ops summary for the whole batch.
        try {
            const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
            const html = brandedEmail(`<p><strong>Depot / bulk collection — ${depot} (${collBranch}).</strong></p>
              <p><strong>${ok}</strong> consignment${ok !== 1 ? 's' : ''} to collect, total <strong>${Math.round(totals.weight).toLocaleString('en-ZA')} kg</strong>${totals.cube ? ` / ${totals.cube.toFixed(1)} m³` : ''}. Ref <strong>${ref}</strong>.</p>
              <p>Please assign a vehicle to collect all at ${depot}:</p>
              ${emailButton(`${base}?view=shipments`, 'Open Shipments board &rarr;', '#16a34a')}
              <p>Regards,<br>FBN Transport</p>`);
            const opsTo = collBranch === 'FBN DBN' ? 'opsdbn@fbn-transport.co.za' : collBranch === 'FBN JHB' ? 'opsjhb@fbn-transport.co.za' : 'ops@fbn-transport.co.za';
            void invokeFn('send-email', { body: { to: opsTo, cc: ['ops@fbn-transport.co.za'], subject: `BULK COLLECTION ${depot} (${collBranch}) - ${ok} shipments - ${ref}`, html, fromName: 'FBN Transport' } });
            void directInvoke('send-push', { title: `Bulk collection ${depot}`, body: `${ok} shipments, ${Math.round(totals.weight).toLocaleString('en-ZA')} kg to collect`, url: '?view=shipments' });
        } catch (e) { console.error('[bulk] summary', e); }
        setBusy(false);
        hideModal();
        showToast(`Logged ${ok} consignment${ok !== 1 ? 's' : ''} from ${depot} (ref ${ref}).`);
    };

    const inp = 'w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                    <h2 className="text-xl font-black text-white mb-1">Depot / Bulk Collection</h2>
                    <p className="text-xs text-gray-400">One pickup at an unpack depot → many consignments, each delivered to its own door.</p>
                </div>
                <DocScanButton prompt={BULK_DOC_PROMPT} schema={BULK_DOC_SCHEMA} onResult={applyScan}
                    label="📄 Scan manifest" />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div><label className={lbl}>Unpack depot</label><input list="depots" value={depot} onChange={e => setDepot(e.target.value.toUpperCase())} className={inp} /><datalist id="depots">{DEPOTS.map(d => <option key={d} value={d} />)}</datalist></div>
                <div><label className={lbl}>Collecting branch</label><select value={collBranch} onChange={e => setCollBranch(e.target.value as Branch)} className={inp}>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></div>
                <div><label className={lbl}>Date</label><DateField value={date} onChange={v => setDate(v)} className={inp} /></div>
            </div>

            <div className="max-h-[46vh] overflow-y-auto pr-1">
                <table className="w-full text-left">
                    <thead className="text-[10px] text-gray-500 uppercase tracking-wider"><tr>
                        <th className="pb-1">Client</th><th className="pb-1 w-24">Waybill #</th><th className="pb-1 w-24">Client ref</th><th className="pb-1">Deliver to (door)</th><th className="pb-1 w-16">Area</th><th className="pb-1 w-12">Pkgs</th><th className="pb-1 w-14">Kg</th><th className="pb-1 w-12">m³</th><th className="pb-1">Commodity</th><th></th>
                    </tr></thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i}>
                                <td className="pr-1 pb-1.5"><input list="bulkClients" value={r.client} onChange={e => setRow(i, 'client', e.target.value)} className={inp} placeholder="client" /></td>
                                <td className="pr-1 pb-1.5"><input value={r.waybill} onChange={e => setRow(i, 'waybill', e.target.value)} className={inp} placeholder="FBN #" /></td>
                                <td className="pr-1 pb-1.5"><input value={r.ref} onChange={e => setRow(i, 'ref', e.target.value)} className={inp} placeholder="ref" /></td>
                                <td className="pr-1 pb-1.5"><input value={r.door} onChange={e => setRow(i, 'door', e.target.value)} className={inp} placeholder="delivery address" /></td>
                                <td className="pr-1 pb-1.5"><select value={r.area} onChange={e => setRow(i, 'area', e.target.value as Branch)} className={inp}>{AREAS.map(a => <option key={a.code} value={a.code}>{a.label.slice(0, 3)}</option>)}</select></td>
                                <td className="pr-1 pb-1.5"><input value={r.packages} onChange={e => setRow(i, 'packages', e.target.value)} className={inp} /></td>
                                <td className="pr-1 pb-1.5"><input value={r.weight} onChange={e => setRow(i, 'weight', e.target.value)} className={inp} /></td>
                                <td className="pr-1 pb-1.5"><input value={r.cube} onChange={e => setRow(i, 'cube', e.target.value)} className={inp} /></td>
                                <td className="pr-1 pb-1.5"><input list="bulkComm" value={r.commodity} onChange={e => setRow(i, 'commodity', e.target.value)} className={inp} /></td>
                                <td className="pb-1.5"><button type="button" onClick={() => removeRow(i)} className="text-gray-500 hover:text-red-400 px-1">×</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <datalist id="bulkClients">{clientNames.map(n => <option key={n} value={n} />)}</datalist>
                <datalist id="bulkComm">{commodities.map(c => <option key={c} value={c} />)}</datalist>
                <div className="flex items-center gap-3 mt-1">
                    <button type="button" onClick={addRow} className="text-xs font-bold text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg">+ Add consignment</button>
                    <button type="button" onClick={() => showModal('pickLists', {})} className="text-xs font-semibold text-blue-400 hover:text-blue-300">Manage commodity/packaging lists</button>
                </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
                <span className="text-xs text-gray-400">{totals.count} consignments · {Math.round(totals.weight).toLocaleString('en-ZA')} kg{totals.cube ? ` · ${totals.cube.toFixed(1)} m³` : ''}</span>
                <div className="flex gap-3">
                    <button type="button" onClick={hideModal} disabled={busy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-4 rounded-lg disabled:opacity-50">Cancel</button>
                    <button type="button" onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-6 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Logging…' : 'Log batch'}</button>
                </div>
            </div>
        </div>
    );
};

export default BulkCollectionForm;
