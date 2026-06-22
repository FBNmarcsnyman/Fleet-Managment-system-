import React, { useEffect, useMemo, useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { directSelect, directUpdate, directDelete } from '../../lib/supabase';
import { CONTAINER_STATUSES } from './LogContainerModal';

interface Container {
    id: string; container_no: string; seal_no: string; size: string; weight: number;
    commodity: string; client_name: string; client_ref: string; vessel_name: string;
    shipping_line: string; eta_port: string; plan: string; status: string; branch: string;
    turn_in_area: string; turn_in_date: string; notes: string;
}

// Container monitoring — from vessel/port through depot to empty turn-in.
const ContainersView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const [rows, setRows] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [tab, setTab] = useState<'active' | 'all' | 'turnin'>('active');

    const load = async () => {
        setLoading(true);
        // Order most-recent ETA first and lift the cap so active (recent) containers
        // aren't buried behind years of delivered history (2,000+ rows).
        const { data } = await directSelect('containers?select=*&order=eta_port.desc.nullslast,created_at.desc&limit=5000');
        setRows(Array.isArray(data) ? data : []);
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

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter(c => {
            if (tab === 'active' && DONE.includes(c.status)) return false;
            if (tab === 'turnin' && !(c.status === 'Empty' || (c.turn_in_date && c.status !== 'Turned In'))) return false;
            if (!term) return true;
            return `${c.container_no} ${c.client_name || ''} ${c.vessel_name || ''} ${c.client_ref || ''}`.toLowerCase().includes(term);
        });
    }, [rows, q, tab]);

    const counts = useMemo(() => {
        const a = rows.filter(c => !DONE.includes(c.status));
        return {
            atSea: rows.filter(c => c.status === 'At Sea').length,
            atPort: rows.filter(c => c.status === 'Arrived Port' || c.status === 'Available').length,
            atDepot: rows.filter(c => c.status === 'At Depot' || c.status === 'Collected').length,
            empty: rows.filter(c => c.status === 'Empty').length,
            active: a.length,
        };
    }, [rows]);

    const card = (label: string, n: number, color: string) => (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[120px]">
            <div className={`text-2xl font-black ${color}`}>{n}</div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div>
        </div>
    );
    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-md ${active ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`;

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

            <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-lg w-fit">
                {([['active', 'Active'], ['turnin', 'Empty / turn-in'], ['all', 'All']] as [typeof tab, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setTab(v)} className={chip(tab === v)}>{l}</button>
                ))}
            </div>

            {loading ? <p className="text-center text-slate-400 py-12">Loading…</p> : filtered.length === 0 ? <p className="text-center text-slate-400 py-12">No containers.</p> : (
                <div className="overflow-x-auto max-h-[58vh]">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-100 text-slate-500"><tr>
                            <th className="p-2">Container</th><th className="p-2">Client</th><th className="p-2">Vessel / ETA</th><th className="p-2">Plan</th><th className="p-2">Branch</th><th className="p-2">Status</th><th className="p-2">Turn-in</th><th className="p-2"></th>
                        </tr></thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 text-slate-700">
                                    <td className="p-2"><button onClick={() => showModal('logContainer', { container: c })} className="font-mono font-bold text-blue-600 hover:underline">{c.container_no}</button><div className="text-[11px] text-slate-400">{[c.size, c.weight ? `${c.weight} kg` : ''].filter(Boolean).join(' · ')}</div></td>
                                    <td className="p-2">{c.client_name || '—'}{c.client_ref ? <div className="text-[11px] text-slate-400">{c.client_ref}</div> : null}</td>
                                    <td className="p-2">{c.vessel_name || '—'}<div className="text-[11px] text-slate-400">ETA {fmt(c.eta_port)}</div></td>
                                    <td className="p-2 text-xs">{c.plan === 'full_delivery' ? 'Full delivery' : 'Unpack'}</td>
                                    <td className="p-2 text-xs">{c.branch || '—'}</td>
                                    <td className="p-2"><select value={c.status} onChange={e => setStatus(c, e.target.value)} className="bg-white border border-slate-300 rounded-md p-1 text-xs">{CONTAINER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                                    <td className="p-2 text-xs">{c.turn_in_area || '—'}{c.turn_in_date ? <div className="text-[11px] text-slate-400">by {fmt(c.turn_in_date)}</div> : null}</td>
                                    <td className="p-2 text-right whitespace-nowrap">
                                        {c.plan !== 'full_delivery' && <button onClick={() => showModal('bulkCollection', {})} title="Unpack into shipments" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 mr-2">Unpack →</button>}
                                        <button onClick={() => del(c)} title="Delete" className="text-slate-400 hover:text-red-500">×</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ContainersView;
