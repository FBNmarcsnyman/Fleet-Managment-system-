import React, { useEffect, useState } from 'react';
import { directSelect } from '../../lib/supabase';
import { STATUS_LABEL } from '../../lib/loadStatus';

interface Row { id: string; status: string; source: string | null; created_at: string; note: string | null; }

// Vertical, timestamped trail of a shipment's status changes (who moved it, when).
const LoadStatusTimeline: React.FC<{ loadId: string }> = ({ loadId }) => {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data } = await directSelect(`load_status_history?select=*&load_id=eq.${loadId}&order=created_at.asc`);
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
    };
    useEffect(() => { load(); }, [loadId]);

    const fmt = (s: string) => { try { return new Date(s).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return s; } };
    const label = (s: string) => (STATUS_LABEL as any)[s] || s;
    const srcBadge = (src: string | null) => {
        const map: Record<string, { t: string; c: string }> = {
            driver: { t: 'Driver', c: 'bg-emerald-100 text-emerald-800' },
            staff: { t: 'Staff', c: 'bg-blue-100 text-blue-800' },
            booking: { t: 'Booked', c: 'bg-amber-100 text-amber-800' },
            seed: { t: 'Current', c: 'bg-gray-700 text-gray-300' },
        };
        const m = map[src || ''] || { t: src || 'System', c: 'bg-gray-700 text-gray-300' };
        return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.c}`}>{m.t}</span>;
    };

    return (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/60 p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center text-xs font-black text-gray-300 uppercase tracking-[0.15em]"><span className="w-1.5 h-4 rounded-full mr-2 bg-emerald-500" />Status timeline</h3>
                <button onClick={load} className="text-[10px] font-bold text-gray-400 hover:text-white">↻ Refresh</button>
            </div>
            {loading && <p className="text-xs text-gray-500">Loading…</p>}
            {!loading && rows.length === 0 && <p className="text-xs text-gray-500">No status changes logged yet.</p>}
            <ol className="space-y-0">
                {rows.map((r, i) => (
                    <li key={r.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <span className={`w-2.5 h-2.5 rounded-full mt-1 ${i === rows.length - 1 ? 'bg-emerald-400 ring-2 ring-emerald-400/30' : 'bg-gray-500'}`} />
                            {i < rows.length - 1 && <span className="w-px flex-1 bg-gray-600 my-0.5" />}
                        </div>
                        <div className="pb-3 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white">{label(r.status)}</span>
                                {srcBadge(r.source)}
                            </div>
                            <div className="text-[11px] text-gray-400">{fmt(r.created_at)}</div>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default LoadStatusTimeline;
