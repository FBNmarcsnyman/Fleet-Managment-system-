import React, { useEffect, useMemo, useState } from 'react';
import { useVehicles } from '../../contexts/AppContexts';
import { directSelect } from '../../lib/supabase';

// Tank reconciliation + anomaly flags: did the diesel bought into the tanks match
// what was dispensed to vehicles, and are any fills suspicious (theft / capture
// errors)? Computed from bowser_refills (in) vs fuel_entries (out) for a month.
const rand = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');
const L = (n: number) => Math.round(n).toLocaleString('en-ZA') + ' ℓ';

const FuelReconciliation: React.FC = () => {
    const { vehicles = [], fuelEntries = [], bowserRefills = [] } = useVehicles() as any;
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [personal, setPersonal] = useState<{ liters: number; cost: number }>({ liters: 0, cost: 0 });
    const [open, setOpen] = useState(true);

    const [yy, mm] = month.split('-').map(Number);
    const start = `${month}-01`;
    const next = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
    const inMonth = (d?: string) => !!d && d >= start && d < next;
    const vname = (id: string) => (vehicles as any[]).find(v => v.id === id)?.name || (vehicles as any[]).find(v => v.id === id)?.registration || '—';

    useEffect(() => {
        directSelect(`personal_vehicle_fuel?select=liters,total_cost&date=gte.${start}&date=lt.${next}`).then(({ data }) => {
            const rows = Array.isArray(data) ? data : [];
            setPersonal({ liters: rows.reduce((s, r) => s + (Number(r.liters) || 0), 0), cost: rows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0) });
        });
    }, [month]);

    const recon = useMemo(() => {
        const drops = (bowserRefills as any[]).filter(r => inMonth(r.date));
        const fills = (fuelEntries as any[]).filter(e => inMonth(e.date));
        const purchased = drops.reduce((s, r) => s + (Number(r.liters) || 0), 0);
        const purchasedValue = drops.reduce((s, r) => s + (Number(r.liters) || 0) * (Number(r.finalCostPerLiter || r.costPerLiter) || 0), 0);
        const dispensedFleet = fills.reduce((s, e) => s + (Number(e.liters) || 0), 0);
        const dispensed = dispensedFleet + personal.liters;
        return { purchased, purchasedValue, dispensedFleet, dispensed, variance: purchased - dispensed, fillsCount: fills.length, dropsCount: drops.length };
    }, [bowserRefills, fuelEntries, personal, month]);

    // Anomalies on this month's fleet fills.
    const anomalies = useMemo(() => {
        const fills = (fuelEntries as any[]).filter(e => inMonth(e.date));
        const out: { vehicle: string; date: string; litres: number; reason: string }[] = [];
        // big fills / zero
        fills.forEach(e => {
            const lit = Number(e.liters) || 0;
            if (lit <= 0) out.push({ vehicle: vname(e.vehicleId), date: e.date, litres: lit, reason: 'Zero / blank litres' });
            else if (lit > 1500) out.push({ vehicle: vname(e.vehicleId), date: e.date, litres: lit, reason: 'Unusually large fill (>1500 ℓ)' });
        });
        // duplicates same vehicle+date
        const byVehDate = new Map<string, number>();
        fills.forEach(e => { const k = `${e.vehicleId}|${e.date}`; byVehDate.set(k, (byVehDate.get(k) || 0) + 1); });
        for (const [k, n] of byVehDate) if (n > 1) { const [vid, date] = k.split('|'); out.push({ vehicle: vname(vid), date, litres: 0, reason: `${n} fills on the same day` }); }
        // odometer rollback / no movement (per vehicle, ordered)
        const byVeh = new Map<string, any[]>();
        fills.forEach(e => { const a = byVeh.get(e.vehicleId) || []; a.push(e); byVeh.set(e.vehicleId, a); });
        for (const [vid, list] of byVeh) {
            const sorted = list.filter(e => Number(e.odometer) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
            for (let i = 1; i < sorted.length; i++) {
                const prev = Number(sorted[i - 1].odometer), cur = Number(sorted[i].odometer);
                if (cur < prev) out.push({ vehicle: vname(vid), date: sorted[i].date, litres: Number(sorted[i].liters) || 0, reason: `Odometer went backwards (${Math.round(cur)} < ${Math.round(prev)})` });
            }
        }
        return out.sort((a, b) => (a.date < b.date ? 1 : -1));
    }, [fuelEntries, vehicles, month]);

    const variancePct = recon.purchased > 0 ? (recon.variance / recon.purchased) * 100 : 0;
    const varianceBad = Math.abs(variancePct) > 5 && recon.purchased > 0;

    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">🔎 Tank reconciliation &amp; fuel anomalies</h3>
                <div className="flex items-center gap-3"><input type="month" value={month} onChange={e => { e.stopPropagation(); setMonth(e.target.value); }} onClick={e => e.stopPropagation()} className="bg-gray-700 text-white p-1.5 rounded-md border border-gray-600 text-xs" /><span className="text-gray-500 text-lg">{open ? '−' : '+'}</span></div>
            </button>
            {open && (
                <div className="mt-3 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-900/40 rounded-xl p-3"><p className="text-[10px] font-black text-gray-500 uppercase">Purchased (drops)</p><p className="text-xl font-black text-white">{L(recon.purchased)}</p><p className="text-[11px] text-gray-500">{rand(recon.purchasedValue)} · {recon.dropsCount} drops</p></div>
                        <div className="bg-gray-900/40 rounded-xl p-3"><p className="text-[10px] font-black text-gray-500 uppercase">Dispensed</p><p className="text-xl font-black text-white">{L(recon.dispensed)}</p><p className="text-[11px] text-gray-500">{recon.fillsCount} fleet fills + {L(personal.liters)} personal</p></div>
                        <div className={`rounded-xl p-3 ${varianceBad ? 'bg-red-500/15 border border-red-500/30' : 'bg-gray-900/40'}`}><p className="text-[10px] font-black text-gray-500 uppercase">Variance (in − out)</p><p className={`text-xl font-black ${varianceBad ? 'text-red-300' : 'text-emerald-300'}`}>{L(recon.variance)}</p><p className="text-[11px] text-gray-500">{variancePct.toFixed(1)}% {varianceBad ? '· check!' : 'ok'}</p></div>
                        <div className="bg-gray-900/40 rounded-xl p-3"><p className="text-[10px] font-black text-gray-500 uppercase">Anomalies</p><p className={`text-xl font-black ${anomalies.length ? 'text-amber-300' : 'text-white'}`}>{anomalies.length}</p><p className="text-[11px] text-gray-500">flagged fills</p></div>
                    </div>
                    {varianceBad && <p className="text-[11px] text-red-300">⚠ Diesel purchased and dispensed differ by more than 5% — possible unrecorded fills, capture errors, or shrinkage. (A positive variance = stock built up; negative = more dispensed than bought.)</p>}
                    {anomalies.length > 0 && (
                        <div className="bg-gray-900/40 rounded-xl border border-gray-700 divide-y divide-gray-700/50 max-h-72 overflow-y-auto">
                            {anomalies.slice(0, 40).map((a, i) => (
                                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                    <div className="min-w-0"><span className="font-bold text-white">{a.vehicle}</span><span className="text-[11px] text-gray-500 ml-2">{a.date}</span></div>
                                    <div className="flex items-center gap-2 shrink-0"><span className="text-[11px] text-amber-300">{a.reason}</span>{a.litres > 0 && <span className="text-[11px] text-gray-400 font-mono">{a.litres} ℓ</span>}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {anomalies.length === 0 && <p className="text-xs text-gray-500 italic">No fill anomalies detected this month.</p>}
                </div>
            )}
        </div>
    );
};

export default FuelReconciliation;
