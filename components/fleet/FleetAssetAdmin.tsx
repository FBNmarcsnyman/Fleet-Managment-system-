import React, { useMemo, useState } from 'react';
import { Vehicle, Branch, VehicleStatus } from '../../types';
import { BRANCHES, VEHICLE_CATEGORIES, VEHICLE_STATUSES, CATEGORY_ORDER } from '../../constants';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { TrashIcon } from '../icons/TrashIcon';

type EditableField = 'branch' | 'weightCategory' | 'status' | 'linkedVehicleId';

const FleetAssetAdmin: React.FC = () => {
    const { vehicles = [], handleUpdateVehicle } = useVehicles();
    const { showToast } = useUIState();

    // Pending (unsaved) edits, keyed by vehicle id.
    const [edits, setEdits] = useState<Record<string, Partial<Vehicle>>>({});
    // Vehicles currently being persisted; their row shows a spinner.
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    // Multi-select for bulk actions.
    const [selected, setSelected] = useState<Set<string>>(new Set());
    // Bulk action bar state.
    const [bulkField, setBulkField] = useState<EditableField | ''>('');
    const [bulkValue, setBulkValue] = useState<string>('');
    const [applyingBulk, setApplyingBulk] = useState(false);
    // Filter input.
    const [filter, setFilter] = useState('');

    // Active (non-Sold) vehicles, sorted by CATEGORY_ORDER then by name within
    // category so trailers cluster, horses cluster, etc.
    const sortedVehicles = useMemo(() => {
        const active = (vehicles as Vehicle[]).filter(v => v.status !== 'Sold');
        return [...active].sort((a, b) => {
            const ai = CATEGORY_ORDER.indexOf(a.weightCategory || '');
            const bi = CATEGORY_ORDER.indexOf(b.weightCategory || '');
            const aiSafe = ai === -1 ? CATEGORY_ORDER.length : ai;
            const biSafe = bi === -1 ? CATEGORY_ORDER.length : bi;
            if (aiSafe !== biSafe) return aiSafe - biSafe;
            return a.name.localeCompare(b.name);
        });
    }, [vehicles]);

    // Free-text filter on name + registration.
    const filteredVehicles = useMemo(() => {
        if (!filter.trim()) return sortedVehicles;
        const needle = filter.toLowerCase();
        return sortedVehicles.filter(v =>
            v.name.toLowerCase().includes(needle) ||
            v.registration.toLowerCase().includes(needle) ||
            (v.weightCategory || '').toLowerCase().includes(needle) ||
            v.branch.toLowerCase().includes(needle),
        );
    }, [sortedVehicles, filter]);

    // Linked-partner candidates: for each vehicle, list other vehicles in the
    // same weight category. Precomputed for the whole table so we don't
    // re-filter inside each row's render.
    const candidatesByCategory = useMemo(() => {
        const map = new Map<string, Vehicle[]>();
        for (const v of vehicles as Vehicle[]) {
            const key = v.weightCategory || '';
            const list = map.get(key) ?? [];
            list.push(v);
            map.set(key, list);
        }
        for (const list of map.values()) list.sort((a, b) => a.registration.localeCompare(b.registration));
        return map;
    }, [vehicles]);

    const liveValue = <K extends keyof Vehicle>(v: Vehicle, field: K): Vehicle[K] => {
        const pending = edits[v.id]?.[field];
        return pending !== undefined ? (pending as Vehicle[K]) : v[field];
    };

    const setEdit = (id: string, field: keyof Vehicle, value: any) => {
        setEdits(prev => {
            const current = prev[id] ?? {};
            const next = { ...current, [field]: value };
            return { ...prev, [id]: next };
        });
    };

    const clearEdit = (id: string) => {
        setEdits(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const isDirty = (id: string) => !!edits[id] && Object.keys(edits[id]).length > 0;

    const saveRow = async (id: string) => {
        const updates = edits[id];
        if (!updates) return;
        setSavingIds(prev => new Set(prev).add(id));
        const result = await handleUpdateVehicle(id, updates);
        setSavingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        if (result?.ok) {
            clearEdit(id);
            showToast(`Saved ${result.vehicle?.name ?? id}.`);
        } else {
            showToast(`Save failed: ${result?.error ?? 'Unknown error'}`);
        }
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === filteredVehicles.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredVehicles.map(v => v.id)));
        }
    };

    // Bulk apply: write the chosen value to every selected vehicle via
    // sequential Supabase updates. Sequential keeps Supabase happy (no
    // connection blast) and lets us report per-row failures.
    const applyBulk = async () => {
        console.log('[admin] applyBulk invoked', { bulkField, bulkValue, selectedCount: selected.size, applyingBulk });
        if (applyingBulk) { showToast('Already applying - please wait.'); return; }
        if (selected.size === 0) { showToast('Select at least one row first.'); return; }
        if (!bulkField) { showToast('Pick a field to update.'); return; }
        if (!bulkValue) { showToast('Pick a value to apply.'); return; }
        setApplyingBulk(true);
        showToast(`Applying ${bulkField} = "${bulkValue}" to ${selected.size} vehicle${selected.size === 1 ? '' : 's'}...`);
        const ids = Array.from(selected);
        let ok = 0;
        const failures: string[] = [];
        for (const id of ids) {
            console.log('[admin] updating', id, { [bulkField]: bulkValue });
            const result = await handleUpdateVehicle(id, { [bulkField]: bulkValue } as Partial<Vehicle>);
            if (result?.ok) ok++;
            else failures.push(`${id}: ${result?.error ?? 'unknown'}`);
        }
        setApplyingBulk(false);
        setSelected(new Set());
        setBulkField('');
        setBulkValue('');
        console.log('[admin] bulk done', { ok, failed: failures.length, failures });
        if (failures.length === 0) {
            showToast(`Updated ${ok} vehicle${ok === 1 ? '' : 's'}.`);
        } else {
            showToast(`Updated ${ok}, ${failures.length} failed - check console.`);
            console.error('[admin] bulk update failures:', failures);
        }
    };

    const bulkOptions: string[] = useMemo(() => {
        if (bulkField === 'branch') return BRANCHES as unknown as string[];
        if (bulkField === 'weightCategory') return VEHICLE_CATEGORIES;
        if (bulkField === 'status') return VEHICLE_STATUSES;
        return [];
    }, [bulkField]);

    return (
        <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-4 space-y-4">
            {/* Controls: filter + bulk-action bar */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <input
                    type="text"
                    placeholder="Filter by name, registration, branch, or category…"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="w-full lg:w-96 bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {selected.size > 0 && (
                    <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 rounded-xl px-3 py-2">
                        <span className="text-xs font-black text-blue-300 uppercase tracking-widest">
                            {selected.size} selected
                        </span>
                        <select
                            value={bulkField}
                            onChange={e => { setBulkField(e.target.value as EditableField); setBulkValue(''); }}
                            className="bg-gray-900 text-white p-2 rounded-md border border-gray-700 text-xs"
                        >
                            <option value="">— field —</option>
                            <option value="branch">Branch</option>
                            <option value="weightCategory">Category</option>
                            <option value="status">Status</option>
                        </select>
                        <select
                            value={bulkValue}
                            onChange={e => setBulkValue(e.target.value)}
                            disabled={!bulkField}
                            className="bg-gray-900 text-white p-2 rounded-md border border-gray-700 text-xs disabled:opacity-50"
                        >
                            <option value="">— value —</option>
                            {bulkOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <button
                            onClick={applyBulk}
                            disabled={applyingBulk}
                            className="text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md"
                        >
                            {applyingBulk ? 'Applying…' : 'Apply'}
                        </button>
                        <button
                            onClick={() => setSelected(new Set())}
                            className="text-xs text-gray-400 hover:text-white px-2 py-2"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-700">
                        <tr>
                            <th className="p-2 w-8">
                                <input
                                    type="checkbox"
                                    checked={selected.size === filteredVehicles.length && filteredVehicles.length > 0}
                                    onChange={toggleSelectAll}
                                    className="cursor-pointer"
                                />
                            </th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Registration</th>
                            <th className="p-2">Make / Model</th>
                            <th className="p-2">Year</th>
                            <th className="p-2">Branch</th>
                            <th className="p-2">Category</th>
                            <th className="p-2">Status</th>
                            <th className="p-2">Linked Partner</th>
                            <th className="p-2 w-12"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVehicles.map(v => {
                            const category = liveValue(v, 'weightCategory') as string;
                            const partnerCandidates = (candidatesByCategory.get(category) || []).filter(c => c.id !== v.id);
                            // Keep currently-linked partner visible even if it
                            // doesn't share the (possibly newly-edited) category.
                            const currentLinkedId = liveValue(v, 'linkedVehicleId') as string | undefined;
                            const knownInList = partnerCandidates.some(c => c.id === currentLinkedId);
                            const visiblePartners = (!knownInList && currentLinkedId)
                                ? [
                                    (vehicles as Vehicle[]).find(c => c.id === currentLinkedId)!,
                                    ...partnerCandidates,
                                ].filter(Boolean)
                                : partnerCandidates;
                            const dirty = isDirty(v.id);
                            const saving = savingIds.has(v.id);
                            return (
                                <tr key={v.id} className={`border-b border-gray-700/50 hover:bg-gray-800/50 ${dirty ? 'bg-yellow-900/10' : ''}`}>
                                    <td className="p-2">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(v.id)}
                                            onChange={() => toggleSelect(v.id)}
                                            className="cursor-pointer"
                                        />
                                    </td>
                                    <td className="p-2 font-bold text-white whitespace-nowrap">{v.name}</td>
                                    <td className="p-2 font-mono text-gray-300 whitespace-nowrap">{v.registration}</td>
                                    <td className="p-2 text-gray-400 whitespace-nowrap">{v.make} {v.model}</td>
                                    <td className="p-2 text-gray-400">{v.year}</td>
                                    <td className="p-2">
                                        <select
                                            value={liveValue(v, 'branch') as Branch}
                                            onChange={e => setEdit(v.id, 'branch', e.target.value)}
                                            className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                                        >
                                            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={category}
                                            onChange={e => setEdit(v.id, 'weightCategory', e.target.value)}
                                            className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                                        >
                                            {VEHICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={liveValue(v, 'status') as VehicleStatus}
                                            onChange={e => setEdit(v.id, 'status', e.target.value)}
                                            className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                                        >
                                            {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={currentLinkedId || ''}
                                            onChange={e => setEdit(v.id, 'linkedVehicleId', e.target.value || undefined)}
                                            className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                                        >
                                            <option value="">— None —</option>
                                            {visiblePartners.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.registration})
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        {saving ? (
                                            <span className="text-blue-400 text-xs">…</span>
                                        ) : dirty ? (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => saveRow(v.id)}
                                                    title="Save changes"
                                                    className="p-1 rounded bg-green-600 hover:bg-green-500 text-white"
                                                >
                                                    <CheckCircleIcon className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => clearEdit(v.id)}
                                                    title="Discard changes"
                                                    className="p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : null}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredVehicles.length === 0 && (
                            <tr>
                                <td colSpan={10} className="text-center text-gray-500 py-8 italic">
                                    {filter ? 'No vehicles match the filter.' : 'No vehicles in the fleet yet.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FleetAssetAdmin;
