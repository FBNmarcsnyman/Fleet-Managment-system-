import React, { useMemo, useState } from 'react';
import { Vehicle, FuelEntry } from '../../types';
import { useVehicles } from '../../contexts/AppContexts';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';

interface Props {
    vehicle: Vehicle;
    fuelEntries: FuelEntry[];
}

interface DraftEntry {
    date: string;
    odometer: string;
    liters: string;
    tripDistance: string;
}

const emptyDraft = (): DraftEntry => ({
    date: new Date().toISOString().split('T')[0],
    odometer: '',
    liters: '',
    tripDistance: '',
});

const toDraft = (e: FuelEntry): DraftEntry => ({
    date: (e.date || '').split('T')[0],
    odometer: String(e.odometer ?? ''),
    liters: String(e.liters ?? ''),
    tripDistance: e.tripDistance != null ? String(e.tripDistance) : '',
});

const VehicleFuelLog: React.FC<Props> = ({ vehicle, fuelEntries }) => {
    const { handleAddFuelEntry, handleUpdateFuelEntry, handleDeleteFuelEntry } = useVehicles() as any;
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<DraftEntry>(emptyDraft());
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false);

    // Rows sorted by odometer to compute per-fill consumption, then displayed newest-first.
    const rows = useMemo(() => {
        const byOdo = [...(fuelEntries || [])].sort((a, b) => a.odometer - b.odometer);
        const consMap = new Map<string, number | null>();
        for (let i = 0; i < byOdo.length; i++) {
            const curr = byOdo[i];
            const prev = byOdo[i - 1];
            const dist = curr.tripDistance ?? (prev ? curr.odometer - prev.odometer : null);
            consMap.set(curr.id, dist && dist > 0 && curr.liters > 0 ? (curr.liters / dist) * 100 : null);
        }
        return [...(fuelEntries || [])]
            .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.odometer - a.odometer)
            .map(e => ({ entry: e, consumption: consMap.get(e.id) ?? null }));
    }, [fuelEntries]);

    const validate = (d: DraftEntry): string | null => {
        if (!d.date) return 'Date is required.';
        if (d.odometer === '' || isNaN(Number(d.odometer))) return 'Valid odometer is required.';
        if (d.liters === '' || isNaN(Number(d.liters)) || Number(d.liters) <= 0) return 'Valid litres is required.';
        return null;
    };

    const beginEdit = (e: FuelEntry) => {
        setAdding(false);
        setEditingId(e.id);
        setDraft(toDraft(e));
    };

    const beginAdd = () => {
        setEditingId(null);
        setDraft({ ...emptyDraft(), odometer: String(vehicle.currentOdometer ?? '') });
        setAdding(true);
    };

    const cancel = () => {
        setEditingId(null);
        setAdding(false);
        setDraft(emptyDraft());
    };

    const saveEdit = async (id: string) => {
        const err = validate(draft);
        if (err) { alert(err); return; }
        setBusy(true);
        const res = await handleUpdateFuelEntry({
            id,
            vehicleId: vehicle.id,
            date: draft.date,
            odometer: Number(draft.odometer),
            liters: Number(draft.liters),
            tripDistance: draft.tripDistance ? Number(draft.tripDistance) : undefined,
        });
        setBusy(false);
        if (res && res.ok === false) { alert(`Could not save the change: ${res.error || 'unknown error'}`); return; }
        cancel();
    };

    const saveAdd = async () => {
        const err = validate(draft);
        if (err) { alert(err); return; }
        setBusy(true);
        const res = await handleAddFuelEntry(vehicle.id, {
            date: draft.date,
            odometer: Number(draft.odometer),
            liters: Number(draft.liters),
            tripDistance: draft.tripDistance ? Number(draft.tripDistance) : undefined,
        });
        setBusy(false);
        if (res && res.ok === false) { alert(`Could not save the fuel entry: ${res.error || 'unknown error'}`); return; }
        cancel();
    };

    const remove = async (e: FuelEntry) => {
        if (!window.confirm(`Delete the fuel entry on ${(e.date || '').split('T')[0]} (${e.liters} L @ ${e.odometer.toLocaleString()} km)?`)) return;
        setBusy(true);
        const res = await handleDeleteFuelEntry(e.id);
        setBusy(false);
        if (res && res.ok === false) { alert(`Could not delete the entry: ${res.error || 'unknown error'}`); }
    };

    const inputCls = 'w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary text-sm';

    const DraftRow: React.FC<{ onSave: () => void }> = ({ onSave }) => (
        <tr className="bg-gray-700/40">
            <td className="p-2"><input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} className={inputCls} /></td>
            <td className="p-2"><input type="number" step="1" placeholder="km" value={draft.odometer} onChange={e => setDraft({ ...draft, odometer: e.target.value })} className={inputCls} /></td>
            <td className="p-2"><input type="number" step="0.01" placeholder="L" value={draft.liters} onChange={e => setDraft({ ...draft, liters: e.target.value })} className={inputCls} /></td>
            <td className="p-2"><input type="number" step="1" placeholder="optional" value={draft.tripDistance} onChange={e => setDraft({ ...draft, tripDistance: e.target.value })} className={inputCls} /></td>
            <td className="p-2 text-gray-500 text-sm">—</td>
            <td className="p-2">
                <div className="flex gap-2 justify-end">
                    <button disabled={busy} onClick={onSave} className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-bold disabled:opacity-50">Save</button>
                    <button disabled={busy} onClick={cancel} className="px-3 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold">Cancel</button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-xl font-semibold text-white">Fuel Log</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{rows.length} entries · {vehicle.name} ({vehicle.registration})</p>
                </div>
                <button onClick={beginAdd} disabled={adding} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white text-sm disabled:opacity-50">
                    <PlusIcon className="h-4 w-4 mr-2" /> Add Entry
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                            <th className="p-2">Date</th>
                            <th className="p-2">Odometer (km)</th>
                            <th className="p-2">Litres</th>
                            <th className="p-2">Trip (km)</th>
                            <th className="p-2">L/100km</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {adding && <DraftRow onSave={saveAdd} />}
                        {rows.length === 0 && !adding && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500">No fuel entries yet. Click “Add Entry” to log one.</td></tr>
                        )}
                        {rows.map(({ entry, consumption }) => (
                            editingId === entry.id ? (
                                <DraftRow key={entry.id} onSave={() => saveEdit(entry.id)} />
                            ) : (
                                <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                    <td className="p-2 text-white">{(entry.date || '').split('T')[0]}</td>
                                    <td className="p-2 text-gray-300 font-mono">{entry.odometer.toLocaleString()}</td>
                                    <td className="p-2 text-gray-300 font-mono">{entry.liters}</td>
                                    <td className="p-2 text-gray-400 font-mono">{entry.tripDistance != null ? entry.tripDistance.toLocaleString() : '—'}</td>
                                    <td className="p-2 font-mono text-amber-400">{consumption != null ? consumption.toFixed(1) : '—'}</td>
                                    <td className="p-2">
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => beginEdit(entry)} className="px-3 py-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold">Edit</button>
                                            <button onClick={() => remove(entry)} disabled={busy} className="p-1.5 rounded bg-red-900/50 hover:bg-red-700 text-red-300 hover:text-white disabled:opacity-50" title="Delete">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default React.memo(VehicleFuelLog);
