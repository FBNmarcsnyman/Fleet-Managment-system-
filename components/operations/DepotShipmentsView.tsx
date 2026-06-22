import React, { useEffect, useMemo, useState } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import { directSelect, directUpdate, directDelete } from '../../lib/supabase';
import { DEPOT_SHIPMENT_STATUSES, daysToDeadline, deadlineLabel } from '../../lib/depotShipments';
import { sendDepotClientUpdate } from '../../lib/depotEmails';

interface DepotShipment {
    id: string; client_name: string; client_ref: string; depot: string; branch: string;
    vessel_name: string; shipping_line: string; eta_port: string; house_bill: string;
    commodity: string; packages: number; weight: number; cube: number;
    collection_point: string; delivery_point: string; hazardous: boolean;
    free_time_days: number; received_at_depot_date: string; unpack_date: string;
    clearing_doc: string; status: string; notes: string;
}

const DONE = ['Delivered', 'Empty Turned In'];
// Cargo that is unpacked and sitting at the depot, ready/planned to be collected.
const COLLECTABLE = ['Unpacked', 'Collection Booked'];

// LCL depot status report — drop/clearing doc, cargo details, live status and
// the storage free-time countdown (3 days incl. unpack; 1 day for hazardous).
const DepotShipmentsView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { clients = [] } = useOperations() as any;
    const [rows, setRows] = useState<DepotShipment[]>([]);
    const [emailing, setEmailing] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [tab, setTab] = useState<'active' | 'attention' | 'all'>('active');
    const [sort, setSort] = useState<'eta' | 'client' | 'deadline'>('eta');
    const [groupClient, setGroupClient] = useState(false);
    const [mode, setMode] = useState<'report' | 'plan'>('report');
    const [openDepot, setOpenDepot] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        const { data } = await directSelect('depot_shipments?select=*&order=eta_port.desc.nullslast,created_at.desc&limit=5000');
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
    };
    useEffect(() => {
        load();
        const h = () => load();
        window.addEventListener('depot-shipments-changed', h);
        return () => window.removeEventListener('depot-shipments-changed', h);
    }, []);

    const setStatus = async (s: DepotShipment, status: string) => {
        setRows(p => p.map(x => x.id === s.id ? { ...x, status } : x));
        const { error } = await directUpdate('depot_shipments', { id: s.id }, { status });
        if (error) { showToast(`Could not update: ${error.message}`); load(); }
    };
    const del = async (s: DepotShipment) => {
        if (!window.confirm(`Delete depot shipment ${s.house_bill || s.client_ref || ''}?`)) return;
        const { error } = await directDelete('depot_shipments', { id: s.id });
        if (error) { showToast(`Could not delete: ${error.message}`); return; }
        setRows(p => p.filter(x => x.id !== s.id)); showToast('Shipment deleted.');
    };

    // Resolve the client's email from the linked client record (by id, else name).
    const clientEmailFor = (s: DepotShipment): string => {
        const byId = (s as any).client_id ? (clients as any[]).find(c => c.id === (s as any).client_id) : null;
        const byName = !byId && s.client_name ? (clients as any[]).find(c => (c.name || '').toLowerCase() === (s.client_name || '').toLowerCase()) : null;
        const c = byId || byName;
        return c?.contactEmail || c?.clientEmail || '';
    };
    const emailClient = async (s: DepotShipment) => {
        const to = clientEmailFor(s);
        if (!to) { showToast('No client email on file — add it on the client record.'); return; }
        setEmailing(s.id);
        const res = await sendDepotClientUpdate({ ...s, client_email: to }, to);
        setEmailing(null);
        showToast(res.ok ? `Status update emailed to ${to}.` : `Email failed: ${res.error || 'unknown error'}`);
    };

    const fmt = (s?: string) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); } catch { return s; } };

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        const out = rows.filter(s => {
            if (tab === 'active' && DONE.includes(s.status)) return false;
            if (tab === 'attention') { const d = daysToDeadline(s); if (!(d !== null && d <= 1 && !DONE.includes(s.status))) return false; }
            if (!term) return true;
            return `${s.client_name || ''} ${s.house_bill || ''} ${s.vessel_name || ''} ${s.client_ref || ''} ${s.depot || ''}`.toLowerCase().includes(term);
        });
        const effSort = groupClient ? 'client' : sort;
        const byEta = (a: DepotShipment, b: DepotShipment) => { const ax = a.eta_port || '', bx = b.eta_port || ''; if (!ax && !bx) return 0; if (!ax) return 1; if (!bx) return -1; return bx.localeCompare(ax); };
        out.sort((a, b) => {
            if (effSort === 'client') return (a.client_name || '').localeCompare(b.client_name || '') || byEta(a, b);
            if (effSort === 'deadline') { const da = daysToDeadline(a), db = daysToDeadline(b); if (da === null && db === null) return byEta(a, b); if (da === null) return 1; if (db === null) return -1; return da - db; }
            return byEta(a, b);
        });
        return out;
    }, [rows, q, tab, sort, groupClient]);

    const clientCounts = useMemo(() => {
        const m: Record<string, number> = {};
        filtered.forEach(s => { const k = s.client_name || '—'; m[k] = (m[k] || 0) + 1; });
        return m;
    }, [filtered]);

    // Collection plan: cargo ready to collect, grouped by the unpack depot we
    // collect from, with the day's totals per depot (shipments / pkg / kg / m³).
    const depotPlan = useMemo(() => {
        const term = q.trim().toLowerCase();
        const m: Record<string, { depot: string; items: DepotShipment[]; pkg: number; wt: number; cube: number; due: number }> = {};
        rows.filter(s => COLLECTABLE.includes(s.status)).forEach(s => {
            if (term && !`${s.client_name || ''} ${s.house_bill || ''} ${s.vessel_name || ''} ${s.client_ref || ''} ${s.depot || ''} ${s.commodity || ''}`.toLowerCase().includes(term)) return;
            const k = (s.depot || '').trim() || '— No depot set —';
            if (!m[k]) m[k] = { depot: k, items: [], pkg: 0, wt: 0, cube: 0, due: 0 };
            const g = m[k];
            g.items.push(s);
            g.pkg += Number(s.packages) || 0;
            g.wt += Number(s.weight) || 0;
            g.cube += Number(s.cube) || 0;
            const d = daysToDeadline(s);
            if (d !== null && d <= 0) g.due += 1;
        });
        return Object.values(m).sort((a, b) => b.items.length - a.items.length || a.depot.localeCompare(b.depot));
    }, [rows, q]);
    const planTotals = useMemo(() => depotPlan.reduce((t, g) => ({ ship: t.ship + g.items.length, pkg: t.pkg + g.pkg, wt: t.wt + g.wt, cube: t.cube + g.cube }), { ship: 0, pkg: 0, wt: 0, cube: 0 }), [depotPlan]);
    const num = (n: number) => n.toLocaleString('en-ZA', { maximumFractionDigits: 2 });

    const counts = useMemo(() => {
        const active = rows.filter(s => !DONE.includes(s.status));
        return {
            active: active.length,
            waiting: rows.filter(s => s.status === 'Waiting for Vessel' || s.status === 'Vessel Arrived').length,
            atDepot: rows.filter(s => s.status === 'Received at Depot').length,
            unpacked: rows.filter(s => s.status === 'Unpacked' || s.status === 'Collection Booked').length,
            overdue: active.filter(s => { const d = daysToDeadline(s); return d !== null && d < 0; }).length,
        };
    }, [rows]);

    const card = (label: string, n: number, color: string) => (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[120px]">
            <div className={`text-2xl font-black ${color}`}>{n}</div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div>
        </div>
    );
    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-md ${active ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`;
    const dlTone = (t: 'ok' | 'warn' | 'over') => t === 'over' ? 'bg-red-100 text-red-700' : t === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700';

    return (
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Depot Status Report (LCL)</h3>
                    <p className="text-xs text-slate-500">Vessel → depot → unpack → collect → deliver. Free-time: 3 days incl. unpack (1 day hazardous).</p>
                </div>
                <div className="flex items-center gap-2">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search client / HBL / vessel / depot" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-60" />
                    <button onClick={() => showModal('logDepotShipment', {})} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap">+ Log shipment</button>
                </div>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto">
                {card('Waiting / vessel', counts.waiting, 'text-blue-600')}
                {card('At depot', counts.atDepot, 'text-teal-600')}
                {card('Unpacked / to collect', counts.unpacked, 'text-amber-600')}
                {card('Overdue (storage)', counts.overdue, 'text-rose-600')}
                {card('Active', counts.active, 'text-slate-800')}
            </div>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-3">
                {([['report', 'Status report'], ['plan', 'Collection plan']] as [typeof mode, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setMode(v)} className={chip(mode === v)}>{l}</button>
                ))}
            </div>

            {mode === 'report' ? (<>
            <div className="flex gap-2 mb-3 flex-wrap items-center">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                    {([['active', 'Active'], ['attention', 'Needs collection'], ['all', 'All']] as [typeof tab, string][]).map(([v, l]) => (
                        <button key={v} onClick={() => setTab(v)} className={chip(tab === v)}>{l}</button>
                    ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sort</label>
                    <select value={sort} disabled={groupClient} onChange={e => setSort(e.target.value as any)} className="bg-white border border-slate-300 rounded-md p-1.5 text-xs disabled:opacity-50">
                        <option value="eta">ETA (newest first)</option>
                        <option value="client">Client</option>
                        <option value="deadline">Storage deadline</option>
                    </select>
                    <button onClick={() => setGroupClient(g => !g)} className={chip(groupClient)}>Group by client</button>
                </div>
            </div>

            {loading ? <p className="text-center text-slate-400 py-12">Loading…</p> : filtered.length === 0 ? <p className="text-center text-slate-400 py-12">No depot shipments.</p> : (
                <div className="overflow-x-auto max-h-[58vh]">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-100 text-slate-500"><tr>
                            <th className="p-2">Client / HBL</th><th className="p-2">Vessel / ETA</th><th className="p-2">Depot</th><th className="p-2">Cargo</th><th className="p-2">Status</th><th className="p-2">Free-time</th><th className="p-2"></th>
                        </tr></thead>
                        <tbody>
                            {filtered.map((s, i) => {
                                const dl = deadlineLabel(s);
                                return (
                                    <React.Fragment key={s.id}>
                                        {groupClient && (i === 0 || (filtered[i - 1].client_name || '—') !== (s.client_name || '—')) && (
                                            <tr className="bg-slate-50"><td colSpan={7} className="px-2 py-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">{s.client_name || '—'} <span className="text-slate-400">({clientCounts[s.client_name || '—']})</span></td></tr>
                                        )}
                                        <tr className="border-b border-slate-100 hover:bg-slate-50 text-slate-700">
                                            <td className="p-2"><button onClick={() => showModal('logDepotShipment', { shipment: s })} className="font-bold text-blue-600 hover:underline">{s.client_name || '—'}</button>{s.hazardous ? <span className="ml-1 text-[9px] font-black bg-red-100 text-red-700 px-1 rounded">HAZ</span> : null}<div className="text-[11px] text-slate-400">{[s.house_bill, s.client_ref].filter(Boolean).join(' · ') || '—'}</div></td>
                                            <td className="p-2">{s.vessel_name || '—'}<div className="text-[11px] text-slate-400">ETA {fmt(s.eta_port)}</div></td>
                                            <td className="p-2 text-xs">{s.depot || '—'}<div className="text-[11px] text-slate-400">{s.branch || ''}</div></td>
                                            <td className="p-2 text-xs">{[s.packages ? `${s.packages} pkg` : '', s.weight ? `${s.weight} kg` : '', s.cube ? `${s.cube} m³` : ''].filter(Boolean).join(' · ') || '—'}<div className="text-[11px] text-slate-400 truncate max-w-[160px]">{s.commodity || ''}</div></td>
                                            <td className="p-2"><select value={s.status} onChange={e => setStatus(s, e.target.value)} className="bg-white border border-slate-300 rounded-md p-1 text-xs">{DEPOT_SHIPMENT_STATUSES.map(x => <option key={x} value={x}>{x}</option>)}</select></td>
                                            <td className="p-2 text-xs">{dl ? <span className={`text-[10px] font-black px-2 py-0.5 rounded ${dlTone(dl.tone)}`}>{dl.text}</span> : '—'}{s.unpack_date ? <div className="text-[11px] text-slate-400">unpacked {fmt(s.unpack_date)}</div> : null}</td>
                                            <td className="p-2 text-right whitespace-nowrap">
                                                <button onClick={() => emailClient(s)} disabled={emailing === s.id} title="Email the client a status update" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 mr-2 disabled:opacity-50">{emailing === s.id ? '…' : '✉ Update client'}</button>
                                                <button onClick={() => del(s)} title="Delete" className="text-slate-400 hover:text-red-500">×</button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            </>) : (
                <div>
                    <p className="text-xs text-slate-500 mb-3">Unpacked cargo ready to collect, grouped by the unpack depot we collect from. Click a depot to see its shipments.{q.trim() ? ' Filtered by your search.' : ''}</p>
                    {depotPlan.length === 0 ? <p className="text-center text-slate-400 py-12">No cargo ready for collection.</p> : (
                        <>
                            <div className="flex flex-wrap gap-3 mb-4 text-xs font-bold text-slate-600">
                                <span className="bg-slate-100 rounded-md px-3 py-1.5"><span className="text-slate-900 font-black">{depotPlan.length}</span> depot{depotPlan.length === 1 ? '' : 's'}</span>
                                <span className="bg-slate-100 rounded-md px-3 py-1.5"><span className="text-slate-900 font-black">{planTotals.ship}</span> shipments</span>
                                <span className="bg-slate-100 rounded-md px-3 py-1.5"><span className="text-slate-900 font-black">{num(planTotals.pkg)}</span> pkg</span>
                                <span className="bg-slate-100 rounded-md px-3 py-1.5"><span className="text-slate-900 font-black">{num(planTotals.wt)}</span> kg</span>
                                <span className="bg-slate-100 rounded-md px-3 py-1.5"><span className="text-slate-900 font-black">{num(planTotals.cube)}</span> m³</span>
                            </div>
                            <div className="space-y-3 max-h-[58vh] overflow-y-auto">
                                {depotPlan.map(g => {
                                    const open = openDepot === g.depot;
                                    return (
                                        <div key={g.depot} className="border border-slate-200 rounded-xl overflow-hidden">
                                            <button onClick={() => setOpenDepot(open ? null : g.depot)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-slate-400">{open ? '▾' : '▸'}</span>
                                                    <span className="font-black text-slate-900 truncate">{g.depot}</span>
                                                    {g.due > 0 ? <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded whitespace-nowrap">{g.due} due/overdue</span> : null}
                                                </div>
                                                <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600 justify-end">
                                                    <span className="bg-white border border-slate-200 rounded px-2 py-0.5"><span className="text-slate-900 font-black">{g.items.length}</span> ship</span>
                                                    <span className="bg-white border border-slate-200 rounded px-2 py-0.5"><span className="text-slate-900 font-black">{num(g.pkg)}</span> pkg</span>
                                                    <span className="bg-white border border-slate-200 rounded px-2 py-0.5"><span className="text-slate-900 font-black">{num(g.wt)}</span> kg</span>
                                                    <span className="bg-white border border-slate-200 rounded px-2 py-0.5"><span className="text-slate-900 font-black">{num(g.cube)}</span> m³</span>
                                                </div>
                                            </button>
                                            {open && (
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-white text-slate-400 text-[11px] uppercase tracking-wider"><tr>
                                                        <th className="p-2 pl-9">Client / HBL</th><th className="p-2">Cargo</th><th className="p-2">Status</th><th className="p-2">Free-time</th><th className="p-2">Delivery</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        {g.items.map(s => {
                                                            const dl = deadlineLabel(s);
                                                            return (
                                                                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 text-slate-700">
                                                                    <td className="p-2 pl-9"><button onClick={() => showModal('logDepotShipment', { shipment: s })} className="font-bold text-blue-600 hover:underline">{s.client_name || '—'}</button>{s.hazardous ? <span className="ml-1 text-[9px] font-black bg-red-100 text-red-700 px-1 rounded">HAZ</span> : null}<div className="text-[11px] text-slate-400">{[s.house_bill, s.client_ref].filter(Boolean).join(' · ') || '—'}</div></td>
                                                                    <td className="p-2 text-xs">{[s.packages ? `${s.packages} pkg` : '', s.weight ? `${s.weight} kg` : '', s.cube ? `${s.cube} m³` : ''].filter(Boolean).join(' · ') || '—'}<div className="text-[11px] text-slate-400 truncate max-w-[160px]">{s.commodity || ''}</div></td>
                                                                    <td className="p-2"><select value={s.status} onChange={e => setStatus(s, e.target.value)} className="bg-white border border-slate-300 rounded-md p-1 text-xs">{DEPOT_SHIPMENT_STATUSES.map(x => <option key={x} value={x}>{x}</option>)}</select></td>
                                                                    <td className="p-2 text-xs">{dl ? <span className={`text-[10px] font-black px-2 py-0.5 rounded ${dlTone(dl.tone)}`}>{dl.text}</span> : '—'}</td>
                                                                    <td className="p-2 text-xs">{s.delivery_point || '—'}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default DepotShipmentsView;
