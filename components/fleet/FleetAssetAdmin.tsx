import React, { useMemo, useState } from 'react';
import { Vehicle, Branch, VehicleStatus } from '../../types';
import { BRANCHES, VEHICLE_CATEGORIES, VEHICLE_STATUSES, CATEGORY_ORDER } from '../../constants';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { LinkIcon } from '../icons/LinkIcon';

type EditableField = 'branch' | 'weightCategory' | 'status' | 'linkedVehicleId';

const FleetAssetAdmin: React.FC = () => {
    const { vehicles = [], handleUpdateVehicle } = useVehicles();
    const { showToast } = useUIState();

    const [edits, setEdits] = useState<Record<string, Partial<Vehicle>>>({});
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkField, setBulkField] = useState<EditableField | ''>('');
    const [bulkValue, setBulkValue] = useState<string>('');
    const [applyingBulk, setApplyingBulk] = useState(false);
    const [filter, setFilter] = useState('');

    // Active (non-Sold) vehicles, sorted by CATEGORY_ORDER then by name.
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

    // Group consecutive paired vehicles into single visual rows. Walk the
    // sorted list; whenever a vehicle's saved partner is also in the active
    // list and not yet rendered, fold them together. We intentionally use the
    // *saved* linkedVehicleId (not the dirty edit value) so the row doesn't
    // jump while Marc is mid-typing a pairing change.
    const groups = useMemo(() => {
        const out: Vehicle[][] = [];
        const seen = new Set<string>();
        const byId = new Map<string, Vehicle>((vehicles as Vehicle[]).map(v => [v.id, v]));
        for (const v of filteredVehicles) {
            if (seen.has(v.id)) continue;
            const partner = v.linkedVehicleId ? byId.get(v.linkedVehicleId) : undefined;
            if (partner && partner.status !== 'Sold' && !seen.has(partner.id)) {
                out.push([v, partner]);
                seen.add(v.id);
                seen.add(partner.id);
            } else {
                out.push([v]);
                seen.add(v.id);
            }
        }
        return out;
    }, [filteredVehicles, vehicles]);

    const liveValue = <K extends keyof Vehicle>(v: Vehicle, field: K): Vehicle[K] => {
        const pending = edits[v.id]?.[field];
        return pending !== undefined ? (pending as Vehicle[K]) : v[field];
    };

    const setEdit = (id: string, field: keyof Vehicle, value: any) => {
        setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), [field]: value } }));
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
        const allIds = filteredVehicles.map(v => v.id);
        if (selected.size === allIds.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(allIds));
        }
    };

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

    // Partner picker options for a given vehicle: ALL other vehicles, sorted
    // with same-category first (so a Standard Trailer sees other Standard
    // Trailers + Superlinks at the top), then everything else by category
    // order. Previously this was restricted to same-category only, which
    // hid the 6m/12m pairing case Marc actually needs.
    const partnerOptions = (forVehicle: Vehicle): Vehicle[] => {
        const liveCategory = liveValue(forVehicle, 'weightCategory') as string;
        const others = (vehicles as Vehicle[]).filter(v => v.id !== forVehicle.id);
        return others.sort((a, b) => {
            const aSame = a.weightCategory === liveCategory ? 0 : 1;
            const bSame = b.weightCategory === liveCategory ? 0 : 1;
            if (aSame !== bSame) return aSame - bSame;
            const ai = CATEGORY_ORDER.indexOf(a.weightCategory || '');
            const bi = CATEGORY_ORDER.indexOf(b.weightCategory || '');
            const aiSafe = ai === -1 ? CATEGORY_ORDER.length : ai;
            const biSafe = bi === -1 ? CATEGORY_ORDER.length : bi;
            if (aiSafe !== biSafe) return aiSafe - biSafe;
            return a.registration.localeCompare(b.registration);
        });
    };

    // Render a single editable vehicle "slice" - the inner cells for one
    // vehicle, suitable for stacking inside a grouped (paired) row.
    const renderSlice = (v: Vehicle) => {
        const category = liveValue(v, 'weightCategory') as string;
        const currentLinkedId = liveValue(v, 'linkedVehicleId') as string | undefined;
        const options = partnerOptions(v);
        const dirty = isDirty(v.id);
        const saving = savingIds.has(v.id);
        return {
            checkbox: (
                <input
                    type="checkbox"
                    checked={selected.has(v.id)}
                    onChange={() => toggleSelect(v.id)}
                    className="cursor-pointer"
                />
            ),
            name: <span className={`font-bold text-white whitespace-nowrap ${dirty ? 'text-yellow-300' : ''}`}>{v.name}</span>,
            reg: <span className="font-mono text-gray-300 whitespace-nowrap">{v.registration}</span>,
            makeModel: <span className="text-gray-400 whitespace-nowrap text-xs">{v.make} {v.model}</span>,
            year: <span className="text-gray-400 text-xs">{v.year}</span>,
            branch: (
                <select
                    value={liveValue(v, 'branch') as Branch}
                    onChange={e => setEdit(v.id, 'branch', e.target.value)}
                    className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
            ),
            category: (
                <select
                    value={category}
                    onChange={e => setEdit(v.id, 'weightCategory', e.target.value)}
                    className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                >
                    {VEHICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            ),
            status: (
                <select
                    value={liveValue(v, 'status') as VehicleStatus}
                    onChange={e => setEdit(v.id, 'status', e.target.value)}
                    className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                >
                    {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            ),
            partner: (
                <select
                    value={currentLinkedId || ''}
                    onChange={e => setEdit(v.id, 'linkedVehicleId', e.target.value || undefined)}
                    className="bg-gray-900 text-white p-1 rounded border border-gray-700 text-xs w-full"
                >
                    <option value="">— None —</option>
                    {options.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.name} ({p.registration}) · {p.weightCategory}
                        </option>
                    ))}
                </select>
            ),
            actions: saving ? (
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
            ) : null,
        };
    };

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
                        {groups.map(group => {
                            const isPair = group.length === 2;
                            const anyDirty = group.some(v => isDirty(v.id));
                            const slices = group.map(renderSlice);
                            const rowClasses = [
                                'border-b border-gray-700/50 hover:bg-gray-800/50',
                                isPair ? 'bg-blue-900/10 border-l-4 border-l-blue-500/60' : '',
                                anyDirty ? 'bg-yellow-900/10' : '',
                            ].join(' ');
                            return (
                                <tr key={group[0].id} className={rowClasses}>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.checkbox}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => (
                                                <div key={group[i].id} className="flex items-center gap-1">
                                                    {isPair && <LinkIcon className="h-3 w-3 text-blue-400 flex-shrink-0" />}
                                                    {s.name}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.reg}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.makeModel}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.year}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.branch}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.category}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.status}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top min-w-[200px]">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id}>{s.partner}</div>)}
                                        </div>
                                    </td>
                                    <td className="p-2 align-top">
                                        <div className="flex flex-col gap-2">
                                            {slices.map((s, i) => <div key={group[i].id} className="h-7 flex items-center">{s.actions}</div>)}
                                        </div>
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
