import React, { useMemo, useState } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import { directInsert, directUpdate } from '../../lib/supabase';
import { usePickOptions } from '../../hooks/usePickOptions';
import DocScanButton from '../shared/DocScanButton';
import { CONTAINER_DOC_PROMPT, CONTAINER_DOC_SCHEMA } from '../../lib/docScan';

const SIZES = ['20FT', '40FT', '45FT', 'REEFER 20FT', 'REEFER 40FT', 'FLAT RACK', 'OPEN TOP'];
const BRANCHES = ['FBN DBN', 'FBN JHB', 'FBN CPT'];
export const CONTAINER_STATUSES = ['At Sea', 'Arrived Port', 'Available', 'Collected', 'At Depot', 'Unpacked', 'Delivered', 'Empty', 'Turned In'];

const up = (s: string) => s.toUpperCase();

// Add / edit a container being monitored from port through to empty turn-in.
const LogContainerModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { clients = [] } = useOperations() as any;
    const editing = modal.payload?.container;
    const commodities = usePickOptions('commodity');
    const clientNames = useMemo(() => [...new Set((clients as any[]).map(c => c.name).filter(Boolean))].sort(), [clients]);

    const [f, setF] = useState<any>(editing ? { ...editing } : { status: 'At Sea', plan: 'unpack', branch: 'FBN DBN', size: '40FT' });
    const [busy, setBusy] = useState(false);
    const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

    // Merge AI-extracted fields onto the form (only non-empty values), so the
    // user can review/correct before saving.
    const applyScan = (d: any) => {
        if (!d) return;
        setF((p: any) => {
            const next = { ...p };
            ['container_no', 'seal_no', 'size', 'weight', 'commodity', 'client_name', 'client_ref', 'vessel_name', 'shipping_line', 'eta_port'].forEach(k => {
                const v = d[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') next[k] = String(v).trim();
            });
            return next;
        });
        showToast('Document read — please check the details below.');
    };

    const save = async () => {
        if (!f.container_no) { showToast('Add the container number.'); return; }
        setBusy(true);
        const c = (clients as any[]).find(x => (x.name || '').toLowerCase() === (f.client_name || '').toLowerCase());
        const row: any = {
            container_no: up(f.container_no || ''), seal_no: f.seal_no ? up(f.seal_no) : null, size: f.size || null,
            weight: f.weight ? Number(f.weight) : null, commodity: f.commodity ? up(f.commodity) : null,
            client_id: c?.id || null, client_name: f.client_name ? up(f.client_name) : null, client_ref: f.client_ref ? up(f.client_ref) : null,
            vessel_name: f.vessel_name ? up(f.vessel_name) : null, shipping_line: f.shipping_line ? up(f.shipping_line) : null,
            eta_port: f.eta_port || null, plan: f.plan || null, status: f.status || 'At Sea', branch: f.branch || null,
            turn_in_area: f.turn_in_area || null, turn_in_date: f.turn_in_date || null, notes: f.notes ? up(f.notes) : null,
        };
        const res = editing ? await directUpdate('containers', { id: editing.id }, row) : await directInsert('containers', row);
        setBusy(false);
        if (res.error) { showToast(`Could not save: ${res.error.message}`); return; }
        window.dispatchEvent(new Event('containers-changed'));
        hideModal();
        showToast(`Container ${row.container_no} ${editing ? 'updated' : 'logged'}.`);
    };

    const inp = 'w-full bg-gray-700 text-white p-2.5 rounded-lg border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-xl font-black text-white">{editing ? 'Edit' : 'Log'} Container</h2>
                <DocScanButton prompt={CONTAINER_DOC_PROMPT} schema={CONTAINER_DOC_SCHEMA} onResult={applyScan}
                    label="📄 Scan arrival doc" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className={lbl}>Container #</label><input value={f.container_no || ''} onChange={e => set('container_no', e.target.value)} className={inp} placeholder="ABCU1234567" /></div>
                <div><label className={lbl}>Seal #</label><input value={f.seal_no || ''} onChange={e => set('seal_no', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Size</label><select value={f.size || ''} onChange={e => set('size', e.target.value)} className={inp}>{SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className={lbl}>Weight (kg)</label><input type="number" value={f.weight || ''} onChange={e => set('weight', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Commodity</label><input list="ctrComm" value={f.commodity || ''} onChange={e => set('commodity', e.target.value)} className={inp} /><datalist id="ctrComm">{commodities.map(c => <option key={c} value={c} />)}</datalist></div>
                <div><label className={lbl}>Handling branch</label><select value={f.branch || ''} onChange={e => set('branch', e.target.value)} className={inp}>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                <div><label className={lbl}>Client</label><input list="ctrClients" value={f.client_name || ''} onChange={e => set('client_name', e.target.value)} className={inp} /><datalist id="ctrClients">{clientNames.map(n => <option key={n} value={n} />)}</datalist></div>
                <div><label className={lbl}>Client ref</label><input value={f.client_ref || ''} onChange={e => set('client_ref', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Plan</label><select value={f.plan || ''} onChange={e => set('plan', e.target.value)} className={inp}><option value="unpack">Unpack at depot</option><option value="full_delivery">Full delivery</option></select></div>
                <div><label className={lbl}>Vessel</label><input value={f.vessel_name || ''} onChange={e => set('vessel_name', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Shipping line</label><input value={f.shipping_line || ''} onChange={e => set('shipping_line', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>ETA to port</label><input type="date" value={f.eta_port || ''} onChange={e => set('eta_port', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Status</label><select value={f.status || 'At Sea'} onChange={e => set('status', e.target.value)} className={inp}>{CONTAINER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className={lbl}>Empty turn-in area</label><select value={f.turn_in_area || ''} onChange={e => set('turn_in_area', e.target.value)} className={inp}><option value="">—</option>{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                <div><label className={lbl}>Turn-in by date</label><input type="date" value={f.turn_in_date || ''} onChange={e => set('turn_in_date', e.target.value)} className={inp} /></div>
                <div className="col-span-2 md:col-span-3"><label className={lbl}>Notes</label><textarea value={f.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} className={inp} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-5 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-6 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : 'Save'}</button>
            </div>
        </div>
    );
};

export default LogContainerModal;
