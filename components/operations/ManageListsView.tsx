import React, { useEffect, useMemo, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { fetchManagedLists, saveManagedList, ManagedKey, ManagedEntry } from '../../lib/managedLists';

// Curate the learned pick-lists (route / commodity / packaging / load-type) that
// the create forms build from past loads. Tick values to HIDE the junk; add
// approved EXTRA values. Saved to email_settings.managed_lists.
const LISTS: { key: ManagedKey; label: string; field: string }[] = [
    { key: 'route', label: 'Routes', field: 'route' },
    { key: 'commodity', label: 'Commodity', field: 'commodity' },
    { key: 'packaging', label: 'Packaging', field: 'packaging' },
    { key: 'loadType', label: 'Load type', field: 'loadType' },
];

const ManageListsView: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const { loadConfirmations = [] } = useOperations() as any;
    const { hideModal, showToast } = useUIState();
    const close = onClose || hideModal;
    const [activeKey, setActiveKey] = useState<ManagedKey>('route');
    const [managed, setManaged] = useState<Record<string, ManagedEntry>>({});
    const [extraInput, setExtraInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { fetchManagedLists(true).then(m => { setManaged(m as any); setLoaded(true); }); }, []);

    const active = LISTS.find(l => l.key === activeKey)!;
    const entry: ManagedEntry = managed[activeKey] || { hidden: [], extra: [] };
    const hiddenSet = useMemo(() => new Set((entry.hidden || []).map(s => s.toLowerCase())), [entry]);

    // Learned values for this field, ranked by how often they appear on past loads.
    const learned = useMemo(() => {
        const count = new Map<string, number>();
        (loadConfirmations as any[]).forEach(l => { const v = (l[active.field] || '').toString().trim(); if (v) count.set(v, (count.get(v) || 0) + 1); });
        (entry.extra || []).forEach(v => { if (!count.has(v)) count.set(v, 0); });
        return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    }, [loadConfirmations, active.field, entry.extra]);

    const toggleHide = (value: string) => {
        const isHidden = hiddenSet.has(value.toLowerCase());
        const hidden = isHidden ? (entry.hidden || []).filter(h => h.toLowerCase() !== value.toLowerCase()) : [...(entry.hidden || []), value];
        setManaged(m => ({ ...m, [activeKey]: { hidden, extra: entry.extra || [] } }));
    };
    const addExtra = () => {
        const v = extraInput.trim(); if (!v) return;
        setManaged(m => ({ ...m, [activeKey]: { hidden: entry.hidden || [], extra: [...(entry.extra || []), v] } }));
        setExtraInput('');
    };
    const save = async () => {
        setSaving(true);
        const res = await saveManagedList(activeKey, managed[activeKey] || { hidden: [], extra: [] });
        setSaving(false);
        showToast(res.ok ? `${active.label} list saved.` : `Could not save: ${res.error}`);
    };

    const chip = (a: boolean) => `px-3 py-1.5 text-xs font-bold rounded-lg ${a ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`;
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-bold text-slate-900">Manage pick-lists</h2>
                <p className="text-xs text-slate-500">Hide junk values (they stay on past loads but stop appearing as suggestions) and add approved ones. Applies across the create forms.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">{LISTS.map(l => <button key={l.key} onClick={() => setActiveKey(l.key)} className={chip(activeKey === l.key)}>{l.label}</button>)}</div>

            <div className="flex items-center gap-2">
                <input value={extraInput} onChange={e => setExtraInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addExtra(); }} placeholder={`Add an approved ${active.label.toLowerCase()} value…`} className="flex-1 bg-white text-slate-800 p-2 rounded-lg border border-slate-300 text-sm" />
                <button onClick={addExtra} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Add</button>
            </div>

            <div className="max-h-80 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {!loaded && <div className="px-3 py-6 text-center text-slate-400 text-sm">Loading…</div>}
                {loaded && learned.length === 0 && <div className="px-3 py-6 text-center text-slate-400 text-sm">No values yet for {active.label.toLowerCase()}.</div>}
                {learned.map(([value, n]) => {
                    const isHidden = hiddenSet.has(value.toLowerCase());
                    return (
                        <div key={value} className={`flex items-center gap-3 px-3 py-2 text-sm ${isHidden ? 'bg-slate-50' : ''}`}>
                            <span className={`flex-1 ${isHidden ? 'line-through text-slate-400' : 'text-slate-800'}`}>{value}{n > 0 && <span className="text-[10px] text-slate-400 ml-2">· {n} load{n === 1 ? '' : 's'}</span>}</span>
                            <button onClick={() => toggleHide(value)} className={`text-xs font-bold py-1 px-2.5 rounded ${isHidden ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>{isHidden ? 'Unhide' : 'Hide'}</button>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end gap-2">
                <button onClick={close} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg">Close</button>
                <button onClick={save} disabled={saving} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg">{saving ? 'Saving…' : `Save ${active.label}`}</button>
            </div>
        </div>
    );
};

export default ManageListsView;
