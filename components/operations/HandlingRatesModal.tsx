import React, { useEffect, useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { fetchHandlingRates, addHandlingRate, updateHandlingRate, deleteHandlingRate, HandlingRate, RateUnit, UNIT_LABEL } from '../../lib/handlingRates';

// Storage & handling rate card editor — set the rates ops apply to stored/handled
// loads (storage per day/week, shrinkwrapping, palletising, custom).
const UNITS: RateUnit[] = ['per_day', 'per_week', 'per_pallet', 'per_item', 'flat'];

const HandlingRatesModal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const { hideModal, showToast } = useUIState();
    const close = onClose || hideModal;
    const [rates, setRates] = useState<HandlingRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [nName, setNName] = useState(''); const [nUnit, setNUnit] = useState<RateUnit>('per_day'); const [nRate, setNRate] = useState('');

    const load = async () => { setLoading(true); setRates(await fetchHandlingRates(true)); setLoading(false); };
    useEffect(() => { load(); }, []);

    const patch = async (id: string, p: Partial<HandlingRate>) => {
        setRates(rs => rs.map(r => r.id === id ? { ...r, ...p } : r));
        const res = await updateHandlingRate(id, p);
        if (!res.ok) showToast(`Could not save: ${res.error}`);
    };
    const add = async () => {
        if (!nName.trim()) return;
        const res = await addHandlingRate({ name: nName.trim(), unit: nUnit, rate: parseFloat(nRate) || 0 });
        if (!res.ok) { showToast(`Could not add: ${res.error}`); return; }
        setNName(''); setNRate(''); load();
    };
    const remove = async (id: string) => { if (!window.confirm('Remove this rate?')) return; const res = await deleteHandlingRate(id); if (!res.ok) { showToast(`Could not remove: ${res.error}`); return; } load(); };

    const inp = 'bg-white text-slate-800 p-2 rounded-lg border border-slate-300 text-sm';
    return (
        <div className="space-y-4">
            <div><h2 className="text-xl font-bold text-slate-900">Storage &amp; handling rates</h2><p className="text-xs text-slate-500">Set the rates ops apply to stored / handled cargo. Changes save instantly.</p></div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {loading && <div className="px-3 py-6 text-center text-slate-400 text-sm">Loading…</div>}
                {!loading && rates.length === 0 && <div className="px-3 py-6 text-center text-slate-400 text-sm">No rates yet — add one below.</div>}
                {rates.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                        <input value={r.name} onChange={e => setRates(rs => rs.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))} onBlur={e => patch(r.id, { name: e.target.value })} className={`${inp} flex-1`} />
                        <select value={r.unit} onChange={e => patch(r.id, { unit: e.target.value as RateUnit })} className={inp}>{UNITS.map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select>
                        <div className="relative"><span className="absolute left-2 top-2 text-slate-400 text-xs">R</span><input type="number" step="0.01" value={r.rate} onChange={e => setRates(rs => rs.map(x => x.id === r.id ? { ...x, rate: parseFloat(e.target.value) || 0 } : x))} onBlur={e => patch(r.id, { rate: parseFloat(e.target.value) || 0 })} className={`${inp} w-24 pl-5`} /></div>
                        <label className="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={r.active} onChange={e => patch(r.id, { active: e.target.checked })} /> on</label>
                        <button onClick={() => remove(r.id)} className="text-red-400 hover:text-red-600 text-sm font-bold">✕</button>
                    </div>
                ))}
            </div>

            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex-1"><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">New rate</label><input value={nName} onChange={e => setNName(e.target.value)} placeholder="e.g. Storage, Shrinkwrapping…" className={`${inp} w-full`} /></div>
                <select value={nUnit} onChange={e => setNUnit(e.target.value as RateUnit)} className={inp}>{UNITS.map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select>
                <div className="relative"><span className="absolute left-2 top-2 text-slate-400 text-xs">R</span><input type="number" step="0.01" value={nRate} onChange={e => setNRate(e.target.value)} className={`${inp} w-24 pl-5`} placeholder="0.00" /></div>
                <button onClick={add} disabled={!nName.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Add</button>
            </div>

            <div className="flex justify-end"><button onClick={close} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-6 rounded-lg">Done</button></div>
        </div>
    );
};

export default HandlingRatesModal;
