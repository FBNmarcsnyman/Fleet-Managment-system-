import React, { useMemo, useState, useEffect } from 'react';
import { LoadConfirmation, Client, Supplier } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';

// Customisable Broking dashboard: pick which widgets show, in what order. Layout
// persists per browser. Each widget is computed from load data (no schema needs).
const money = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');
const pct = (n: number) => `${n.toFixed(0)}%`;
const DAY = 86400000;
const CLOSED = ['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'];
const PRE_COLLECT = ['Booked', 'Driver Assigned', 'At Collection Point', 'Loading'];
const daysSince = (d?: string) => { if (!d) return 0; const t = new Date(d).getTime(); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / DAY)); };

const ALL_WIDGETS = ['attention', 'kpis', 'carriers', 'lanes', 'clients', 'pod'] as const;
type WKey = typeof ALL_WIDGETS[number];
const WIDGET_NAME: Record<WKey, string> = { attention: 'Needs Attention', kpis: 'Margins & Highlights', carriers: 'Carrier Scorecard', lanes: 'Top Lanes', clients: 'Top Clients', pod: 'POD & Action Queues' };
const WIDGET_SPAN: Record<WKey, string> = { attention: 'col-span-12', kpis: 'col-span-12', carriers: 'col-span-12 lg:col-span-6', lanes: 'col-span-12 lg:col-span-3', clients: 'col-span-12 lg:col-span-3', pod: 'col-span-12' };
const STORE = 'brokingDash_v1';

