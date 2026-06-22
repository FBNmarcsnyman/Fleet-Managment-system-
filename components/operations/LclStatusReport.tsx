import React, { useEffect, useMemo, useState } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import { directSelect, directUpdate } from '../../lib/supabase';

// LCL groupage Status Report — mirrors the per-client status sheets (DHL/IFF,
// Schneider, all-other-clients, ADB McGregor). Tracks each shipment from
// "container not in" → unpacked → collected → at FBN → JHB → delivered, with a
// FREE-TIME CLOCK: 3 days to collect after unpack (incl. unpack day), HAZ = 1 day.
interface Lcl {
    id: string; fbn_di: string; date_ins_rec: string; controller: string; file_ref: string;
    container_no: string; vessel: string; eta: string; unpack_region: string; depot: string;
    consignee: string; agent: string; hazardous: boolean; un_number: string; commodity: string;
    qty: number; weight_kg: number; volume_cbm: number; status: string;
    unpack_date: string; uplift_date: string; delivered_jhb_date: string; delivered_client_date: string;
    remarks: string; client_sheet: string; is_history: boolean; damaged?: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const fmtD = (s?: string) => { if (!s) return '—'; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); };

// Free-time: from unpack date you have N days (incl. unpack day) to collect before
// storage is charged. HAZ = 1 day. Only matters until the cargo is uplifted.
const freeTime = (r: Lcl): { state: 'none' | 'ok' | 'due' | 'over'; label: string; days: number } => {
    if (!r.unpack_date) return { state: 'none', label: '', days: 0 };
    if (r.uplift_date || /COLLECT|ROUTE|DISPATCH|JHB|DELIVER/.test((r.status || '').toUpperCase())) return { state: 'none', label: 'collected', days: 0 };
    const free = r.hazardous ? 1 : 3;
    const deadline = new Date(r.unpack_date); deadline.setDate(deadline.getDate() + free - 1);
    const left = daysBetween(todayIso(), deadline.toISOString().slice(0, 10));
    if (left < 0) return { state: 'over', label: `${-left}d over`, days: left };
    if (left === 0) return { state: 'due', label: 'due today', days: 0 };
    return { state: 'ok', label: `${left}d left`, days: left };
};

const STATUS_TONE = (s: string) => {
    const u = (s || '').toUpperCase();
    if (/DELIVER/.test(u)) return 'bg-emerald-100 text-emerald-700';
    if (/JHB|DISPATCH/.test(u)) return 'bg-indigo-100 text-indigo-700';
    if (/COLLECT|ROUTE/.test(u)) return 'bg-blue-100 text-blue-700';
    if (/UNPACK/.test(u)) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
};

