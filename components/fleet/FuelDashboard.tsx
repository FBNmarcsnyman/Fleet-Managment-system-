import React, { useEffect, useMemo, useState } from 'react';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import { directInvoke, directSelect, directUpdate } from '../../lib/supabase';
import FuelQuickCapture from './FuelQuickCapture';
import FuelReconciliation from './FuelReconciliation';
import { Bowser, BowserRefill, FuelEntry, FuelPriceRecord, Vehicle, VehiclePerformanceStats } from '../../types';
import DateField from '../operations/DateField';

const rand = (n: number) => 'R ' + (Math.round(n * 100) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const L = (n: number) => Math.round(n).toLocaleString('en-ZA') + ' L';
const todayStr = () => new Date().toISOString().split('T')[0];

// Vertical tank gauge for one bowser (the "bar graph" per branch).
const TankGauge: React.FC<{ bowser: Bowser; refills: BowserRefill[]; dispensedToday: number }> = ({ bowser, refills, dispensedToday }) => {
    const cap = bowser.capacity || 1;
    const level = Math.max(0, bowser.currentStock || 0);
    const pct = Math.min(100, Math.round((level / cap) * 100));
    const low = pct < 20, mid = pct < 50;
    const fill = low ? 'bg-red-500' : mid ? 'bg-amber-400' : 'bg-emerald-500';
    const sorted = [...refills].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastFill = sorted[0];
    const prevFill = sorted[1];
    const totalL = refills.reduce((s, r) => s + (r.liters || 0), 0);
    const blended = totalL > 0 ? refills.reduce((s, r) => s + (r.liters || 0) * (r.finalCostPerLiter || 0), 0) / totalL : 0;
    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 flex gap-5">
            {/* gauge */}
            <div className="flex flex-col items-center">
                <div className="relative w-16 h-40 bg-gray-900 rounded-lg border border-gray-600 overflow-hidden">
                    <div className={`absolute bottom-0 left-0 right-0 ${fill} transition-all duration-700`} style={{ height: `${pct}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white font-black text-lg drop-shadow">{pct}%</span>
                    </div>
                </div>
                <span className={`mt-2 text-[10px] font-black uppercase tracking-wider ${low ? 'text-red-400' : mid ? 'text-amber-400' : 'text-emerald-400'}`}>{low ? 'LOW' : mid ? 'OK' : 'GOOD'}</span>
            </div>
            {/* details */}
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-white">{bowser.name}</h3>
                <p className="text-3xl font-black text-white leading-tight">{L(level)}</p>
                <p className="text-xs text-gray-400 mb-3">of {L(cap)} capacity</p>
                <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-gray-400">Last filled</span><span className="text-white font-bold">{lastFill ? `${new Date(lastFill.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}${lastFill.liters ? ` · ${L(lastFill.liters)}` : ''}` : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Avg cost/L in tank</span><span className="text-white font-bold">{rand(blended)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Last fill price</span><span className="text-emerald-300 font-bold">{lastFill ? rand(lastFill.finalCostPerLiter) : '—'}</span></div>
                    {prevFill && <div className="flex justify-between"><span className="text-gray-500">Previous fill price</span><span className="text-gray-400">{rand(prevFill.finalCostPerLiter)}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-400">Dispensed today</span><span className="text-amber-300 font-bold">{L(dispensedToday)}</span></div>
                </div>
            </div>
        </div>
    );
};

const FuelDashboard: React.FC = () => {
    const v = useVehicles() as any;
    const { showModal, showToast } = useUIState();
    const bowsers: Bowser[] = v.bowsers || [];
    const bowserRefills: BowserRefill[] = v.bowserRefills || [];
    const fuelEntries: FuelEntry[] = v.fuelEntries || [];
    const prices: FuelPriceRecord[] = v.fuelPriceRecords || [];
    const vehicles: Vehicle[] = v.vehicles || [];
    const perfMap: Map<string, VehiclePerformanceStats> = v.vehiclePerformanceMap || new Map();
    const { handleAddBowserRefill } = v;

    // Editable flag thresholds (persisted locally).
    const [maxConsumption, setMaxConsumption] = useState<number>(() => Number(localStorage.getItem('fuel_max_lp100') || 55));
    const [maxCpk, setMaxCpk] = useState<number>(() => Number(localStorage.getItem('fuel_max_cpk') || 12));
    const saveThresholds = (lp100: number, cpk: number) => { localStorage.setItem('fuel_max_lp100', String(lp100)); localStorage.setItem('fuel_max_cpk', String(cpk)); };

    const today = todayStr();
    const vehReg = (id: string) => vehicles.find(x => x.id === id)?.registration || '—';

    // Latest price + previous (old vs new).
    const sortedPrices = useMemo(() => [...prices].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()), [prices]);
    const curPrice = sortedPrices[0]?.pricePerLiter || 0;
    const prevPrice = sortedPrices[1]?.pricePerLiter || 0;

    const todayFills = useMemo(() => fuelEntries.filter(e => (e.date || '').split('T')[0] === today)
        .sort((a, b) => b.odometer - a.odometer), [fuelEntries, today]);
    const dispensedTodayBy = (bowserId: string) => todayFills.filter(e => e.sourceBowserId === bowserId).reduce((s, e) => s + (e.liters || 0), 0);

    // Fleet CPK / consumption averages.
    const perfRows = useMemo(() => vehicles.map(veh => {
        const p = perfMap.get(veh.id);
        return { veh, p };
    }).filter(r => r.p && r.p.points > 0)
        .sort((a, b) => (b.p!.avgConsumption) - (a.p!.avgConsumption)), [vehicles, perfMap]);
    const fleetAvgCpk = perfRows.length ? perfRows.reduce((s, r) => s + r.p!.avgCpk, 0) / perfRows.length : 0;
    const fleetAvgCons = perfRows.length ? perfRows.reduce((s, r) => s + r.p!.avgConsumption, 0) / perfRows.length : 0;
    const flagged = (p: VehiclePerformanceStats) => p.avgConsumption > maxConsumption || p.avgCpk > maxCpk;

    // Inline supplier refill (bowser up).
    const [rfBowser, setRfBowser] = useState(bowsers[0]?.id || '');
    const [rfLiters, setRfLiters] = useState('');
    const [rfCost, setRfCost] = useState('');
    const [rfSupplier, setRfSupplier] = useState('');
    const [rfRef, setRfRef] = useState('');
    const [rfRebate, setRfRebate] = useState('');
    const [rfDate, setRfDate] = useState(today);
    const [saving, setSaving] = useState(false);
    const submitRefill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rfBowser || !rfLiters || !rfCost || !rfSupplier || !rfRef) { showToast('Fill bowser, litres, cost/L, supplier and reference.'); return; }
        setSaving(true);
        const res = await handleAddBowserRefill({
            bowserId: rfBowser, date: rfDate, liters: parseFloat(rfLiters), costPerLiter: parseFloat(rfCost),
            supplier: rfSupplier, referenceNumber: rfRef, rebatePercentage: rfRebate ? parseFloat(rfRebate) : undefined,
        });
        setSaving(false);
        if (res?.ok === false) { showToast(`Could not save refill: ${res.error}`); return; }
        showToast('Supplier refill logged — tank level updated.');
        setRfLiters(''); setRfCost(''); setRfSupplier(''); setRfRef(''); setRfRebate('');
    };

    const inp = 'w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm';

    // --- Google Drive folder auto-import (.xls monthly fuel sheets) ---
    // DBN / JHB bowser logs and the LM (loadmaster) summary live in separate
    // folders. "Import this month" reads the current month's sheet in each.
    const FUEL_BRANCHES = ['DBN', 'JHB', 'LM'];
    const [folders, setFolders] = useState<{ branch: string; folderId: string }[]>(FUEL_BRANCHES.map(b => ({ branch: b, folderId: '' })));
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<string | null>(null);
    useEffect(() => {
        directSelect('email_settings?id=eq.1&select=fuel_folders,fuel_sync_at,fuel_sync_result').then(({ data }) => {
            const c = Array.isArray(data) ? data[0] : null;
            if (Array.isArray(c?.fuel_folders)) setFolders(FUEL_BRANCHES.map(b => ({ branch: b, folderId: (c.fuel_folders.find((x: any) => x.branch === b)?.folderId) || '' })));
            if (c?.fuel_sync_result) setLastSync(`${c.fuel_sync_result}${c.fuel_sync_at ? ' · ' + new Date(c.fuel_sync_at).toLocaleString('en-ZA') : ''}`);
        });
    }, []);
    const normId = (s: string) => s.includes('/folders/') ? s.split('/folders/')[1].split(/[/?]/)[0] : s.trim();
    const setFolder = (branch: string, v: string) => setFolders(p => p.map(f => f.branch === branch ? { ...f, folderId: v } : f));
    const saveFolders = async () => {
        await directUpdate('email_settings', { id: '1' }, { fuel_folders: folders.map(f => ({ branch: f.branch, folderId: normId(f.folderId) })) });
        showToast('Fuel folders saved.');
    };
    const importNow = async () => {
        setSyncing(true); setSyncMsg(null);
        const norm = folders.filter(f => f.folderId.trim()).map(f => ({ branch: f.branch, folderId: normId(f.folderId) }));
        const { data, error } = await directInvoke('fuel-xls-import', { mode: 'auto', dryRun: false, folders: norm });
        setSyncing(false);
        if (error || data?.error) { setSyncMsg(`Import failed: ${data?.error || error?.message}`); return; }
        const t = data.totals || {};
        setSyncMsg(`Imported ${data.month}: ${t.fleetFills} fills · ${Number(t.fleetLiters || 0).toLocaleString('en-ZA')} ℓ · R${Number(t.fleetSpend || 0).toLocaleString('en-ZA')}; ${t.refills} tank drops; ${t.personalFills} personal. Refresh to see updates.`);
        showToast(`Fuel imported: ${t.fleetFills} fills, ${t.refills} drops.`);
    };

    return (
        <div className="space-y-6">
            {/* Google Drive auto-import (.xls monthly fuel sheets) */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Import fuel month from Google Drive</h3>
                <p className="text-[11px] text-gray-500 mb-3">Link each monthly-fuel folder (DBN &amp; JHB bowser logs, LM loadmaster summary). <b>Import this month</b> reads the current month's sheet in each — vehicle fills with cost, tank drops, and km/CPK — and replaces the month so there are no duplicates. Unknown registrations go to the personal-vehicles list. Folders must be shared with the FBN service account.</p>
                <div className="space-y-2">
                    {folders.map(f => (
                        <div key={f.branch} className="flex flex-wrap gap-2 items-center">
                            <span className="w-10 text-xs font-black text-gray-400 uppercase">{f.branch}</span>
                            <input value={f.folderId} onChange={e => setFolder(f.branch, e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={`${inp} flex-1 min-w-[240px]`} />
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-3">
                    <button onClick={saveFolders} className="bg-gray-600 hover:bg-gray-500 text-white font-bold px-4 py-2 rounded-md text-xs uppercase tracking-wider">Save folders</button>
                    <button onClick={importNow} disabled={syncing} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-md text-xs uppercase tracking-wider">{syncing ? 'Importing…' : 'Import this month'}</button>
                </div>
                {syncMsg && <p className="text-[11px] mt-2 text-emerald-300">{syncMsg}</p>}
                {!syncMsg && lastSync && <p className="text-[11px] mt-2 text-gray-500">Last import — {lastSync}</p>}
            </div>
            {/* Quick fillings capture */}
            <FuelQuickCapture />

            {/* Tank reconciliation + anomalies */}
            <FuelReconciliation />

            {/* Bowser gauges */}
            <div>
                <h2 className="text-lg font-black text-white mb-3 uppercase tracking-wide">Tank Levels</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bowsers.length === 0 && <p className="text-gray-500 text-sm">No bowsers set up.</p>}
                    {bowsers.map(b => <TankGauge key={b.id} bowser={b} refills={bowserRefills.filter(r => r.bowserId === b.id)} dispensedToday={dispensedTodayBy(b.id)} />)}
                </div>
            </div>

            {/* Price + supplier refill */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Diesel Price / L</h3>
                    <p className="text-3xl font-black text-white">{rand(curPrice)}</p>
                    {prevPrice > 0 && (
                        <p className={`text-xs font-bold mt-1 ${curPrice > prevPrice ? 'text-red-400' : 'text-emerald-400'}`}>
                            {curPrice > prevPrice ? '▲' : '▼'} from {rand(prevPrice)} (was)
                        </p>
                    )}
                </div>
                <form onSubmit={submitRefill} className="bg-gray-800 rounded-2xl border border-gray-700 p-5 lg:col-span-2">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Supplier Refill — tank goes UP</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <select value={rfBowser} onChange={e => setRfBowser(e.target.value)} className={inp}>
                            <option value="">Bowser…</option>{bowsers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <DateField value={rfDate} onChange={v => setRfDate(v)} className={inp} />
                        <input value={rfLiters} onChange={e => setRfLiters(e.target.value)} placeholder="Litres" type="number" className={inp} />
                        <input value={rfCost} onChange={e => setRfCost(e.target.value)} placeholder="Cost/L (ex VAT)" type="number" step="0.01" className={inp} />
                        <input value={rfSupplier} onChange={e => setRfSupplier(e.target.value)} placeholder="Supplier" className={inp} />
                        <input value={rfRef} onChange={e => setRfRef(e.target.value)} placeholder="Invoice / ref #" className={inp} />
                        <input value={rfRebate} onChange={e => setRfRebate(e.target.value)} placeholder="Rebate %" type="number" step="0.01" className={inp} />
                        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-md text-xs uppercase tracking-wider">{saving ? 'Saving…' : 'Log Refill'}</button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">Truck fills (tank goes DOWN) are logged on the Fuel &amp; Costs tab — choose the bowser as the source and the level drops automatically.</p>
                </form>
            </div>

            {/* Today's fillings */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Today's Fillings ({todayFills.length})</h3>
                <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-sm">
                        <thead className="text-gray-500"><tr className="border-b border-gray-700">
                            <th className="p-2">Vehicle</th><th className="p-2 text-right">Litres</th><th className="p-2 text-right">Odometer</th><th className="p-2">From bowser</th>
                        </tr></thead>
                        <tbody>
                            {todayFills.map(e => (
                                <tr key={e.id} className="border-b border-gray-700/40">
                                    <td className="p-2 font-bold text-blue-300">{vehReg(e.vehicleId)}</td>
                                    <td className="p-2 text-right text-white">{L(e.liters)}</td>
                                    <td className="p-2 text-right text-gray-400 font-mono">{Math.round(e.odometer).toLocaleString()}</td>
                                    <td className="p-2 text-gray-400">{e.sourceBowserId ? (bowsers.find(b => b.id === e.sourceBowserId)?.name || 'Bowser') : 'Card / station'}</td>
                                </tr>
                            ))}
                            {todayFills.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500 italic">No fills logged today yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CPK / efficiency */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Vehicle Efficiency &amp; CPK</h3>
                    <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-gray-400">Fleet avg CPK <b className="text-white">{rand(fleetAvgCpk)}/km</b></span>
                        <span className="text-gray-400">Fleet avg <b className="text-white">{fleetAvgCons.toFixed(1)}</b> L/100km</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 mb-3 text-[11px] text-gray-400">
                    <label>Flag if worse than</label>
                    <input type="number" defaultValue={maxConsumption} onBlur={e => { const n = Number(e.target.value); setMaxConsumption(n); saveThresholds(n, maxCpk); }} className="w-16 bg-gray-700 text-white p-1 rounded border border-gray-600" /> L/100km
                    <label>or</label>
                    <input type="number" defaultValue={maxCpk} step="0.5" onBlur={e => { const n = Number(e.target.value); setMaxCpk(n); saveThresholds(maxConsumption, n); }} className="w-16 bg-gray-700 text-white p-1 rounded border border-gray-600" /> R/km
                </div>
                <div className="overflow-x-auto max-h-[28rem]">
                    <table className="w-full text-left text-sm">
                        <thead className="text-gray-500 sticky top-0 bg-gray-800"><tr className="border-b border-gray-700">
                            <th className="p-2">Vehicle</th><th className="p-2 text-right">L/100km</th><th className="p-2 text-right">CPK (R/km)</th>
                            <th className="p-2 text-right">Distance</th><th className="p-2 text-right">Litres</th><th className="p-2 text-center">Flag</th>
                        </tr></thead>
                        <tbody>
                            {perfRows.map(({ veh, p }) => {
                                const bad = flagged(p!);
                                return (
                                    <tr key={veh.id} className={`border-b border-gray-700/40 ${bad ? 'bg-red-900/20' : ''}`}>
                                        <td className="p-2 font-bold text-blue-300">{veh.registration}</td>
                                        <td className={`p-2 text-right font-bold ${p!.avgConsumption > maxConsumption ? 'text-red-400' : 'text-white'}`}>{p!.avgConsumption.toFixed(1)}</td>
                                        <td className={`p-2 text-right font-bold ${p!.avgCpk > maxCpk ? 'text-red-400' : 'text-white'}`}>{rand(p!.avgCpk)}</td>
                                        <td className="p-2 text-right text-gray-400">{Math.round(p!.totalDistance).toLocaleString()} km</td>
                                        <td className="p-2 text-right text-gray-400">{L(p!.totalLitres)}</td>
                                        <td className="p-2 text-center">{bad ? <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">⚠ CHECK</span> : <span className="text-emerald-500">✓</span>}</td>
                                    </tr>
                                );
                            })}
                            {perfRows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500 italic">Not enough fuel data yet to calculate efficiency.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FuelDashboard;
