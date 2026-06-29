import React, { useEffect, useMemo, useState } from 'react';
import { useUIState, useAuth } from '../../contexts/AppContexts';
import { directSelect, directUpdate, directDelete } from '../../lib/supabase';
import { CONTAINER_STATUSES } from './LogContainerModal';

// Normalise any branch label to a depot code so DBN/JHB teams see only their containers.
const branchCode = (b?: string) => /DBN|DURBAN/i.test(b || '') ? 'DBN' : /JHB|JOHAN/i.test(b || '') ? 'JHB' : /CPT|CAPE/i.test(b || '') ? 'CPT' : '';

interface Container {
    id: string; container_no: string; seal_no: string; size: string; weight: number;
    commodity: string; client_name: string; client_ref: string; vessel_name: string;
    shipping_line: string; eta_port: string; plan: string; status: string; branch: string;
    turn_in_area: string; turn_in_date: string; notes: string;
    route_plan?: string; unpack_location?: string; unpack_by?: string; storage_depot?: string; consol_ref?: string;
}

const ROUTE_LABEL: Record<string, string> = {
    yard_unpack: 'Yard unpack', supplier_unpack: 'Supplier unpack', storage: 'Storage depot', direct_delivery: 'Direct delivery',
};

// Container monitoring — from vessel/port through depot to empty turn-in.
const ContainersView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();
    // Branch scope: a depot user (single DBN/JHB/CPT branch, non-admin) is locked to
    // their depot; admins see all + can switch.
    const isAdmin = ['Admin', 'Super Admin'].includes(currentUser?.role as string);
    const opsBranches = (currentUser?.assignedBranches || []).filter((b: string) => branchCode(b));
    const lockBranch = !isAdmin && opsBranches.length === 1;
    const [branch, setBranch] = useState<string>(lockBranch ? branchCode(opsBranches[0]) : 'All');
    useEffect(() => { if (lockBranch) setBranch(branchCode(opsBranches[0])); }, [lockBranch, opsBranches[0]]);
    const [rows, setRows] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [tab, setTab] = useState<'active' | 'all' | 'turnin'>('active');
    const [sort, setSort] = useState<'eta' | 'client' | 'container' | 'status'>('eta');
    const [groupByClient, setGroupByClient] = useState(false);

    const load = async () => {
        setLoading(true);
        // Fetch ALL active containers separately (many have no ETA, so an ETA-ordered
        // single query buried them behind years of delivered history past the row cap).
        // Plus a capped slice of recent completed history for the "All" tab.
        const [act, hist] = await Promise.all([
            directSelect('containers?select=*&status=not.in.(Delivered,%22Turned%20In%22)&order=eta_port.desc.nullslast&limit=5000'),
            directSelect('containers?select=*&status=in.(Delivered,%22Turned%20In%22)&order=created_at.desc&limit=2000'),
        ]);
        const rows = [...(Array.isArray(act.data) ? act.data : []), ...(Array.isArray(hist.data) ? hist.data : [])];
        setRows(rows);
        setLoading(false);
    };
    useEffect(() => {
        load();
        const h = () => load();
        window.addEventListener('containers-changed', h);
        return () => window.removeEventListener('containers-changed', h);
    }, []);

    const setStatus = async (c: Container, status: string) => {
        setRows(p => p.map(x => x.id === c.id ? { ...x, status } : x)); // optimistic
        const { error } = await directUpdate('containers', { id: c.id }, { status });
        if (error) { showToast(`Could not update: ${error.message}`); load(); }
    };
    const del = async (c: Container) => {
        if (!window.confirm(`Delete container ${c.container_no}?`)) return;
        const { error } = await directDelete('containers', { id: c.id });
        if (error) { showToast(`Could not delete: ${error.message}`); return; }
        setRows(p => p.filter(x => x.id !== c.id)); showToast('Container deleted.');
    };

    const fmt = (s?: string) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); } catch { return s; } };
    const DONE = ['Turned In', 'Delivered'];

    // Apply the depot scope before anything else so counts + lists are branch-specific.
    const scopedRows = useMemo(() => branch === 'All' ? rows : rows.filter(c => branchCode(c.branch) === branch), [rows, branch]);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        const list = scopedRows.filter(c => {
            if (tab === 'active' && DONE.includes(c.status)) return false;
            if (tab === 'turnin' && !(c.status === 'Empty' || (c.turn_in_date && c.status !== 'Turned In'))) return false;
            if (!term) return true;
            return `${c.container_no} ${c.client_name || ''} ${c.vessel_name || ''} ${c.client_ref || ''} ${c.commodity || ''}`.toLowerCase().includes(term);
        });
        const cmp = (a: Container, b: Container) => {
            if (sort === 'client') return (a.client_name || '').localeCompare(b.client_name || '') || (b.eta_port || '').localeCompare(a.eta_port || '');
            if (sort === 'container') return (a.container_no || '').localeCompare(b.container_no || '');
            if (sort === 'status') return (a.status || '').localeCompare(b.status || '');
            return (b.eta_port || '').localeCompare(a.eta_port || ''); // eta: newest first
        };
        return [...list].sort(cmp);
    }, [scopedRows, q, tab, sort]);

    // Optional client grouping so several containers for one client read together
    // (e.g. "3 to collect, unpack, split over 2 trucks").
    const grouped = useMemo(() => {
        if (!groupByClient) return null;
        const map = new Map<string, Container[]>();
        filtered.forEach(c => { const k = c.client_name || '—'; map.set(k, [...(map.get(k) || []), c]); });
        return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    }, [filtered, groupByClient]);

    const counts = useMemo(() => {
        const a = scopedRows.filter(c => !DONE.includes(c.status));
        return {
            atSea: scopedRows.filter(c => c.status === 'At Sea').length,
            atPort: scopedRows.filter(c => c.status === 'Arrived Port' || c.status === 'Available').length,
            atDepot: scopedRows.filter(c => c.status === 'At Depot' || c.status === 'Collected').length,
            empty: scopedRows.filter(c => c.status === 'Empty').length,
            active: a.length,
        };
    }, [scopedRows]);

    const card = (label: string, n: number, color: string) => (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[120px]">
            <div className={`text-2xl font-black ${color}`}>{n}</div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div>
        </div>
    );
    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-md ${active ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`;

    const renderRow = (c: Container) => (
        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 text-slate-700">
            <td className="p-2"><button onClick={() => showModal('logContainer', { container: c })} className="font-mono font-bold text-blue-600 hover:underline">{c.container_no}</button><div className="text-[11px] text-slate-400">{[c.size, c.weight ? `${c.weight} kg` : ''].filter(Boolean).join(' · ')}</div></td>
            <td className="p-2">{c.client_name || '—'}{c.client_ref ? <div className="text-[11px] text-slate-400">{c.client_ref}</div> : null}</td>
            <td className="p-2">{c.vessel_name || '—'}<div className="text-[11px] text-slate-400">ETA {fmt(c.eta_port)}</div></td>
            <td className="p-2 text-xs">{c.route_plan ? ROUTE_LABEL[c.route_plan] || c.route_plan : (c.plan === 'full_delivery' ? 'Full delivery' : 'Unpack')}{(c.unpack_by || c.storage_depot) ? <div className="text-[10px] text-slate-400">{c.unpack_by || c.storage_depot}</div> : null}</td>
            <td className="p-2 text-xs">{c.branch || '—'}</td>
            <td className="p-2"><select value={c.status} onChange={e => setStatus(c, e.target.value)} className="bg-white border border-slate-300 rounded-md p-1 text-xs">{CONTAINER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
            <td className="p-2 text-xs">{c.turn_in_area || '—'}{c.turn_in_date ? <div className="text-[11px] text-slate-400">by {fmt(c.turn_in_date)}</div> : null}</td>
            <td className="p-2 text-right whitespace-nowrap">
                <button onClick={() => del(c)} title="Delete" className="text-slate-400 hover:text-red-500">×</button>
            </td>
        </tr>
    );
    const headRow = (
        <tr>
            <th className="p-2">Container</th><th className="p-2">Client</th><th className="p-2">Vessel / ETA</th><th className="p-2">Plan</th><th className="p-2">Branch</th><th className="p-2">Status</th><th className="p-2">Turn-in</th><th className="p-2"></th>
        </tr>
    );

    return (
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Container Monitoring</h3>
                    <p className="text-xs text-slate-500">Vessel → port → depot → unpack/deliver → empty turn-in.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search container / client / vessel" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-56" />
                    <button onClick={() => showModal('logContainer', {})} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap">+ Log container</button>
                </div>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto">
                {card('At sea', counts.atSea, 'text-blue-600')}
                {card('At port', counts.atPort, 'text-amber-600')}
                {card('At depot', counts.atDepot, 'text-teal-600')}
                {card('Empty to turn in', counts.empty, 'text-rose-600')}
                {card('Active', counts.active, 'text-slate-800')}
            </div>

            <div className="flex gap-2 mb-3 flex-wrap items-center">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                    {([['active', 'Active'], ['turnin', 'Empty / turn-in'], ['all', 'All']] as [typeof tab, string][]).map(([v, l]) => (
                        <button key={v} onClick={() => setTab(v)} className={chip(tab === v)}>{l}</button>
                    ))}
                </div>
                {lockBranch ? (
                    <span className="text-xs font-black bg-[#13294b] text-white px-3 py-1.5 rounded-md">{branch} depot</span>
                ) : (
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                        {['All', 'DBN', 'JHB', 'CPT'].map(b => (
                            <button key={b} onClick={() => setBranch(b)} className={chip(branch === b)}>{b === 'All' ? 'All depots' : b}</button>
                        ))}
                    </div>
                )}
                <label className="text-xs text-slate-500 ml-auto flex items-center gap-1">Sort
                    <select value={sort} onChange={e => setSort(e.target.value as any)} className="bg-white border border-slate-300 rounded-md p-1.5 text-xs font-semibold text-slate-700">
                        <option value="eta">ETA (newest)</option>
                        <option value="client">Client</option>
                        <option value="container">Container no</option>
                        <option value="status">Status</option>
                    </select>
                </label>
                <button onClick={() => setGroupByClient(g => !g)} className={`text-xs font-bold px-3 py-1.5 rounded-md border ${groupByClient ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>Group by client</button>
            </div>

            {loading ? <p className="text-center text-slate-400 py-12">Loading…</p> : filtered.length === 0 ? <p className="text-center text-slate-400 py-12">No containers.</p> : (
                <div className="overflow-x-auto max-h-[58vh]">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-100 text-slate-500">{headRow}</thead>
                        {grouped ? grouped.map(([client, list]) => (
                            <tbody key={client}>
                                <tr className="bg-slate-50/80"><td colSpan={8} className="px-2 py-1.5 text-xs font-black text-[#13294b] border-y border-slate-200">{client} <span className="text-slate-400 font-semibold">· {list.length} container{list.length !== 1 ? 's' : ''}</span></td></tr>
                                {list.map(renderRow)}
                            </tbody>
                        )) : <tbody>{filtered.map(renderRow)}</tbody>}
                    </table>
                </div>
            )}
        </div>
    );
};

export default ContainersView;
