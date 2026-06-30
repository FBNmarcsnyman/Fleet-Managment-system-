import React, { useState } from 'react';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import type { WaybillStage } from '../../types';

const STAGES: { value: WaybillStage; label: string }[] = [
    { value: 'collection', label: 'Collection (driver)' },
    { value: 'origin_depot_grn', label: 'Origin depot — goods received' },
    { value: 'linehaul_load', label: 'Linehaul loading' },
    { value: 'dest_depot_grn', label: 'Destination depot — goods received' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'pod', label: 'POD' },
    { value: 'other', label: 'Other' },
];
const CONDITIONS = ['ok', 'damaged', 'short', 'over'] as const;

// Reusable cargo-check capture: record packages (expected vs actual), weight,
// condition + damage photos, waybill no and notes at any checkpoint of the
// journey. Writes one waybill_event (the verification spine). Opened anywhere
// via showModal('captureWaybill', { loadCon, stage?, onSaved? }).
const CaptureWaybillEventModal: React.FC = () => {
    const { modal, hideModal, showToast } = useUIState();
    const { handleAddWaybillEvent } = useOperations() as any;
    const { currentUser } = useAuth();
    const lc = modal.payload?.loadCon || {};
    const onSaved = modal.payload?.onSaved;

    const [stage, setStage] = useState<WaybillStage>(modal.payload?.stage || 'collection');
    const [waybillNo, setWaybillNo] = useState(lc.loadRefNo || lc.customerOrderNo || '');
    const [expected, setExpected] = useState<string>(lc.quantity != null ? String(lc.quantity) : '');
    const [actual, setActual] = useState('');
    const [weight, setWeight] = useState<string>(lc.weightKg != null ? String(lc.weightKg) : '');
    const [condition, setCondition] = useState<typeof CONDITIONS[number]>('ok');
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<{ url: string }[]>([]);
    const [busy, setBusy] = useState(false);

    const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []); e.target.value = '';
        files.forEach(f => { const r = new FileReader(); r.onload = () => setPhotos(p => [...p, { url: r.result as string }]); r.readAsDataURL(f); });
    };

    const save = async () => {
        setBusy(true);
        const stageLabel = STAGES.find(s => s.value === stage)?.label || stage;
        const at = new Date().toISOString();
        const res = await handleAddWaybillEvent({
            loadId: lc.id,
            loadConNumber: lc.loadConNumber,
            stage,
            waybillNo: waybillNo.trim() || undefined,
            packagesExpected: expected !== '' ? parseInt(expected, 10) : undefined,
            packagesActual: actual !== '' ? parseInt(actual, 10) : undefined,
            weightKg: weight !== '' ? parseFloat(weight) : undefined,
            condition,
            damageFlag: condition !== 'ok',
            notes: notes.trim() || undefined,
            photos: photos.map(p => ({ url: p.url, caption: stageLabel, at })),
            branch: lc.arrangingBranch || lc.collectionBranch || undefined,
            createdByName: (currentUser as any)?.name || undefined,
        });
        setBusy(false);
        if (res && res.ok === false) { showToast(`Could not save: ${res.error}`); return; }
        const mismatch = expected !== '' && actual !== '' && parseInt(expected, 10) !== parseInt(actual, 10);
        showToast(`Cargo check saved (${stageLabel})${condition !== 'ok' || mismatch ? ' — flagged' : ''}.`);
        onSaved?.();
        hideModal();
    };

    const inp = 'w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
    const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';
    const mismatch = expected !== '' && actual !== '' && parseInt(expected, 10) !== parseInt(actual, 10);

    return (
        <div className="text-slate-800">
            <h2 className="text-xl font-black text-[#13294b]">Cargo check — {lc.loadConNumber || 'load'}</h2>
            <p className="text-xs text-slate-500 mb-3">Verify what's actually here: packages, weight, condition. Photos are filed against this waybill at this stage. Damage stays on file (not sent to the client unless requested).</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Checkpoint</label><select value={stage} onChange={e => setStage(e.target.value as WaybillStage)} className={inp}>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                <div><label className={lbl}>Waybill no</label><input value={waybillNo} onChange={e => setWaybillNo(e.target.value)} className={inp + ' normal-case'} style={{ textTransform: 'none' }} placeholder="client waybill / ref" /></div>
                <div><label className={lbl}>Packages expected</label><input type="number" value={expected} onChange={e => setExpected(e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Packages actual</label><input type="number" value={actual} onChange={e => setActual(e.target.value)} className={`${inp} ${mismatch ? 'ring-2 ring-red-400 border-red-400' : ''}`} /></div>
                <div><label className={lbl}>Weight (kg)</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Condition</label><select value={condition} onChange={e => setCondition(e.target.value as any)} className={`${inp} ${condition !== 'ok' ? 'ring-2 ring-red-400 border-red-400' : ''}`}>{CONDITIONS.map(c => <option key={c} value={c}>{c === 'ok' ? 'All good' : c === 'damaged' ? 'Damaged' : c === 'short' ? 'Short (missing)' : 'Over (extra)'}</option>)}</select></div>
            </div>
            {mismatch && <p className="text-xs font-bold text-red-600 mt-1">⚠ Package count doesn't match ({expected} expected vs {actual} actual).</p>}

            <div className="mt-3"><label className={lbl}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp + ' normal-case'} style={{ textTransform: 'none' }} placeholder="anything to record about the cargo / damage…" /></div>

            <div className="mt-3">
                <label className={lbl}>Photos {condition !== 'ok' && <span className="text-red-600">— please attach damage photos</span>}</label>
                <button type="button" onClick={() => document.getElementById('wb-photo-input')?.click()} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">{photos.length ? `${photos.length} photo(s) — add more` : 'Take / add photos'}</button>
                <input id="wb-photo-input" type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={addPhotos as any} />
                {photos.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{photos.map((p, i) => <img key={i} src={p.url} alt="" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />)}</div>}
            </div>

            <div className="flex justify-end gap-2 mt-4">
                <button onClick={hideModal} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={save} disabled={busy || !lc.id} className="px-5 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{busy ? 'Saving…' : 'Save cargo check'}</button>
            </div>
        </div>
    );
};

export default CaptureWaybillEventModal;
