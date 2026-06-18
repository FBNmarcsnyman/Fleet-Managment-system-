import React, { useEffect, useMemo, useState } from 'react';
import { directSelect } from '../../lib/supabase';

interface EmailRow {
    id: string;
    load_con_number: string | null;
    to_email: string | null;
    cc_text: string | null;
    subject: string | null;
    kind: string | null;
    ok: boolean;
    error: string | null;
    opened_at: string | null;
    created_at: string;
}

// Read-only log of every email the app sent: who it went to, whether Gmail
// accepted it (Sent), and whether it was later opened (tracking pixel).
const EmailLogView: React.FC = () => {
    const [rows, setRows] = useState<EmailRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [tab, setTab] = useState<'all' | 'failed' | 'opened'>('all');

    const load = async () => {
        setLoading(true); setError(null);
        const { data, error } = await directSelect('email_log?select=*&order=created_at.desc&limit=500');
        if (error) { setError(error.message); setLoading(false); return; }
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter(r => {
            if (tab === 'failed' && r.ok) return false;
            if (tab === 'opened' && !r.opened_at) return false;
            if (!term) return true;
            return `${r.to_email || ''} ${r.subject || ''} ${r.load_con_number || ''} ${r.kind || ''}`.toLowerCase().includes(term);
        });
    }, [rows, q, tab]);

    const fmt = (s?: string | null) => { if (!s) return ''; try { return new Date(s).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return s; } };
    const sentCount = rows.filter(r => r.ok).length;
    const failedCount = rows.filter(r => !r.ok).length;
    const openedCount = rows.filter(r => r.opened_at).length;

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Email Tracking</h3>
                    <p className="text-xs text-slate-500">Every email the system sent — {sentCount} sent · {failedCount} failed · {openedCount} opened.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search recipient / subject / load"
                        className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-64" />
                    <button onClick={load} className="text-sm font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 px-3 rounded-lg">Refresh</button>
                </div>
            </div>

            <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-lg w-fit">
                {([['all', 'All'], ['failed', 'Failed only'], ['opened', 'Opened']] as [typeof tab, string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setTab(v)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md ${tab === v ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`}>{label}</button>
                ))}
            </div>

            {loading && <p className="text-center text-slate-400 py-16">Loading…</p>}
            {error && <p className="text-center text-red-500 py-16">Couldn't load: {error}</p>}
            {!loading && !error && filtered.length === 0 && (
                <p className="text-center text-slate-400 py-16">No emails logged yet. Sends will appear here from now on.</p>
            )}

            {!loading && !error && filtered.length > 0 && (
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-100">
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="p-2 whitespace-nowrap">Sent</th>
                                <th className="p-2">Load</th>
                                <th className="p-2">Type</th>
                                <th className="p-2">To</th>
                                <th className="p-2">Subject</th>
                                <th className="p-2">Status</th>
                                <th className="p-2">Opened</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => (
                                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 text-slate-700 align-top">
                                    <td className="p-2 whitespace-nowrap text-slate-500">{fmt(r.created_at)}</td>
                                    <td className="p-2 font-mono text-xs">{r.load_con_number || '—'}</td>
                                    <td className="p-2 whitespace-nowrap">{r.kind || '—'}</td>
                                    <td className="p-2">{r.to_email}{r.cc_text ? <span className="text-slate-400 text-xs block">cc: {r.cc_text}</span> : null}</td>
                                    <td className="p-2 max-w-[24rem] truncate" title={r.subject || ''}>{r.subject}</td>
                                    <td className="p-2 whitespace-nowrap">
                                        {r.ok
                                            ? <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">Sent ✓</span>
                                            : <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full" title={r.error || ''}>Failed ✗</span>}
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                        {r.opened_at
                                            ? <span className="text-xs font-semibold text-green-700" title={fmt(r.opened_at)}>Opened ✓</span>
                                            : <span className="text-xs text-slate-400">—</span>}
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

export default EmailLogView;
