import React, { useMemo, useState } from 'react';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import DateField from '../operations/DateField';

// Fast inline fillings capture: pick a branch (LM first, then DBN, JHB), the
// branch's vehicles come up in a list with their odometer ready, type litres +
// odometer per truck and save them all in one go.
const BRANCH_RANK: Record<string, number> = { 'LOADMASTER': 0, 'FBN DBN': 1, 'FBN JHB': 2, 'FBN CPT': 3 };
const MAIN_BRANCHES = ['LOADMASTER', 'FBN DBN', 'FBN JHB', 'FBN CPT'];
const BRANCH_OPTS = [
    { v: 'LOADMASTER', label: 'Loadmaster (LM)' },
    { v: 'FBN DBN', label: 'Durban' },
    { v: 'FBN JHB', label: 'Johannesburg' },
    { v: 'FBN CPT', label: 'Cape Town' },
    { v: 'PRIVATE', label: 'Private / Other' },
    { v: 'ALL', label: 'All branches' },
];

const FuelQuickCapture: React.FC = () => {
    const { vehicles = [], fuelPriceRecords = [], handleAddFuelEntry } = useVehicles() as any;
    const { showToast } = useUIState();
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);
    const [branch, setBranch] = useState<string>('LOADMASTER');
    const [date, setDate] = useState(today);
    const [time, setTime] = useState(nowTime);
    const [filledBy, setFilledBy] = useState('');
    const [rows, setRows] = useState<Record<string, { odo: string; litres: string }>>({});
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);

    const curPrice = useMemo(() => {
        const sorted = [...(fuelPriceRecords as any[])].sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
        return sorted[0]?.pricePerLiter || 0;
    }, [fuelPriceRecords]);

    const list = useMemo(() => (vehicles as any[])
        .filter(v => v.status !== 'Sold')
        .filter(v => branch === 'ALL' || (branch === 'PRIVATE' ? !MAIN_BRANCHES.includes(v.branch) : v.branch === branch))
        .sort((a, b) => (BRANCH_RANK[a.branch] ?? 9) - (BRANCH_RANK[b.branch] ?? 9) || String(a.name || a.registration).localeCompare(String(b.name || b.registration))),
        [vehicles, branch]);

    const set = (vid: string, k: 'odo' | 'litres', val: string) => setRows(p => ({ ...p, [vid]: { odo: p[vid]?.odo ?? '', litres: p[vid]?.litres ?? '', [k]: val } }));
    const entered = Object.entries(rows).filter(([, r]) => Number(r.litres) > 0);

    const saveAll = async () => {
        if (!entered.length) { showToast('Enter litres on at least one vehicle.'); return; }
        setBusy(true);
        let ok = 0;
        const noteBase = [filledBy ? `Filled by ${filledBy.toUpperCase()}` : '', time ? `at ${time}` : ''].filter(Boolean).join(' ');
        for (const [vid, r] of entered) {
            const v = (vehicles as any[]).find(x => x.id === vid);
            const odo = Number(r.odo) || v?.currentOdometer || 0;
            const litres = Number(r.litres);
            const res = await handleAddFuelEntry(vid, {
                date, odometer: odo, liters: litres,
                notes: noteBase || undefined,
                costPerLiter: curPrice || undefined,
                totalCost: curPrice ? +(litres * curPrice).toFixed(2) : undefined,
            } as any);
            if (!(res && res.ok === false)) ok++;
        }
        setBusy(false);
        setRows({});
        showToast(`${ok} filling${ok !== 1 ? 's' : ''} captured.`);
    };

    const inp = 'w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm';

    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">⛽ Quick capture fillings</h3>
                <span className="text-gray-500 text-lg">{open ? '−' : '+'}</span>
            </button>
            {open && (
                <div className="mt-3">
                    <div className="flex flex-wrap items-end gap-2 mb-3">
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Branch</label>
                            <select value={branch} onChange={e => setBranch(e.target.value)} className={inp}>{BRANCH_OPTS.map(b => <option key={b.v} value={b.v}>{b.label}</option>)}</select></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Date</label><DateField value={date} onChange={v => setDate(v)} className={inp} /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Time</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={inp} /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Filled by</label><input value={filledBy} onChange={e => setFilledBy(e.target.value)} placeholder="who filled" className={inp} /></div>
                        <button onClick={saveAll} disabled={busy || !entered.length} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black px-5 py-2 rounded-lg text-sm uppercase tracking-wider">{busy ? 'Saving…' : `Save ${entered.length || ''} filling${entered.length === 1 ? '' : 's'}`}</button>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="text-[10px] text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-800"><tr>
                                <th className="pb-1">Vehicle</th><th className="pb-1 w-32">Odometer</th><th className="pb-1 w-28">Litres</th>
                            </tr></thead>
                            <tbody>
                                {list.map(v => (
                                    <tr key={v.id} className="border-t border-gray-700/40">
                                        <td className="py-1.5 pr-2">
                                            <span className="font-bold text-white text-sm">{v.name || v.registration}</span>
                                            <span className="text-[11px] text-gray-500 ml-2">{v.registration}{v.branch ? ` · ${String(v.branch).replace('FBN ', '')}` : ''}</span>
                                        </td>
                                        <td className="py-1.5 pr-2"><input type="number" value={rows[v.id]?.odo ?? ''} onChange={e => set(v.id, 'odo', e.target.value)} placeholder={v.currentOdometer ? String(Math.round(v.currentOdometer)) : 'odo'} className={inp} /></td>
                                        <td className="py-1.5 pr-2"><input type="number" value={rows[v.id]?.litres ?? ''} onChange={e => set(v.id, 'litres', e.target.value)} placeholder="litres" className={inp} /></td>
                                    </tr>
                                ))}
                                {list.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-gray-500 text-sm">No vehicles for this branch.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FuelQuickCapture;
