import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Client, Supplier } from '../../types';
import { useOperations } from '../../contexts/AppContexts';

const money = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');
const pct = (n: number) => `${n.toFixed(0)}%`;

// Margin dashboard + carrier scorecard, computed from load data (no schema needs).
const BrokingAnalytics: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [] } = useOperations();
    const [period, setPeriod] = useState<'all' | '30' | '90'>('all');

    const clientMap = useMemo(() => new Map<string, string>((clients as Client[]).map(c => [c.id, c.name])), [clients]);
    const supplierMap = useMemo(() => new Map<string, string>((suppliers as Supplier[]).map(s => [s.id, s.name])), [suppliers]);

    const loads = useMemo(() => {
        const cutoff = period === 'all' ? 0 : Date.now() - Number(period) * 86400000;
        return (loadConfirmations as LoadConfirmation[]).filter(lc =>
            lc.status !== 'Cancelled' && (lc.supplierRate || 0) > 0 &&
            (period === 'all' || new Date(lc.date).getTime() >= cutoff));
    }, [loadConfirmations, period]);

    const kpis = useMemo(() => {
        let rev = 0, cost = 0;
        loads.forEach(lc => { rev += lc.totalAmount || 0; cost += lc.supplierRate || 0; });
        const margin = rev - cost;
        return { rev, cost, margin, marginPct: rev > 0 ? (margin / rev) * 100 : 0, count: loads.length };
    }, [loads]);

    // Carrier scorecard
    const carriers = useMemo(() => {
        const m = new Map<string, { name: string; loads: number; delivered: number; pod: number; accepted: number; rev: number; cost: number }>();
        loads.forEach(lc => {
            const id = lc.supplierId || lc.subcontractorName || 'Unknown';
            const name = (lc.supplierId && supplierMap.get(lc.supplierId)) || lc.subcontractorName || 'Unknown';
            const e = m.get(id) || { name, loads: 0, delivered: 0, pod: 0, accepted: 0, rev: 0, cost: 0 };
            e.loads++;
            if (['Delivered', 'POD Submitted', 'Invoiced'].includes(lc.status)) e.delivered++;
            if (lc.podPhoto) e.pod++;
            if ((lc as any).acceptedAt) e.accepted++;
            e.rev += lc.totalAmount || 0; e.cost += lc.supplierRate || 0;
            m.set(id, e);
        });
        return Array.from(m.values()).sort((a, b) => b.loads - a.loads).slice(0, 12);
    }, [loads, supplierMap]);

    // Top lanes by margin
    const lanes = useMemo(() => {
        const m = new Map<string, { lane: string; loads: number; margin: number }>();
        loads.forEach(lc => {
            const lane = lc.route || `${lc.collectionPoint || '?'} → ${lc.deliveryPoint || '?'}`;
            const e = m.get(lane) || { lane, loads: 0, margin: 0 };
            e.loads++; e.margin += (lc.totalAmount || 0) - (lc.supplierRate || 0);
            m.set(lane, e);
        });
        return Array.from(m.values()).sort((a, b) => b.margin - a.margin).slice(0, 6);
    }, [loads]);

    // Top clients by margin
    const topClients = useMemo(() => {
        const m = new Map<string, { name: string; loads: number; rev: number; margin: number }>();
        loads.forEach(lc => {
            const id = lc.clientId || lc.clientName || 'Unknown';
            const name = (lc.clientId && clientMap.get(lc.clientId)) || lc.clientName || 'Unknown';
            const e = m.get(id) || { name, loads: 0, rev: 0, margin: 0 };
            e.loads++; e.rev += lc.totalAmount || 0; e.margin += (lc.totalAmount || 0) - (lc.supplierRate || 0);
            m.set(id, e);
        });
        return Array.from(m.values()).sort((a, b) => b.margin - a.margin).slice(0, 6);
    }, [loads, clientMap]);

    const lowMargin = useMemo(() => loads.filter(lc => {
        const t = lc.totalAmount || 0; const s = lc.supplierRate || 0;
        return t > 0 && ((t - s) / t) * 100 < 10;
    }), [loads]);

    // Headline callouts: best transporter (most loads, then margin), most profitable lane, avg margin/load.
    const highlights = useMemo(() => {
        const bestCarrier = [...carriers].sort((a, b) => (b.loads - a.loads) || ((b.rev - b.cost) - (a.rev - a.cost)))[0];
        const bestLane = lanes[0];
        const avgPerLoad = loads.length ? kpis.margin / loads.length : 0;
        return { bestCarrier, bestLane, avgPerLoad };
    }, [carriers, lanes, loads, kpis]);

    const Card: React.FC<{ label: string; value: string; sub?: string; accent?: string }> = ({ label, value, sub, accent }) => (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-black ${accent || 'text-white'}`}>{value}</p>
            {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
        </div>
    );

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Broking Performance</h3>
                <select value={period} onChange={e => setPeriod(e.target.value as any)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm">
                    <option value="all">All time</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                </select>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Card label="Loads" value={String(kpis.count)} />
                <Card label="Client Revenue" value={money(kpis.rev)} />
                <Card label="Transporter Cost" value={money(kpis.cost)} />
                <Card label="Gross Margin" value={money(kpis.margin)} accent="text-emerald-400" sub={pct(kpis.marginPct)} />
                <Card label="Low-margin loads" value={String(lowMargin.length)} accent={lowMargin.length ? 'text-amber-400' : 'text-white'} sub="under 10%" />
            </div>

            {/* Headline callouts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-emerald-900/40 to-gray-800 rounded-xl p-4 border border-emerald-700/30">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Best Transporter</p>
                    <p className="text-lg font-black text-white truncate">{highlights.bestCarrier?.name || '—'}</p>
                    <p className="text-[11px] text-gray-400">{highlights.bestCarrier ? `${highlights.bestCarrier.loads} loads · ${money(highlights.bestCarrier.rev - highlights.bestCarrier.cost)} margin` : ''}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-900/40 to-gray-800 rounded-xl p-4 border border-blue-700/30">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Most Profitable Lane</p>
                    <p className="text-sm font-black text-white truncate">{highlights.bestLane?.lane || '—'}</p>
                    <p className="text-[11px] text-gray-400">{highlights.bestLane ? `${money(highlights.bestLane.margin)} over ${highlights.bestLane.loads} loads` : ''}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-900/40 to-gray-800 rounded-xl p-4 border border-purple-700/30">
                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Avg Margin / Load</p>
                    <p className="text-lg font-black text-white">{money(highlights.avgPerLoad)}</p>
                    <p className="text-[11px] text-gray-400">across {kpis.count} loads</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Carrier Scorecard</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead><tr className="text-gray-500 border-b border-gray-700">
                                <th className="p-1.5">Carrier</th><th className="p-1.5 text-right">Loads</th><th className="p-1.5 text-right">POD %</th><th className="p-1.5 text-right">Margin %</th>
                            </tr></thead>
                            <tbody>
                                {carriers.map(c => {
                                    const mPct = c.rev > 0 ? ((c.rev - c.cost) / c.rev) * 100 : 0;
                                    const podPct = c.delivered > 0 ? (c.pod / c.delivered) * 100 : 0;
                                    return (
                                        <tr key={c.name} className="border-b border-gray-700/40">
                                            <td className="p-1.5 font-semibold text-white truncate max-w-[140px]">{c.name}</td>
                                            <td className="p-1.5 text-right text-gray-300">{c.loads}</td>
                                            <td className={`p-1.5 text-right font-bold ${podPct >= 80 ? 'text-emerald-400' : podPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{c.delivered ? pct(podPct) : '—'}</td>
                                            <td className={`p-1.5 text-right font-bold ${mPct >= 15 ? 'text-emerald-400' : mPct >= 8 ? 'text-amber-400' : 'text-red-400'}`}>{pct(mPct)}</td>
                                        </tr>
                                    );
                                })}
                                {carriers.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-600">No carrier data yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Top Lanes by Margin</h4>
                    <div className="space-y-2">
                        {lanes.map(l => (
                            <div key={l.lane} className="flex justify-between items-center bg-gray-900/50 rounded-lg p-2">
                                <span className="text-xs text-gray-300 truncate max-w-[200px]">{l.lane}</span>
                                <span className="text-xs font-black text-emerald-400">{money(l.margin)} <span className="text-gray-600 font-normal">({l.loads})</span></span>
                            </div>
                        ))}
                        {lanes.length === 0 && <p className="text-xs text-gray-600 text-center py-4">No lane data yet.</p>}
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Top Clients by Margin</h4>
                    <div className="space-y-2">
                        {topClients.map(c => (
                            <div key={c.name} className="flex justify-between items-center bg-gray-900/50 rounded-lg p-2">
                                <span className="text-xs text-gray-300 truncate max-w-[150px]">{c.name}</span>
                                <span className="text-xs font-black text-emerald-400">{money(c.margin)} <span className="text-gray-600 font-normal">({c.loads})</span></span>
                            </div>
                        ))}
                        {topClients.length === 0 && <p className="text-xs text-gray-600 text-center py-4">No client data yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrokingAnalytics;
