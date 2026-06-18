import React, { useEffect, useMemo, useState } from 'react';
import { directSelect } from '../../lib/supabase';

interface WaMsg {
    id: string;
    load_id: string | null;
    load_con_number: string | null;
    direction: 'in' | 'out';
    wa_number: string | null;
    party: string | null;
    body: string;
    status_after: string | null;
    created_at: string;
}

// Read-only viewer of the WhatsApp transcript with drivers, grouped per load.
// Inbound (driver) messages sit left/grey; our outbound sit right/navy. Status
// milestones the driver pushed show as a green badge.
const WhatsAppChatsView: React.FC = () => {
    const [msgs, setMsgs] = useState<WaMsg[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true); setError(null);
        const { data, error } = await directSelect('whatsapp_messages?select=*&order=created_at.desc&limit=1000');
        if (error) { setError(error.message); setLoading(false); return; }
        setMsgs(Array.isArray(data) ? data : []);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    // Group into conversations keyed by load (fallback to the driver number).
    const conversations = useMemo(() => {
        const groups = new Map<string, WaMsg[]>();
        for (const m of msgs) {
            const key = m.load_id || m.load_con_number || m.wa_number || 'unknown';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(m);
        }
        const list = [...groups.entries()].map(([key, items]) => {
            const ordered = items.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const last = ordered[ordered.length - 1];
            const driverParty = ordered.find(m => m.direction === 'in' && m.party && m.party !== 'Unknown')?.party;
            return {
                key,
                loadConNumber: last.load_con_number || '(unmatched)',
                number: last.wa_number || '',
                driver: driverParty || 'Driver',
                lastAt: last.created_at,
                lastStatus: [...ordered].reverse().find(m => m.status_after)?.status_after || null,
                count: ordered.length,
                items: ordered,
            };
        }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        const term = q.trim().toLowerCase();
        if (!term) return list;
        return list.filter(c => `${c.loadConNumber} ${c.number} ${c.driver}`.toLowerCase().includes(term));
    }, [msgs, q]);

    const fmt = (s: string) => { try { return new Date(s).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return s; } };

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Driver WhatsApp Chats</h3>
                    <p className="text-xs text-slate-500">Conversations and status updates drivers sent in. Read-only.</p>
                </div>
                <div className="flex items-center gap-2">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search load / driver / number"
                        className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-64" />
                    <button onClick={load} className="text-sm font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 px-3 rounded-lg">Refresh</button>
                </div>
            </div>

            {loading && <p className="text-center text-slate-400 py-16">Loading chats…</p>}
            {error && <p className="text-center text-red-500 py-16">Couldn't load chats: {error}</p>}
            {!loading && !error && conversations.length === 0 && (
                <p className="text-center text-slate-400 py-16">No driver WhatsApp messages yet. They'll appear here as drivers reply to load updates.</p>
            )}

            <div className="space-y-3">
                {conversations.map(c => {
                    const open = openId === c.key;
                    return (
                        <div key={c.key} className="border border-slate-200 rounded-xl overflow-hidden">
                            <button onClick={() => setOpenId(open ? null : c.key)}
                                className="w-full flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-slate-100 text-left">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">
                                        {c.loadConNumber} <span className="text-slate-400 font-normal">· {c.driver}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">{c.number} · {c.count} message{c.count !== 1 ? 's' : ''} · last {fmt(c.lastAt)}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {c.lastStatus && <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">{c.lastStatus}</span>}
                                    <span className="text-slate-400">{open ? '▲' : '▼'}</span>
                                </div>
                            </button>
                            {open && (
                                <div className="p-3 space-y-2 bg-white">
                                    {c.items.map(m => (
                                        <div key={m.id} className={`flex ${m.direction === 'in' ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.direction === 'in' ? 'bg-slate-100 text-slate-800 rounded-bl-sm' : 'bg-[#13294b] text-white rounded-br-sm'}`}>
                                                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                                                <div className={`text-[10px] mt-1 ${m.direction === 'in' ? 'text-slate-400' : 'text-blue-200'}`}>
                                                    {m.direction === 'in' ? (m.party || 'Driver') : 'FBN'} · {fmt(m.created_at)}{m.status_after ? ` · → ${m.status_after}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WhatsAppChatsView;
