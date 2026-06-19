import React, { useMemo, useState } from 'react';
import { LoadConfirmation, Client, Supplier } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';

const money = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');
const pct = (n: number) => `${n.toFixed(0)}%`;
const DAY = 86400000;
const CLOSED = ['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'];
const PRE_COLLECT = ['Booked', 'Driver Assigned', 'At Collection Point', 'Loading'];
const daysSince = (d?: string) => { if (!d) return 0; const t = new Date(d).getTime(); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / DAY)); };

// Margin dashboard + carrier scorecard, computed from load data (no schema needs).
const BrokingAnalytics: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [] } = useOperations();
    const { showModal } = useUIState();
    const [period, setPeriod] = useState<'all' | '30' | '90'>('all');

    // ---- Needs attention: live exceptions on brokered loads ----
    const exceptions = useMemo(() => {
        const broked = (loadConfirmations as LoadConfirmation[]).filter(lc => !lc.isCollection && lc.status !== 'Cancelled');
        const tag = (lc: LoadConfirmation, reason: string, days: number) => ({ lc, reason, days });
        const noResponse = broked.filter(lc => lc.sentToSupplierDate && !lc.acceptedAt && PRE_COLLECT.includes(lc.status))
            .map(lc => tag(lc, 'Awaiting transporter response', daysSince(lc.sentToSupplierDate)));
        const stale = broked.filter(lc => !CLOSED.includes(lc.status) && (lc as any).updatedAt && daysSince((lc as any).updatedAt) >= 2)
            .map(lc => tag(lc, 'Not updated', daysSince((lc as any).updatedAt)));
        const noPod = broked.filter(lc => lc.status === 'Delivered' && !lc.podPhoto)
            .map(lc => tag(lc, 'POD not uploaded', daysSince(lc.deliveryDate || (lc as any).updatedAt)));
        const overdueColl = broked.filter(lc => PRE_COLLECT.includes(lc.status) && lc.collectionDate && new Date(lc.collectionDate) < new Date(new Date().setHours(0, 0, 0, 0)))
            .map(lc => tag(lc, 'Overdue collection', daysSince(lc.collectionDate)));
        return { noResponse, stale, noPod, overdueColl };
    }, [loadConfirmations]);

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

    const carriers = useMemo(() => {
        const m = new Map<string, { name: string; loads: number; delivered: number; pod: number; rev: number; cost: number }>();
        loads.forEach(lc => {
            const id = lc.supplierId || lc.subcontractorName || 'Unknown';
            const name = (lc.supplierId && supplierMap.get(lc.supplierId)) || lc.subcontractorName || 'Unknown';
            const e = m.get(id) || { name, loads: 0, delivered: 0, pod: 0, rev: 0, cost: 0 };
            e.loads++;
            if (['Delivered', 'POD Submitted', 'Invoiced'].includes(lc.status)) e.delivered++;
            if (lc.podPhoto) e.pod++;
            e.rev += lc.totalAmount || 0; e.cost += lc.supplierRate || 0;
            m.set(id, e);
        });
        return Array.from(m.values()).sort((a, b) => b.loads - a.loads).slice(0, 12);
    }, [loads, supplierMap]);

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

    const highlights = useMemo(() => {
        const bestCarrier = [...carriers].sort((a, b) => (b.loads - a.loads) || ((b.rev - b.cost) - (a.rev - a.cost)))[0];
        return { bestCarrier, bestLane: lanes[0], avgPerLoad: loads.length ? kpis.margin / loads.length : 0 };
    }, [carriers, lanes, loads, kpis]);

    const Card: React.FC<{ label: string; value: string; sub?: string; accent?: string }> = ({ label, value, sub, accent }) => (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-black ${accent || 'text-slate-900'}`}>{value}</p>
            {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
        </div>
    );

    const clientName = (lc: LoadConfirmation) => (lc.clientId && clientMap.get(lc.clientId)) || lc.clientName || 'Client';
    const ExcCard: React.FC<{ label: string; items: { lc: LoadConfirmation; days: number }[]; tone: string }> = ({ label, items, tone }) => {
        const worst = items.reduce((m, x) => Math.max(m, x.days), 0);
        return (
            <div className={`rounded-xl p-4 border shadow-sm ${items.length ? tone : 'bg-white border-slate-200'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className={`text-3xl font-black ${items.length ? 'text-slate-900' : 'text-slate-300'}`}>{items.length}</p>
                {items.length > 0 && <p className="text-[11px] font-bold text-red-600 mt-0.5">up to {worst} day{worst !== 1 ? 's' : ''} overdue</p>}
            </div>
        );
    };
    const flagged = [...exceptions.noResponse, ...exceptions.overdueColl, ...exceptions.noPod, ...exceptions.stale].sort((a, b) => b.days - a.days);

    return (
        <div className="space-y-5">
            {/* Needs attention — live exceptions */}
            <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-3">Needs Attention</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <ExcCard label="Awaiting transporter response" items={exceptions.noResponse} tone="bg-amber-50 border-amber-200" />
                    <ExcCard label="Overdue collections" items={exceptions.overdueColl} tone="bg-orange-50 border-orange-200" />
                    <ExcCard label="POD not uploaded" items={exceptions.noPod} tone="bg-blue-50 border-blue-200" />
                    <ExcCard label="Not updated (2 days+)" items={exceptions.stale} tone="bg-red-50 border-red-200" />
                </div>
                {flagged.length > 0 && (
                    <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 max-h-72 overflow-y-auto">
                        {flagged.slice(0, 25).map(({ lc, reason, days }) => (
                            <button key={`${lc.id}-${reason}`} onClick={() => showModal('loadDetail', { loadCon: lc })} className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50">
                                <div className="min-w-0">
                                    <span className="font-mono text-[11px] text-blue-600">{lc.loadConNumber}</span>
                                    <span className="text-sm font-semibold text-slate-800 ml-2">{clientName(lc)}</span>
                                    <span className="text-[11px] text-slate-500 ml-2">{reason}</span>
                                </div>
                                <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded uppercase ${days >= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{days}d</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Broking Performance</h3>
                <select value={period} onChange={e => setPeriod(e.target.value as any)} className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm">
                    <option value="all">All time</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                </select>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Card label="Loads" value={String(kpis.count)} />
                <Card label="Client Revenue" value={money(kpis.rev)} />
                <Card label="Transporter Cost" value={money(kpis.cost)} />
                <Card label="Gross Margin" value={money(kpis.margin)} accent="text-emerald-600" sub={pct(kpis.marginPct)} />
                <Card label="Low-margin loads" value={String(lowMargin.length)} accent={lowMargin.length ? 'text-amber-600' : 'text-slate-900'} sub="under 10%" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Best Transporter</p>
                    <p className="text-lg font-black text-slate-900 truncate">{highlights.bestCarrier?.name || '—'}</p>
                    <p className="text-[11px] text-slate-500">{highlights.bestCarrier ? `${highlights.bestCarrier.loads} loads · ${money(highlights.bestCarrier.rev - highlights.bestCarrier.cost)} margin` : ''}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Most Profitable Lane</p>
                    <p className="text-sm font-black text-slate-900 truncate">{highlights.bestLane?.lane || '—'}</p>
                    <p className="text-[11px] text-slate-500">{highlights.bestLane ? `${money(highlights.bestLane.margin)} over ${highlights.bestLane.loads} loads` : ''}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Avg Margin / Load</p>
                    <p className="text-lg font-black text-slate-900">{money(highlights.avgPerLoad)}</p>
                    <p className="text-[11px] text-slate-500">across {kpis.count} loads</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Carrier Scorecard</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead><tr className="text-slate-400 border-b border-slate-200">
                                <th className="p-1.5">Carrier</th><th className="p-1.5 text-right">Loads</th><th className="p-1.5 text-right">POD %</th><th className="p-1.5 text-right">Margin %</th>
                            </tr></thead>
                            <tbody>
                                {carriers.map(c => {
                                    const mPct = c.rev > 0 ? ((c.rev - c.cost) / c.rev) * 100 : 0;
                                    const podPct = c.delivered > 0 ? (c.pod / c.delivered) * 100 : 0;
                                    return (
                                        <tr key={c.name} className="border-b border-slate-100">
                                            <td className="p-1.5 font-semibold text-slate-800 truncate max-w-[140px]">{c.name}</td>
                                            <td className="p-1.5 text-right text-slate-600">{c.loads}</td>
                                            <td className={`p-1.5 text-right font-bold ${podPct >= 80 ? 'text-emerald-600' : podPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{c.delivered ? pct(podPct) : '—'}</td>
                                            <td className={`p-1.5 text-right font-bold ${mPct >= 15 ? 'text-emerald-600' : mPct >= 8 ? 'text-amber-600' : 'text-red-600'}`}>{pct(mPct)}</td>
                                        </tr>
                                    );
                                })}
                                {carriers.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No carrier data yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Top Lanes by Margin</h4>
                    <div className="space-y-2">
                        {lanes.map(l => (
                            <div key={l.lane} className="flex justify-between items-center bg-slate-50 rounded-lg p-2">
                                <span className="text-xs text-slate-600 truncate max-w-[200px]">{l.lane}</span>
                                <span className="text-xs font-black text-emerald-600">{money(l.margin)} <span className="text-slate-400 font-normal">({l.loads})</span></span>
                            </div>
                        ))}
                        {lanes.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No lane data yet.</p>}
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Top Clients by Margin</h4>
                    <div className="space-y-2">
                        {topClients.map(c => (
                            <div key={c.name} className="flex justify-between items-center bg-slate-50 rounded-lg p-2">
                                <span className="text-xs text-slate-600 truncate max-w-[150px]">{c.name}</span>
                                <span className="text-xs font-black text-emerald-600">{money(c.margin)} <span className="text-slate-400 font-normal">({c.loads})</span></span>
                            </div>
                        ))}
                        {topClients.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No client data yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrokingAnalytics;
