import React, { useMemo, useState } from 'react';
import { Vehicle, ServiceInterval } from '../../types';
import { useVehicles, useUIState } from '../../contexts/AppContexts';

// Bulk-assign a service interval to many assets at once: tick the trucks /
// trailers (or whole groups), choose "every X km" (or engine hours for
// forklifts), and "flag this many before" (default 2 000 km). Re-applying
// replaces the same-named interval so it stays one per asset.
const KM_PRESETS = [10000, 15000, 20000, 25000, 30000];
const HR_PRESETS = [250, 500, 750, 1000];
const isTrailer = (v: Vehicle) => /trailer|triaxle|skeleton|superlink/i.test(v.weightCategory || '');
const isForklift = (v: Vehicle) => /forklift|fork lift|reach|hyster/i.test(`${v.weightCategory || ''} ${v.name || ''}`);

const BulkServiceIntervalModal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const { vehicles = [], serviceIntervals = [], handleAddServiceInterval, handleDeleteServiceInterval } = useVehicles() as any;
    const { hideModal, showToast } = useUIState();
    const close = onClose || hideModal;

    const [unit, setUnit] = useState<'km' | 'hours'>('km');
    const [interval, setInterval] = useState<number>(15000);
    const [warn, setWarn] = useState<number>(2000);
    const [description, setDescription] = useState('Service');
    const [branch, setBranch] = useState('All');
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    const assets = useMemo(() => (vehicles as Vehicle[])
        .filter(v => v.status !== 'Sold')
        .filter(v => branch === 'All' || v.branch === branch)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')), [vehicles, branch]);
    const branches = useMemo(() => ['All', ...Array.from(new Set((vehicles as Vehicle[]).map(v => v.branch).filter(Boolean)))], [vehicles]);

    const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectWhere = (pred: (v: Vehicle) => boolean) => setSel(new Set(assets.filter(pred).map(v => v.id)));

    const presets = unit === 'km' ? KM_PRESETS : HR_PRESETS;
    const apply = async () => {
        if (sel.size === 0) { showToast('Pick at least one asset.'); return; }
        if (!interval || interval <= 0) { showToast('Set the service interval.'); return; }
        setSaving(true);
        let ok = 0, fail = 0;
        for (const id of sel) {
            try {
                // Replace any existing same-named interval so there's just one.
                const existing = (serviceIntervals as ServiceInterval[]).filter(si => si.vehicleId === id && si.description.toLowerCase() === description.trim().toLowerCase());
                for (const e of existing) await handleDeleteServiceInterval(e.id);
                const payload = unit === 'km'
                    ? { description: description.trim(), distanceInterval: interval, timeIntervalDays: null, hoursInterval: null, warnDistance: warn || null, warnHours: null }
                    : { description: description.trim(), distanceInterval: null, timeIntervalDays: null, hoursInterval: interval, warnDistance: null, warnHours: warn || null };
                const r = await handleAddServiceInterval(id, payload);
                if (r && r.ok === false) fail++; else ok++;
            } catch { fail++; }
        }
        setSaving(false);
        showToast(`Service interval set on ${ok} asset${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}.`);
        if (ok && !fail) close();
    };

    const inp = 'bg-white text-slate-800 p-2 rounded-lg border border-slate-300 text-sm';
    const presetChip = (active: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold border ${active ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`;

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-bold text-slate-900">Bulk service intervals</h2>
                <p className="text-xs text-slate-500">Tick the assets, choose the interval, and flag-before. Re-applying updates the same interval.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
                    <button onClick={() => { setUnit('km'); setInterval(15000); setWarn(2000); }} className={presetChip(unit === 'km')}>Kilometres</button>
                    <button onClick={() => { setUnit('hours'); setInterval(500); setWarn(100); }} className={presetChip(unit === 'hours')}>Engine hours</button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {presets.map(p => <button key={p} onClick={() => setInterval(p)} className={presetChip(interval === p)}>{p.toLocaleString()}</button>)}
                    <input type="number" value={interval} onChange={e => setInterval(parseInt(e.target.value) || 0)} className={`${inp} w-28`} placeholder="custom" />
                    <span className="text-xs text-slate-500">{unit}</span>
                </div>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">Flag <input type="number" value={warn} onChange={e => setWarn(parseInt(e.target.value) || 0)} className={`${inp} w-24`} /> {unit} before</label>
                <input value={description} onChange={e => setDescription(e.target.value)} className={`${inp} w-40`} placeholder="Service name" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <select value={branch} onChange={e => setBranch(e.target.value)} className={inp}>{branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}</select>
                <button onClick={() => selectWhere(v => !isTrailer(v) && !isForklift(v))} className="text-xs font-bold text-blue-600 hover:underline">Select trucks</button>
                <button onClick={() => selectWhere(isTrailer)} className="text-xs font-bold text-blue-600 hover:underline">Select trailers</button>
                <button onClick={() => selectWhere(isForklift)} className="text-xs font-bold text-blue-600 hover:underline">Select forklifts</button>
                <button onClick={() => setSel(new Set(assets.map(v => v.id)))} className="text-xs font-bold text-blue-600 hover:underline">All shown</button>
                <button onClick={() => setSel(new Set())} className="text-xs font-bold text-slate-500 hover:underline">Clear</button>
                <span className="text-xs font-bold text-slate-500 ml-auto">{sel.size} selected</span>
            </div>

            <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {assets.map(v => (
                    <label key={v.id} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm ${sel.has(v.id) ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={sel.has(v.id)} onChange={() => toggle(v.id)} className="h-4 w-4 accent-emerald-600" />
                        <span className="font-bold text-slate-800 w-16">{v.name}</span>
                        <span className="text-slate-500 w-24">{v.registration}</span>
                        <span className="text-[11px] text-slate-400">{v.weightCategory}{isForklift(v) ? ' · hours' : isTrailer(v) ? ' · hub km' : ' · km'}</span>
                        <span className="ml-auto text-slate-400 text-[11px]">{v.branch === 'LOADMASTER' ? 'LM' : (v.branch || '').replace('FBN ', '')}</span>
                    </label>
                ))}
            </div>

            <div className="flex justify-end gap-3">
                <button onClick={close} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button onClick={apply} disabled={saving || sel.size === 0} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg">{saving ? 'Applying…' : `Apply to ${sel.size}`}</button>
            </div>
        </div>
    );
};

export default BulkServiceIntervalModal;
