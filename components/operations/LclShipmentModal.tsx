import React, { useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { directUpdate, directInsert } from '../../lib/supabase';
import { FBN_ORGANIZATION_ID } from '../../lib/mappers';
import DocScanButton from '../shared/DocScanButton';
import DateField from './DateField';
import { DRO_DOC_PROMPT, DRO_DOC_SCHEMA } from '../../lib/docScan';

// View / edit one LCL groupage shipment on the status report. Update its status
// and dates as the depot frees it, scan a DRO to fill fields, or log a new
// shipment from a release document. Saving writes straight to lcl_shipments.
const LCL_STATUSES = ['CONTAINER NOT IN', 'UNPACKED', 'COLLECTED / ON ROUTE', 'RECEIVED AT FBN DBN', 'CARGO DISPATCHED TO JHB', 'RECEIVED AT FBN JHB', 'OUT FOR DELIVERY', 'DELIVERED'];
const DEPOTS = ['ZACPAK', 'CHC', 'ICS', 'MONT', 'SACD', 'IWS'];

const LclShipmentModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const existing = modal.payload?.shipment;
    const onSaved = modal.payload?.onSaved as (() => void) | undefined;
    const [f, setF] = useState<any>(existing ? { ...existing } : { status: 'CONTAINER NOT IN', hazardous: false });
    const [busy, setBusy] = useState(false);
    const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

    const applyScan = (d: any) => {
        if (!d) return;
        setF((p: any) => ({
            ...p,
            fbn_di: d.fbn_di?.trim() || p.fbn_di, file_ref: d.file_ref?.trim() || p.file_ref, house_bill: d.house_bill?.trim() || p.house_bill,
            container_no: (d.container_no || '').toUpperCase().trim() || p.container_no, vessel: (d.vessel || '').toUpperCase().trim() || p.vessel,
            eta: d.eta || p.eta, depot: (d.depot || '').toUpperCase().trim() || p.depot, consignee: (d.consignee || '').toUpperCase().trim() || p.consignee,
            commodity: (d.commodity || '').toUpperCase().trim() || p.commodity,
            qty: d.qty ? Number(String(d.qty).replace(/[^\d]/g, '')) : p.qty,
            weight_kg: d.weight ? Number(String(d.weight).replace(/[^\d.]/g, '')) : p.weight_kg,
            volume_cbm: d.cube ? Number(String(d.cube).replace(/[^\d.]/g, '')) : p.volume_cbm,
            hazardous: /Y/i.test(d.hazardous || '') || p.hazardous, un_number: d.un_number?.trim() || p.un_number,
        }));
        showToast('Release document read — please check the fields below.');
    };

    const save = async () => {
        if (!f.fbn_di && !f.file_ref && !f.container_no) { showToast('Add at least an FBN DI, file ref or container.'); return; }
        setBusy(true);
        const row: any = {
            fbn_di: f.fbn_di || null, file_ref: f.file_ref || null, house_bill: f.house_bill || f.file_ref || null,
            container_no: f.container_no ? String(f.container_no).toUpperCase() : null, vessel: f.vessel || null, eta: f.eta || null,
            depot: f.depot || null, unpack_region: f.unpack_region || 'DBN', consignee: f.consignee || null,
            commodity: f.commodity || null, hazardous: !!f.hazardous, un_number: f.un_number || null,
            qty: f.qty ? Number(f.qty) : null, weight_kg: f.weight_kg ? Number(f.weight_kg) : null, volume_cbm: f.volume_cbm ? Number(f.volume_cbm) : null,
            status: f.status || 'CONTAINER NOT IN', unpack_date: f.unpack_date || null, uplift_date: f.uplift_date || null,
            delivered_jhb_date: f.delivered_jhb_date || null, delivered_client_date: f.delivered_client_date || null,
            remarks: f.remarks || null, is_history: /DELIVERED/i.test(f.status || ''),
        };
        const res = existing?.id
            ? await directUpdate('lcl_shipments', { id: existing.id }, row)
            : await directInsert('lcl_shipments', { ...row, organization_id: FBN_ORGANIZATION_ID, client_sheet: f.client_sheet || 'MANUAL', source: 'manual' });
        setBusy(false);
        if (res.error) { showToast(`Could not save: ${res.error.message}`); return; }
        onSaved?.();
        hideModal();
        showToast(`Shipment ${f.fbn_di || f.file_ref || ''} saved.`);
    };

    const inp = 'w-full bg-gray-700 text-white p-2 rounded-lg border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-black text-white">{existing?.id ? 'Shipment' : 'Log'} — {f.fbn_di || f.file_ref || 'LCL groupage'}</h2>
                    {existing?.client_sheet && <p className="text-xs text-gray-400">{existing.client_sheet}</p>}
                </div>
                <DocScanButton prompt={DRO_DOC_PROMPT} schema={DRO_DOC_SCHEMA} onResult={applyScan} label="📄 Scan DRO / release" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className={lbl}>FBN DI</label><input value={f.fbn_di || ''} onChange={e => set('fbn_di', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>File ref / HBL</label><input value={f.file_ref || ''} onChange={e => set('file_ref', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Container</label><input value={f.container_no || ''} onChange={e => set('container_no', e.target.value.toUpperCase())} className={inp} /></div>
                <div><label className={lbl}>Vessel</label><input value={f.vessel || ''} onChange={e => set('vessel', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>ETA</label><DateField value={(f.eta || '').slice(0, 10)} onChange={v => set('eta', v)} className={inp} /></div>
                <div><label className={lbl}>Depot</label><input list="lclDepots" value={f.depot || ''} onChange={e => set('depot', e.target.value.toUpperCase())} className={inp} /><datalist id="lclDepots">{DEPOTS.map(d => <option key={d} value={d} />)}</datalist></div>
                <div><label className={lbl}>Consignee</label><input value={f.consignee || ''} onChange={e => set('consignee', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Commodity</label><input value={f.commodity || ''} onChange={e => set('commodity', e.target.value)} className={inp} /></div>
                <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-200 pb-2"><input type="checkbox" checked={!!f.hazardous} onChange={e => set('hazardous', e.target.checked)} /> Hazardous</label>
                    {f.hazardous && <input value={f.un_number || ''} onChange={e => set('un_number', e.target.value)} placeholder="UN no" className={inp} />}
                </div>
                <div><label className={lbl}>Packages</label><input value={f.qty || ''} onChange={e => set('qty', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Weight (kg)</label><input value={f.weight_kg || ''} onChange={e => set('weight_kg', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Volume (m³)</label><input value={f.volume_cbm || ''} onChange={e => set('volume_cbm', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Status</label><select value={f.status || ''} onChange={e => set('status', e.target.value)} className={inp}>{LCL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className={lbl}>Unpack date</label><DateField value={(f.unpack_date || '').slice(0, 10)} onChange={v => set('unpack_date', v)} className={inp} /></div>
                <div><label className={lbl}>Uplift / collected</label><DateField value={(f.uplift_date || '').slice(0, 10)} onChange={v => set('uplift_date', v)} className={inp} /></div>
                <div><label className={lbl}>Delivered FBN JHB</label><DateField value={(f.delivered_jhb_date || '').slice(0, 10)} onChange={v => set('delivered_jhb_date', v)} className={inp} /></div>
                <div><label className={lbl}>Delivered to client</label><DateField value={(f.delivered_client_date || '').slice(0, 10)} onChange={v => set('delivered_client_date', v)} className={inp} /></div>
                <div className="col-span-2 md:col-span-3"><label className={lbl}>Remarks</label><textarea value={f.remarks || ''} onChange={e => set('remarks', e.target.value)} rows={2} className={inp} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-5 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-6 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : 'Save'}</button>
            </div>
        </div>
    );
};

export default LclShipmentModal;
