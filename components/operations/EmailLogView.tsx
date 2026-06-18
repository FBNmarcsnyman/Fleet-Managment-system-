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

type Party = 'client' | 'supplier';

// Who each email went to, inferred from kind/subject. Client phase emails say
// "shipment"; supplier/driver ones say "load" / "update received" / "POD copy".
const partyOf = (r: EmailRow): Party => {
    const s = (r.subject || '').toLowerCase();
    const k = (r.kind || '').toLowerCase();
    if (k.includes('order') || s.includes('shipment') || s.includes('pod available') || s.includes('track')) return 'client';
    if (k.includes('loadcon') || k.includes('amended') || s.includes('update received') || s.includes('pod copy') || s.includes('load confirmation')) return 'supplier';
    return s.includes('shipment') ? 'client' : 'supplier';
};

const EmailLogView: React.FC = () => {
    const [rows, setRows] = useState<EmailRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [status, setStatus] = useState<'all' | 'failed' | 'opened'>('all');
    const [party, setParty] = useState<'all' | Party>('all');
    const [openId, setOpenId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true); setError(null);
        const { data, error } = await directSelect('email_log?select=*&order=created_at.desc&limit=1000');
        if (error) { setError(error.message); setLoading(false); return; }
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const fmt = (s?: string | null) => { if (!s) return ''; try { return new Date(s).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return s; } };

    // Apply row-level filters, then group by load.
    const groups = useMemo(() => {
        const term = q.trim().toLowerCase();
        const filtered = rows.filter(r => {
            if (status === 'failed' && r.ok) return false;
            if (status === 'opened' && !r.opened_at) return false;
            if (party !== 'all' && partyOf(r) !== party) return false;
            if (term && !`${r.to_email || ''} ${r.subject || ''} ${r.load_con_number || ''} ${r.kind || ''}`.toLowerCase().includes(term)) return false;
            return true;
        });
        const map = new Map<string, EmailRow[]>();
        for (const r of filtered) {
            const key = r.load_con_number || '(no load)';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        return [...map.entries()].map(([loadNo, items]) => {
            const ordered = items.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return {
                loadNo,
                items: ordered,
                lastAt: ordered[0]?.created_at,
                clientCount: items.filter(r => partyOf(r) === 'client').length,
                supplierCount: items.filter(r => partyOf(r) === 'supplier').length,
                opened: items.filter(r => r.opened_at).length,
                failed: items.filter(r => !r.ok).length,
            };
        }).sort((a, b) => new Date(b.lastAt!).getTime() - new Date(a.lastAt!).getTime());
    }, [rows, q, status, party]);

    const totalSent = rows.filter(r => r.ok).length;
    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-md ${active ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`;

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Email Tracking</h3>
                    <p className="text-xs text-slate-500">Grouped per load — {rows.length} emails · {totalSent} sent · {rows.filter(r => r.opened_at).length} opened.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search load / recipient / subject" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-64" />
                    <button onClick={load} className="text-sm font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 px-3 rounded-lg">Refresh</button>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {([['all', 'Everyone'], ['client', 'Client'], ['supplier', 'Supplier / Driver']] as [typeof party, string][]).map(([v, l]) => (
                        <button key={v} onClick={() => setParty(v)} className={chip(party === v)}>{l}</button>
                    ))}
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {([['all', 'All'], ['failed', 'Failed'], ['opened', 'Opened']] as [typeof status, string][]).map(([v, l]) => (
                        <button key={v} onClick={() => setStatus(v)} className={chip(status === v)}>{l}</button>
                    ))}
                </div>
            </div>

            {loading && <p className="text-center text-slate-400 py-16">Loading…</p>}
            {error && <p className="text-center text-red-500 py-16">Couldn't load: {error}</p>}
            {!loading && !error && groups.length === 0 && <p className="text-center text-slate-400 py-16">No emails match. Sends appear here from now on.</p>}

            <div className="space-y-3">
                {groups.map(g => {
                    const open = openId === g.loadNo;
                    return (
                        <div key={g.loadNo} className="border border-slate-200 rounded-xl overflow-hidden">
                            <button onClick={() => setOpenId(open ? null : g.loadNo)} className="w-full flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-slate-100 text-left">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 font-mono truncate">{g.loadNo}</div>
                                    <div className="text-xs text-slate-500">{g.items.length} email{g.items.length !== 1 ? 's' : ''} · last {fmt(g.lastAt)}</div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {g.clientCount > 0 && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{g.clientCount} client</span>}
                                    {g.supplierCount > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{g.supplierCount} supplier</span>}
                                    {g.opened > 0 && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{g.opened} opened</span>}
                                    {g.failed > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-full">{g.failed} failed</span>}
                                    <span className="text-slate-400 ml-1">{open ? '▲' : '▼'}</span>
                                </div>
                            </button>
                            {open && (
                                <table className="w-full text-left text-sm">
                                    <tbody>
                                        {g.items.map(r => {
                                            const p = partyOf(r);
                                            return (
                                                <tr key={r.id} className="border-t border-slate-100 align-top">
                                                    <td className="p-2 whitespace-nowrap">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{p === 'client' ? 'Client' : 'Supplier/Driver'}</span>
                                                    </td>
                                                    <td className="p-2 whitespace-nowrap text-slate-500">{r.kind || '—'}</td>
                                                    <td className="p-2 text-slate-700">{r.to_email}<div className="text-slate-400 text-[11px]">{fmt(r.created_at)}{r.cc_text ? ` · cc ${r.cc_text}` : ''}</div></td>
                                                    <td className="p-2 max-w-[20rem] truncate text-slate-600" title={r.subject || ''}>{r.subject}</td>
                                                    <td className="p-2 whitespace-nowrap">{r.ok ? <span className="text-xs font-semibold text-green-700">Sent ✓</span> : <span className="text-xs font-semibold text-red-700" title={r.error || ''}>Failed ✗</span>}</td>
                                                    <td className="p-2 whitespace-nowrap">{r.opened_at ? <span className="text-xs font-semibold text-green-700" title={fmt(r.opened_at)}>Opened ✓</span> : <span className="text-xs text-slate-400">—</span>}</td>
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
        </div>
    );
};

export default EmailLogView;