const LclStatusReport: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { handleCreateLoadConfirmation } = useOperations() as any;
    const [rows, setRows] = useState<Lcl[]>([]);
    const [loading, setLoading] = useState(true);
    const [bookBusy, setBookBusy] = useState<string | null>(null);
    const [showCollect, setShowCollect] = useState(true);
    const [view, setView] = useState<'current' | 'history'>('current');
    const [report, setReport] = useState('All');
    const [depot, setDepot] = useState('All');
    const [agent, setAgent] = useState('All');
    const [status, setStatus] = useState('All');
    const [q, setQ] = useState('');
    const [selIds, setSelIds] = useState<Set<string>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const toggleSel = (id: string) => setSelIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const bulkApply = async (patch: Record<string, any>) => {
        if (!selIds.size) return;
        setBulkBusy(true);
        for (const id of selIds) { try { await directUpdate('lcl_shipments', { id }, patch); } catch { /* keep going */ } }
        setBulkBusy(false); setSelIds(new Set()); fetchRows();
    };

    const fetchRows = async () => {
        setLoading(true);
        const hist = view === 'history';
        let path = `lcl_shipments?select=*&is_history=eq.${hist}&order=eta.desc.nullslast,date_ins_rec.desc.nullslast&limit=5000`;
        if (report !== 'All') path += `&client_sheet=eq.${encodeURIComponent(report)}`;
        const { data } = await directSelect(path);
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
    };
    useEffect(() => { fetchRows(); /* eslint-disable-line */ }, [view, report]);

    const reports = useMemo(() => ['All', ...new Set(rows.map(r => r.client_sheet).filter(Boolean))], [rows]);
    const depots = useMemo(() => ['All', ...new Set(rows.map(r => r.depot).filter(Boolean))].sort(), [rows]);
    const agents = useMemo(() => ['All', ...new Set(rows.map(r => r.agent).filter(Boolean))].sort(), [rows]);
    const statuses = useMemo(() => ['All', ...new Set(rows.map(r => r.status).filter(Boolean))].sort(), [rows]);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter(r => {
            if (depot !== 'All' && r.depot !== depot) return false;
            if (agent !== 'All' && r.agent !== agent) return false;
            if (status !== 'All' && r.status !== status) return false;
            if (term) {
                const hay = `${r.fbn_di || ''} ${r.container_no || ''} ${r.vessel || ''} ${r.file_ref || ''} ${r.commodity || ''} ${r.consignee || ''} ${r.agent || ''} ${r.depot || ''}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [rows, depot, agent, status, q]);

    const counts = useMemo(() => {
        let over = 0, due = 0, awaiting = 0, unpacked = 0;
        filtered.forEach(r => {
            const f = freeTime(r);
            if (f.state === 'over') over++; else if (f.state === 'due') due++;
            if (/NOT IN|AWAIT/.test((r.status || '').toUpperCase())) awaiting++;
            if (/UNPACK/.test((r.status || '').toUpperCase())) unpacked++;
        });
        return { over, due, awaiting, unpacked, total: filtered.length };
    }, [filtered]);

    // Unpacked & ready to collect — grouped per depot so ops can book one
    // collection that picks up all of a depot's freed cargo for the day.
    const isReadyToCollect = (r: Lcl) => /UNPACK/.test((r.status || '').toUpperCase()) && !r.uplift_date;
    const readyByDepot = useMemo(() => {
        const map = new Map<string, Lcl[]>();
        filtered.filter(isReadyToCollect).forEach(r => { const k = r.depot || 'OTHER'; map.set(k, [...(map.get(k) || []), r]); });
        return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
    }, [filtered]);
    const depotTotals = (list: Lcl[]) => ({
        pkgs: list.reduce((s, r) => s + (Number(r.qty) || 0), 0),
        kg: list.reduce((s, r) => s + (Number(r.weight_kg) || 0), 0),
        cbm: list.reduce((s, r) => s + (Number(r.volume_cbm) || 0), 0),
        over: list.filter(r => freeTime(r).state === 'over').length,
    });

    // Book ONE collection at this depot for all its ready shipments: creates a
    // consolidated collection load (onto the board, notifies branch ops to send a
    // vehicle) and marks each shipment collected + linked to that load.
    const bookDepot = async (depotName: string, list: Lcl[]) => {
        if (!list.length) return;
        setBookBusy(depotName);
        const region = (list.find(r => r.unpack_region)?.unpack_region || 'DBN').toUpperCase();
        const branch = `FBN ${region}`;
        const t = depotTotals(list);
        const agentName = list.find(r => r.agent)?.agent || 'LCL GROUPAGE';
        const payload: any = {
            clientId: '', clientName: agentName,
            items: [], legs: [{ id: 'leg-1', collectionPoint: `${depotName} (groupage depot)`, deliveryPoint: `${branch} depot`, movementType: 'Collection' }],
            collectionPoint: `${depotName} (groupage depot)`, deliveryPoint: `${branch} depot`, collectionDate: todayIso(),
            commodity: 'LCL GROUPAGE', packaging: `${t.pkgs} PKGS`, weightKg: String(Math.round(t.kg)), cubeM3: t.cbm ? Number(t.cbm.toFixed(2)) : undefined, loadedPackages: t.pkgs,
            arrangingBranch: branch, collectionBranch: branch, destinationBranch: branch,
            priority: 'Medium', totalAmount: 0, supplierRate: 0, isCollection: true,
            specialInstructions: `LCL groupage collection at ${depotName} — ${list.length} shipment${list.length !== 1 ? 's' : ''} (${t.pkgs} pkgs · ${Math.round(t.kg).toLocaleString('en-ZA')} kg${t.cbm ? ` · ${t.cbm.toFixed(1)} m³` : ''}): ` + list.map(r => `${r.fbn_di || r.container_no || '?'}${r.consignee ? ` (${r.consignee})` : ''}`).slice(0, 40).join(', '),
        };
        try {
            const res = await handleCreateLoadConfirmation(payload);
            if (!res || res.ok === false) { showToast(`Could not book: ${res?.error || 'error'}`); setBookBusy(null); return; }
            const loadId = res.value?.id; const loadNo = res.value?.loadConNumber;
            for (const r of list) { try { await directUpdate('lcl_shipments', { id: r.id }, { status: 'COLLECTED / ON ROUTE', uplift_date: todayIso(), load_id: loadId || null }); } catch { /* keep going */ } }
            showToast(`Booked collection ${loadNo} at ${depotName} — ${list.length} shipment${list.length !== 1 ? 's' : ''}, ops notified.`);
            fetchRows();
        } catch (e) { showToast(`Could not book: ${e instanceof Error ? e.message : 'error'}`); }
        finally { setBookBusy(null); }
    };

    const card = (label: string, n: number, tone: string) => (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 min-w-[110px]"><div className={`text-2xl font-black ${tone}`}>{n}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div></div>
    );
    const sel = 'bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-700';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">LCL Unpack — Status Report</h3>
                    <p className="text-xs text-slate-500">Groupage shipments per client report. Free-time clock = 3 days to collect after unpack (HAZ = 1 day).</p>
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {(['current', 'history'] as const).map(v => <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize ${view === v ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`}>{v}</button>)}
                </div>
            </div>

            <div className="flex gap-3 flex-wrap">
                {card('Shipments', counts.total, 'text-slate-900')}
                {card('Awaiting unpack', counts.awaiting, 'text-slate-600')}
                {card('Unpacked', counts.unpacked, 'text-amber-600')}
                {card('Free-time due', counts.due, 'text-orange-600')}
                {card('Storage overdue', counts.over, 'text-rose-600')}
            </div>

            {/* Unpacked & ready to collect — group per depot, book one collection each. */}
            {view === 'current' && readyByDepot.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <button onClick={() => setShowCollect(s => !s)} className="w-full flex items-center justify-between text-left">
                        <span className="text-sm font-black text-amber-800">🚚 Ready to collect — {readyByDepot.reduce((s, [, l]) => s + l.length, 0)} shipment(s) unpacked at {readyByDepot.length} depot(s)</span>
                        <span className="text-amber-700 text-xs font-bold">{showCollect ? '▼ hide' : '▶ show'}</span>
                    </button>
                    {showCollect && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                            {readyByDepot.map(([dep, list]) => {
                                const t = depotTotals(list);
                                return (
                                    <div key={dep} className="bg-white border border-slate-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-[#13294b]">{dep}</span>
                                            {t.over > 0 && <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase">{t.over} over free-time</span>}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">{list.length} shipment{list.length !== 1 ? 's' : ''} · {t.pkgs} pkgs · {Math.round(t.kg).toLocaleString('en-ZA')} kg{t.cbm ? ` · ${t.cbm.toFixed(1)} m³` : ''}</p>
                                        <button onClick={() => bookDepot(dep, list)} disabled={bookBusy === dep} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-lg uppercase tracking-wider">
                                            {bookBusy === dep ? 'Booking…' : `Book collection (${list.length})`}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-2 flex-wrap items-center bg-white border border-slate-200 rounded-xl p-3">
                <select value={report} onChange={e => setReport(e.target.value)} className={sel}>{reports.map(r => <option key={r} value={r}>{r === 'All' ? 'All reports' : r}</option>)}</select>
                <select value={depot} onChange={e => setDepot(e.target.value)} className={sel}>{depots.map(d => <option key={d} value={d}>{d === 'All' ? 'All depots' : d}</option>)}</select>
                <select value={agent} onChange={e => setAgent(e.target.value)} className={sel}>{agents.map(a => <option key={a} value={a}>{a === 'All' ? 'All agents' : a}</option>)}</select>
                <select value={status} onChange={e => setStatus(e.target.value)} className={sel}>{statuses.map(s => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}</select>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="DI, container, vessel, HBL, commodity…" className={`${sel} flex-1 min-w-[200px]`} />
            </div>

            {selIds.size > 0 && (
                <div className="flex items-center gap-2 bg-[#13294b] text-white rounded-xl p-2.5 flex-wrap sticky top-0 z-10">
                    <span className="font-black text-sm px-2">{selIds.size} selected</span>
                    <button disabled={bulkBusy} onClick={() => bulkApply({ status: 'UNPACKED', unpack_date: todayIso() })} className="bg-amber-500 hover:bg-amber-400 text-[#13294b] font-bold text-xs px-3 py-1.5 rounded-md disabled:opacity-50">Mark unpacked (today)</button>
                    <button disabled={bulkBusy} onClick={() => bulkApply({ status: 'COLLECTED / ON ROUTE', uplift_date: todayIso() })} className="bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs px-3 py-1.5 rounded-md disabled:opacity-50">Mark collected (today)</button>
                    <button disabled={bulkBusy} onClick={() => bulkApply({ status: 'DELIVERED', delivered_client_date: todayIso(), is_history: true })} className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs px-3 py-1.5 rounded-md disabled:opacity-50">Mark delivered</button>
                    <button disabled={bulkBusy} onClick={() => setSelIds(new Set())} className="text-blue-200 hover:text-white font-bold text-xs px-3 py-1.5">Clear</button>
                    {bulkBusy && <span className="text-xs text-blue-200">Updating…</span>}
                </div>
            )}

            {loading ? <p className="text-center text-slate-400 py-12">Loading…</p> : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-h-[62vh]">
                    <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="p-2 w-8"><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selIds.has(r.id))} onChange={e => setSelIds(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())} /></th>
                                <th className="p-2">FBN DI</th><th className="p-2">Container / vessel</th><th className="p-2">ETA</th><th className="p-2">Depot</th><th className="p-2">Agent</th><th className="p-2">Consignee</th><th className="p-2">Commodity</th><th className="p-2 text-right">Pkgs</th><th className="p-2 text-right">Kg</th><th className="p-2 text-right">CBM</th><th className="p-2">Status</th><th className="p-2">Unpack</th><th className="p-2">Free-time</th><th className="p-2">Delivered</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => {
                                const f = freeTime(r);
                                return (
                                    <tr key={r.id} onClick={() => showModal('lclShipment', { shipment: r, onSaved: fetchRows })} className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${selIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-2" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selIds.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                                        <td className="p-2 font-mono font-bold text-slate-900">{r.fbn_di || '—'}{r.hazardous ? <span className="ml-1 text-[8px] font-black bg-rose-100 text-rose-700 px-1 rounded">HAZ</span> : null}{r.damaged ? <span className="ml-1 text-[8px] font-black bg-orange-100 text-orange-700 px-1 rounded">⚠ DMG</span> : null}</td>
                                        <td className="p-2"><span className="font-mono">{r.container_no || '—'}</span><div className="text-[10px] text-slate-400">{r.vessel}</div></td>
                                        <td className="p-2">{fmtD(r.eta)}</td>
                                        <td className="p-2 font-bold text-[#13294b]">{r.depot || '—'}</td>
                                        <td className="p-2 font-semibold text-slate-700">{r.agent || '—'}</td>
                                        <td className="p-2">{r.consignee || '—'}</td>
                                        <td className="p-2 truncate max-w-[140px]">{r.commodity || '—'}</td>
                                        <td className="p-2 text-right">{r.qty ?? '—'}</td>
                                        <td className="p-2 text-right">{r.weight_kg ? Math.round(r.weight_kg).toLocaleString('en-ZA') : '—'}</td>
                                        <td className="p-2 text-right">{r.volume_cbm ?? '—'}</td>
                                        <td className="p-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${STATUS_TONE(r.status)}`}>{r.status || '—'}</span></td>
                                        <td className="p-2">{fmtD(r.unpack_date)}</td>
                                        <td className="p-2">{f.state === 'none' ? <span className="text-slate-300">—</span> : <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${f.state === 'over' ? 'bg-rose-100 text-rose-700' : f.state === 'due' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{f.label}</span>}</td>
                                        <td className="p-2">{fmtD(r.delivered_client_date)}</td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && <tr><td colSpan={15} className="p-6 text-center text-slate-400">No shipments for this filter.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LclStatusReport;
