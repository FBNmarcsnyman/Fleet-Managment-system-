import React, { useMemo, useState } from 'react';
import { Vehicle, CalculatedFuelEntry, VehiclePerformanceStats } from '../../types';
import { useVehicles } from '../../contexts/AppContexts';

// Fuel → By Vehicle: every asset's fill history + running CPK / consumption,
// filterable by branch and category. Click a row to see its fills. Worst CPK
// first so the thirsty units stand out.
const fmtR = (n: number) => `R ${(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = (s?: string) => { if (!s) return '—'; const d = new Date(s); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' }); };

const VehicleFuelView: React.FC = () => {
    const { vehicles = [], vehiclePerformanceMap = new Map(), calculatedFuelData = [] } = useVehicles() as any;
    const [branch, setBranch] = useState('All');
    const [cat, setCat] = useState('All');
    const [q, setQ] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);

    const branches = useMemo(() => ['All', ...Array.from(new Set((vehicles as Vehicle[]).map(v => v.branch).filter(Boolean)))], [vehicles]);
    const cats = useMemo(() => ['All', ...Array.from(new Set((vehicles as Vehicle[]).map(v => v.weightCategory).filter(Boolean))).sort()], [vehicles]);

    const fillsByVehicle = useMemo(() => {
        const m = new Map<string, CalculatedFuelEntry[]>();
        (calculatedFuelData as CalculatedFuelEntry[]).forEach(e => { if (!m.has(e.vehicleId)) m.set(e.vehicleId, []); m.get(e.vehicleId)!.push(e); });
        m.forEach(list => list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        return m;
    }, [calculatedFuelData]);

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (vehicles as Vehicle[])
            .filter(v => v.status !== 'Sold')
            .filter(v => branch === 'All' || v.branch === branch)
            .filter(v => cat === 'All' || v.weightCategory === cat)
            .filter(v => !needle || `${v.name || ''} ${v.registration || ''}`.toLowerCase().includes(needle))
            .map(v => ({ v, stats: vehiclePerformanceMap.get(v.id) as VehiclePerformanceStats | undefined, fills: fillsByVehicle.get(v.id) || [] }))
            .sort((a, b) => (b.stats?.avgCpk || 0) - (a.stats?.avgCpk || 0));
    }, [vehicles, branch, cat, q, vehiclePerformanceMap, fillsByVehicle]);

    // Totals across the filtered set.
    const totals = useMemo(() => {
        let litres = 0, cost = 0, dist = 0;
        rows.forEach(r => { litres += r.stats?.totalLitres || 0; cost += r.stats?.totalCost || 0; dist += r.stats?.totalDistance || 0; });
        return { litres, cost, dist, cpk: dist > 0 ? cost / dist : 0 };
    }, [rows]);

    const isTrailer = (v: Vehicle) => /trailer|triaxle|skeleton|superlink/i.test(v.weightCategory || '');
    const sel = 'bg-white text-slate-800 p-2 rounded-lg border border-slate-300 text-sm';
    const Card: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`text-xl font-black ${tone || 'text-slate-900'}`}>{value}</div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card label="Vehicles" value={`${rows.length}`} />
                <Card label="Total spend" value={fmtR(totals.cost)} />
                <Card label="Total litres" value={`${Math.round(totals.litres).toLocaleString()} L`} />
                <Card label="Fleet avg CPK" value={fmtR(totals.cpk)} tone="text-emerald-700" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search reg / fleet no…" className={`${sel} w-48`} />
                <select value={branch} onChange={e => setBranch(e.target.value)} className={sel}>{branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}</select>
                <select value={cat} onChange={e => setCat(e.target.value)} className={sel}>{cats.map(c => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}</select>
                <span className="text-xs text-slate-400 ml-auto">Worst CPK first</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2 pl-3 px-2">Vehicle</th><th className="py-2 px-2">Branch</th><th className="py-2 px-2 text-right">Fills</th>
                        <th className="py-2 px-2 text-right">Latest odo</th><th className="py-2 px-2 text-right">Avg L/100km</th>
                        <th className="py-2 px-2 text-right">Avg CPK</th><th className="py-2 px-2 text-right pr-3">Spend</th>
                    </tr></thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No vehicles in this filter.</td></tr>}
                        {rows.map(({ v, stats, fills }) => {
                            const open = openId === v.id;
                            const trailer = isTrailer(v);
                            return (
                                <React.Fragment key={v.id}>
                                    <tr onClick={() => setOpenId(open ? null : v.id)} className="border-b border-slate-100 cursor-pointer hover:bg-blue-50/40">
                                        <td className="py-2 pl-3 px-2"><span className="font-bold text-[#13294b]">{v.name}</span> <span className="text-slate-400 text-xs">{v.registration}</span><div className="text-[10px] text-slate-400">{v.weightCategory}</div></td>
                                        <td className="py-2 px-2 text-slate-500">{v.branch === 'LOADMASTER' ? 'LM' : (v.branch || '').replace('FBN ', '')}</td>
                                        <td className="py-2 px-2 text-right text-slate-600">{stats?.points || 0}</td>
                                        <td className="py-2 px-2 text-right text-slate-600">{stats?.latestOdo ? stats.latestOdo.toLocaleString() : '—'}</td>
                                        <td className="py-2 px-2 text-right text-slate-600">{trailer ? '—' : (stats?.avgConsumption ? stats.avgConsumption.toFixed(1) : '—')}</td>
                                        <td className="py-2 px-2 text-right font-bold text-slate-800">{stats?.avgCpk ? fmtR(stats.avgCpk) : '—'}</td>
                                        <td className="py-2 px-2 text-right pr-3 text-slate-600">{stats?.totalCost ? fmtR(stats.totalCost) : '—'}</td>
                                    </tr>
                                    {open && (
                                        <tr className="bg-slate-50"><td colSpan={7} className="px-4 py-3">
                                            {fills.length === 0 ? <p className="text-slate-400 text-xs">No fuel fills recorded for {v.name}.</p> : (
                                                <table className="w-full text-xs">
                                                    <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                                                        <th className="py-1 px-2">Date</th><th className="py-1 px-2 text-right">Odo</th><th className="py-1 px-2 text-right">Litres</th><th className="py-1 px-2 text-right">Cost</th><th className="py-1 px-2 text-right">L/100km</th><th className="py-1 px-2 text-right">R/km</th>
                                                    </tr></thead>
                                                    <tbody>{fills.slice(0, 60).map((f, i) => (
                                                        <tr key={i} className="border-t border-slate-200">
                                                            <td className="py-1 px-2 text-slate-700">{fmtD(f.date)}</td>
                                                            <td className="py-1 px-2 text-right text-slate-600">{f.odometer ? f.odometer.toLocaleString() : '—'}</td>
                                                            <td className="py-1 px-2 text-right text-slate-600">{f.liters?.toFixed(1)}</td>
                                                            <td className="py-1 px-2 text-right text-slate-600">{fmtR(f.cost)}</td>
                                                            <td className="py-1 px-2 text-right text-slate-600">{f.consumption ? f.consumption.toFixed(1) : '—'}</td>
                                                            <td className="py-1 px-2 text-right text-slate-600">{f.cpk ? fmtR(f.cpk) : '—'}</td>
                                                        </tr>
                                                    ))}</tbody>
                                                </table>
                                            )}
                                        </td></tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default VehicleFuelView;
