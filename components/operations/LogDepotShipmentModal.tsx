import React, { useMemo, useState } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import { directInsert, directUpdate } from '../../lib/supabase';
import { usePickOptions } from '../../hooks/usePickOptions';
import DocScanButton from '../shared/DocScanButton';
import { DEPOT_DOC_PROMPT, DEPOT_DOC_SCHEMA } from '../../lib/docScan';
import { DEPOT_SHIPMENT_STATUSES, defaultFreeTimeDays } from '../../lib/depotShipments';

const BRANCHES = ['FBN DBN', 'FBN JHB', 'FBN CPT'];
const up = (s: string) => s.toUpperCase();

// Add / edit an LCL depot shipment — captured from the drop/clearing note and
// tracked from "waiting for vessel" through unpack, collection and delivery.
const LogDepotShipmentModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { clients = [] } = useOperations() as any;
    const editing = modal.payload?.shipment;
    const commodities = usePickOptions('commodity');
    const clientNames = useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);

    const [f, setF] = useState<any>(editing ? { ...editing } : { status: 'Waiting for Vessel', branch: 'FBN DBN', hazardous: false });
    const [busy, setBusy] = useState(false);
    const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

    // The displayed free-time defaults to the rule (3 days, or 1 if hazardous)
    // unless ops has set a per-shipment/depot override.
    const freeTimeShown = f.free_time_days ?? defaultFreeTimeDays(f.hazardous);

    const applyScan = (d: any) => {
        if (!d) return;
        setF((p: any) => {
            const next = { ...p };
            ['client_name', 'client_ref', 'house_bill', 'vessel_name', 'shipping_line', 'eta_port', 'commodity', 'packages', 'weight', 'cube', 'delivery_point', 'depot'].forEach(k => {
                const v = d[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') next[k] = String(v).trim();
            });
            return next;
        });
        showToast('Clearing doc read — please check the details below.');
    };

    const save = async () => {
        if (!f.client_name && !f.house_bill) { showToast('Add at least a client or house bill.'); return; }
        setBusy(true);
        const c = (clients as any[]).find(x => (x.name || '').toLowerCase() === (f.client_name || '').toLowerCase());
        const num = (v: any) => (v === '' || v == null ? null : Number(v));
        const row: any = {
            client_id: c?.id || null,
            client_name: f.client_name ? up(f.client_name) : null,
            client_ref: f.client_ref ? up(f.client_ref) : null,
            depot: f.depot ? up(f.depot) : null,
            branch: f.branch || null,
            vessel_name: f.vessel_name ? up(f.vessel_name) : null,
            shipping_line: f.shipping_line ? up(f.shipping_line) : null,
            eta_port: f.eta_port || null,
            house_bill: f.house_bill ? up(f.house_bill) : null,
            commodity: f.commodity ? up(f.commodity) : null,
            packages: num(f.packages),
            weight: num(f.weight),
            cube: num(f.cube),
            collection_point: f.collection_point ? up(f.collection_point) : null,
            delivery_point: f.delivery_point ? up(f.delivery_point) : null,
            hazardous: !!f.hazardous,
            free_time_days: num(f.free_time_days),
            received_at_depot_date: f.received_at_depot_date || null,
            unpack_date: f.unpack_date || null,
            clearing_doc: f.clearing_doc || null,
            status: f.status || 'Waiting for Vessel',
            notes: f.notes ? up(f.notes) : null,
        };
        const res = editing ? await directUpdate('depot_shipments', { id: editing.id }, row) : await directInsert('depot_shipments', row);
        setBusy(false);
        if (res.error) { showToast(`Could not save: ${res.error.message}`); return; }
        window.dispatchEvent(new Event('depot-shipments-changed'));
        hideModal();
        showToast(`Depot shipment ${editing ? 'updated' : 'logged'}.`);
    };

    const inp = 'w-full bg-gray-700 text-white p-2.5 rounded-lg border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-xl font-black text-white">{editing ? 'Edit' : 'Log'} Depot Shipment</h2>
                <DocScanButton prompt={DEPOT_DOC_PROMPT} schema={DEPOT_DOC_SCHEMA} onResult={applyScan} label="📄 Scan clearing / drop note" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className={lbl}>Client</label><input list="depClients" value={f.client_name || ''} onChange={e => set('client_name', e.target.value)} className={inp} /><datalist id="depClients">{clientNames.map(n => <option key={n} value={n} />)}</datalist></div>
                <div><label className={lbl}>Client ref</label><input value={f.client_ref || ''} onChange={e => set('client_ref', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>House bill (HBL)</label><input value={f.house_bill || ''} onChange={e => set('house_bill', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Unpack depot</label><input value={f.depot || ''} onChange={e => set('depot', e.target.value)} className={inp} placeholder="e.g. ZACPAK / APEX" /></div>
                <div><label className={lbl}>Handling branch</label><select value={f.branch || ''} onChange={e => set('branch', e.target.value)} className={inp}>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                <div><label className={lbl}>Status</label><select value={f.status || 'Waiting for Vessel'} onChange={e => set('status', e.target.value)} className={inp}>{DEPOT_SHIPMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className={lbl}>Vessel</label><input value={f.vessel_name || ''} onChange={e => set('vessel_name', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Shipping line</label><input value={f.shipping_line || ''} onChange={e => set('shipping_line', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>ETA</label><input type="date" value={f.eta_port || ''} onChange={e => set('eta_port', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Commodity</label><input list="depComm" value={f.commodity || ''} onChange={e => set('commodity', e.target.value)} className={inp} /><datalist id="depComm">{commodities.map(c => <option key={c} value={c} />)}</datalist></div>
                <div><label className={lbl}>Packages</label><input type="number" value={f.packages ?? ''} onChange={e => set('packages', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Weight (kg)</label><input type="number" value={f.weight ?? ''} onChange={e => set('weight', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Cube (m³)</label><input type="number" step="0.01" value={f.cube ?? ''} onChange={e => set('cube', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Collection point</label><input value={f.collection_point || ''} onChange={e => set('collection_point', e.target.value)} className={inp} placeholder="depot / port" /></div>
                <div><label className={lbl}>Delivery point</label><input value={f.delivery_point || ''} onChange={e => set('delivery_point', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Received at depot</label><input type="date" value={f.received_at_depot_date || ''} onChange={e => set('received_at_depot_date', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Unpack date</label><input type="date" value={f.unpack_date || ''} onChange={e => set('unpack_date', e.target.value)} className={inp} /></div>
                <div>
                    <label className={lbl}>Free-time (days)</label>
                    <input type="number" value={f.free_time_days ?? ''} onChange={e => set('free_time_days', e.target.value)} className={inp} placeholder={`${freeTimeShown} (default)`} />
                </div>
                <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm text-gray-200 font-semibold cursor-pointer">
                        <input type="checkbox" checked={!!f.hazardous} onChange={e => set('hazardous', e.target.checked)} className="h-4 w-4" />
                        Hazardous (1-day free-time)
                    </label>
                </div>
                <div><label className={lbl}>Clearing doc (link)</label><input value={f.clearing_doc || ''} onChange={e => set('clearing_doc', e.target.value)} className={inp} placeholder="URL (upload coming next)" /></div>
                <div className="col-span-2 md:col-span-3"><label className={lbl}>Notes</label><textarea value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} className={inp} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-5 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-6 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : 'Save'}</button>
            </div>
        </div>
    );
};

export default LogDepotShipmentModal;