const BrokingDashboard: React.FC = () => {
    const { loadConfirmations = [], clients = [], suppliers = [], handleUpdateLoadConfirmation } = useOperations() as any;
    const { showModal } = useUIState();
    const [period, setPeriod] = useState<'all' | '30' | '90'>('all');
    const [customize, setCustomize] = useState(false);
    const [layout, setLayout] = useState<WKey[]>(() => {
        try { const s = localStorage.getItem(STORE); if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length) return a.filter((k: string) => (ALL_WIDGETS as readonly string[]).includes(k)); } } catch { }
        return [...ALL_WIDGETS];
    });
    useEffect(() => { localStorage.setItem(STORE, JSON.stringify(layout)); }, [layout]);

    const clientMap = useMemo(() => new Map<string, string>((clients as Client[]).map(c => [c.id, c.name])), [clients]);
    const supplierMap = useMemo(() => new Map<string, string>((suppliers as Supplier[]).map(s => [s.id, s.name])), [suppliers]);
    const cName = (lc: LoadConfirmation) => (lc.clientId && clientMap.get(lc.clientId)) || lc.clientName || 'N/A';

    const broked = useMemo(() => {
        const cutoff = period === 'all' ? 0 : Date.now() - Number(period) * DAY;
        return (loadConfirmations as LoadConfirmation[]).filter(lc => !lc.isCollection && lc.status !== 'Cancelled' && (period === 'all' || new Date(lc.date).getTime() >= cutoff));
    }, [loadConfirmations, period]);
    const rated = useMemo(() => broked.filter(lc => (lc.supplierRate || 0) > 0), [broked]);

    const kpis = useMemo(() => { let rev = 0, cost = 0; rated.forEach(lc => { rev += lc.totalAmount || 0; cost += lc.supplierRate || 0; }); const margin = rev - cost; return { rev, cost, margin, marginPct: rev > 0 ? (margin / rev) * 100 : 0, count: rated.length }; }, [rated]);
    const lowMargin = useMemo(() => rated.filter(lc => { const t = lc.totalAmount || 0, s = lc.supplierRate || 0; return t > 0 && ((t - s) / t) * 100 < 10; }), [rated]);
    const carriers = useMemo(() => { const m = new Map<string, any>(); rated.forEach(lc => { const id = lc.supplierId || lc.subcontractorName || '—'; const name = (lc.supplierId && supplierMap.get(lc.supplierId)) || lc.subcontractorName || '—'; const e = m.get(id) || { name, loads: 0, delivered: 0, pod: 0, rev: 0, cost: 0 }; e.loads++; if (CLOSED.includes(lc.status)) e.delivered++; if (lc.podPhoto) e.pod++; e.rev += lc.totalAmount || 0; e.cost += lc.supplierRate || 0; m.set(id, e); }); return [...m.values()].sort((a, b) => b.loads - a.loads).slice(0, 10); }, [rated, supplierMap]);
    const lanes = useMemo(() => { const m = new Map<string, any>(); rated.forEach(lc => { const lane = lc.route || `${lc.collectionPoint || '?'} → ${lc.deliveryPoint || '?'}`; const e = m.get(lane) || { lane, loads: 0, margin: 0 }; e.loads++; e.margin += (lc.totalAmount || 0) - (lc.supplierRate || 0); m.set(lane, e); }); return [...m.values()].sort((a, b) => b.margin - a.margin).slice(0, 6); }, [rated]);
    const topClients = useMemo(() => { const m = new Map<string, any>(); rated.forEach(lc => { const id = lc.clientId || lc.clientName || '—'; const name = cName(lc); const e = m.get(id) || { name, loads: 0, margin: 0 }; e.loads++; e.margin += (lc.totalAmount || 0) - (lc.supplierRate || 0); m.set(id, e); }); return [...m.values()].sort((a, b) => b.margin - a.margin).slice(0, 6); }, [rated]);
    const exceptions = useMemo(() => {
        const noResponse = broked.filter(lc => lc.sentToSupplierDate && !lc.acceptedAt && PRE_COLLECT.includes(lc.status)).map(lc => ({ lc, reason: 'Awaiting transporter response', days: daysSince(lc.sentToSupplierDate) }));
        const stale = broked.filter(lc => !CLOSED.includes(lc.status) && (lc as any).updatedAt && daysSince((lc as any).updatedAt) >= 2).map(lc => ({ lc, reason: 'Not updated', days: daysSince((lc as any).updatedAt) }));
        const noPod = broked.filter(lc => lc.status === 'Delivered' && !lc.podPhoto).map(lc => ({ lc, reason: 'POD not uploaded', days: daysSince(lc.deliveryDate || (lc as any).updatedAt) }));
        const overdueColl = broked.filter(lc => PRE_COLLECT.includes(lc.status) && lc.collectionDate && new Date(lc.collectionDate) < new Date(new Date().setHours(0, 0, 0, 0))).map(lc => ({ lc, reason: 'Overdue collection', days: daysSince(lc.collectionDate) }));
        return { noResponse, stale, noPod, overdueColl, flagged: [...noResponse, ...overdueColl, ...noPod, ...stale].sort((a, b) => b.days - a.days) };
    }, [broked]);
    const awaitingPod = useMemo(() => broked.filter(lc => lc.status === 'Delivered' && !lc.podPhoto), [broked]);
    const unassigned = useMemo(() => broked.filter(lc => lc.status === 'Booked'), [broked]);

    const hide = (k: WKey) => setLayout(l => l.filter(x => x !== k));
    const add = (k: WKey) => setLayout(l => [...l, k]);
    const move = (k: WKey, dir: -1 | 1) => setLayout(l => { const i = l.indexOf(k); const j = i + dir; if (i < 0 || j < 0 || j >= l.length) return l; const a = [...l]; [a[i], a[j]] = [a[j], a[i]]; return a; });
    const hidden = ALL_WIDGETS.filter(k => !layout.includes(k));

    const Tile: React.FC<{ label: string; items: { lc: LoadConfirmation; days: number }[]; tone: string }> = ({ label, items, tone }) => {
        const worst = items.reduce((m, x) => Math.max(m, x.days), 0);
        return <div className={`rounded-xl p-3 border shadow-sm ${items.length ? tone : 'bg-white border-slate-200'}`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p><p className={`text-2xl font-black ${items.length ? 'text-slate-900' : 'text-slate-300'}`}>{items.length}</p>{items.length > 0 && <p className="text-[11px] font-bold text-red-600">up to {worst}d</p>}</div>;
    };

    const renderWidget = (k: WKey) => {
        switch (k) {
            case 'attention': return (<div className="space-y-3"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Tile label="Awaiting response" items={exceptions.noResponse} tone="bg-amber-50 border-amber-200" /><Tile label="Overdue collections" items={exceptions.overdueColl} tone="bg-orange-50 border-orange-200" /><Tile label="POD not uploaded" items={exceptions.noPod} tone="bg-blue-50 border-blue-200" /><Tile label="Not updated 2d+" items={exceptions.stale} tone="bg-red-50 border-red-200" /></div>{exceptions.flagged.length > 0 && <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">{exceptions.flagged.slice(0, 20).map(({ lc, reason, days }) => <button key={`${lc.id}-${reason}`} onClick={() => showModal('loadDetail', { loadCon: lc })} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50"><div className="min-w-0"><span className="font-mono text-[11px] text-blue-600">{lc.loadConNumber}</span><span className="text-sm font-semibold text-slate-800 ml-2">{cName(lc)}</span><span className="text-[11px] text-slate-500 ml-2">{reason}</span></div><span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded ${days >= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{days}d</span></button>)}</div>}</div>);
            case 'kpis': return (<div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[['Loads', String(kpis.count), 'text-slate-900', ''], ['Client Revenue', money(kpis.rev), 'text-slate-900', ''], ['Transporter Cost', money(kpis.cost), 'text-slate-900', ''], ['Gross Margin', money(kpis.margin), 'text-emerald-600', pct(kpis.marginPct)], ['Low-margin', String(lowMargin.length), lowMargin.length ? 'text-amber-600' : 'text-slate-900', 'under 10%']].map(([l, v, a, s], i) => <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{l}</p><p className={`text-2xl font-black ${a}`}>{v}</p>{s && <p className="text-[11px] text-slate-500">{s}</p>}</div>)}</div>);
            case 'carriers': return (<div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Carrier Scorecard</h4><table className="w-full text-left text-xs"><thead><tr className="text-slate-400 border-b border-slate-200"><th className="p-1.5">Carrier</th><th className="p-1.5 text-right">Loads</th><th className="p-1.5 text-right">POD %</th><th className="p-1.5 text-right">Margin %</th></tr></thead><tbody>{carriers.map(c => { const mPct = c.rev > 0 ? ((c.rev - c.cost) / c.rev) * 100 : 0; const podPct = c.delivered > 0 ? (c.pod / c.delivered) * 100 : 0; return <tr key={c.name} className="border-b border-slate-100"><td className="p-1.5 font-semibold text-slate-800 truncate max-w-[140px]">{c.name}</td><td className="p-1.5 text-right text-slate-600">{c.loads}</td><td className={`p-1.5 text-right font-bold ${podPct >= 80 ? 'text-emerald-600' : podPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{c.delivered ? pct(podPct) : '—'}</td><td className={`p-1.5 text-right font-bold ${mPct >= 15 ? 'text-emerald-600' : mPct >= 8 ? 'text-amber-600' : 'text-red-600'}`}>{pct(mPct)}</td></tr>; })}{carriers.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No data yet.</td></tr>}</tbody></table></div>);
            case 'lanes': return (<div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Top Lanes by Margin</h4><div className="space-y-2">{lanes.map(l => <div key={l.lane} className="flex justify-between items-center bg-slate-50 rounded-lg p-2"><span className="text-xs text-slate-600 truncate max-w-[160px]">{l.lane}</span><span className="text-xs font-black text-emerald-600">{money(l.margin)}</span></div>)}{lanes.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No data.</p>}</div></div>);
            case 'clients': return (<div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Top Clients by Margin</h4><div className="space-y-2">{topClients.map(c => <div key={c.name} className="flex justify-between items-center bg-slate-50 rounded-lg p-2"><span className="text-xs text-slate-600 truncate max-w-[150px]">{c.name}</span><span className="text-xs font-black text-emerald-600">{money(c.margin)}</span></div>)}{topClients.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No data.</p>}</div></div>);
            case 'pod': return (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Loads awaiting POD ({awaitingPod.length})</h4><div className="space-y-2 max-h-64 overflow-y-auto">{awaitingPod.map(lc => <div key={lc.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg p-2"><button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-left min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{cName(lc)}</p><p className="font-mono text-[10px] text-slate-500">{lc.loadConNumber}</p></button><button onClick={() => showModal('pod', { loadCon: lc, isManualUpload: true })} className="shrink-0 text-[10px] font-black bg-blue-600 hover:bg-blue-500 text-white py-1.5 px-3 rounded-lg uppercase">Upload POD</button></div>)}{awaitingPod.length === 0 && <p className="text-xs text-slate-400 italic py-2">None.</p>}</div></div><div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Unassigned ({unassigned.length})</h4><div className="space-y-2 max-h-64 overflow-y-auto">{unassigned.map(lc => <div key={lc.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg p-2"><button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-left min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{cName(lc)}</p><p className="text-[10px] text-slate-500 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p></button><button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className="shrink-0 text-[10px] font-black bg-green-600 hover:bg-green-500 text-white py-1.5 px-3 rounded-lg uppercase">Assign</button></div>)}{unassigned.length === 0 && <p className="text-xs text-slate-400 italic py-2">None.</p>}</div></div></div>);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Broking Dashboard</h3>
                <div className="flex items-center gap-2">
                    <select value={period} onChange={e => setPeriod(e.target.value as any)} className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm"><option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
                    <button onClick={() => setCustomize(c => !c)} className={`font-bold py-2 px-4 rounded-lg text-sm ${customize ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{customize ? 'Done' : 'Customise'}</button>
                </div>
            </div>

            {customize && hidden.length > 0 && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black text-slate-500 uppercase">Add back:</span>
                    {hidden.map(k => <button key={k} onClick={() => add(k)} className="text-xs font-bold bg-white border border-slate-300 hover:border-blue-400 rounded-lg px-3 py-1.5">+ {WIDGET_NAME[k]}</button>)}
                </div>
            )}

            <div className="grid grid-cols-12 gap-4">
                {layout.map((k, i) => (
                    <div key={k} className={WIDGET_SPAN[k]}>
                        {customize && (
                            <div className="flex items-center justify-between bg-slate-800 text-white rounded-t-lg px-3 py-1.5">
                                <span className="text-[11px] font-black uppercase tracking-wider">{WIDGET_NAME[k]}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => move(k, -1)} disabled={i === 0} className="px-1.5 disabled:opacity-30">↑</button>
                                    <button onClick={() => move(k, 1)} disabled={i === layout.length - 1} className="px-1.5 disabled:opacity-30">↓</button>
                                    <button onClick={() => hide(k)} className="px-1.5 text-red-300 hover:text-red-200" title="Hide">✕</button>
                                </div>
                            </div>
                        )}
                        {renderWidget(k)}
                    </div>
                ))}
                {layout.length === 0 && <p className="col-span-12 text-center text-slate-400 py-8">All widgets hidden — tap Customise to add them back.</p>}
            </div>
        </div>
    );
};

export default BrokingDashboard;
