import React, { useMemo } from 'react';
import { useOperations } from '../../contexts/AppContexts';
import { LoadConfirmation } from '../../types';

const rand = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;

// Which clients drive the most revenue — ranked by total billed across all
// their loads (cancelled excluded).
const TopClientsWidget: React.FC = () => {
    const { loadConfirmations = [], clients = [] } = useOperations();

    const { top, maxRevenue, total } = useMemo(() => {
        const loads = (loadConfirmations as LoadConfirmation[]).filter(l => l.status !== 'Cancelled');
        const byName = new Map<string, { revenue: number; loads: number }>();
        loads.forEach(l => {
            const name = l.clientName
                || (clients as any[]).find(c => c.id === l.clientId)?.name
                || 'Unknown';
            const cur = byName.get(name) || { revenue: 0, loads: 0 };
            cur.revenue += l.totalAmount || 0;
            cur.loads += 1;
            byName.set(name, cur);
        });
        const ranked = [...byName.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
        const total = ranked.reduce((s, r) => s + r.revenue, 0);
        return { top: ranked.slice(0, 6), maxRevenue: Math.max(1, ...ranked.map(r => r.revenue)), total };
    }, [loadConfirmations, clients]);

    if (top.length === 0) {
        return <p className="text-sm text-gray-500 italic py-6 text-center">No client revenue yet.</p>;
    }

    return (
        <div className="space-y-4">
            <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Total billed</p>
                <p className="text-2xl font-black text-white">{rand(total)}</p>
            </div>
            <div className="space-y-2.5">
                {top.map(c => (
                    <div key={c.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-semibold text-gray-200 truncate pr-2">{c.name}</span>
                            <span className="font-mono text-[11px] text-gray-400 shrink-0">{rand(c.revenue)} · {c.loads}</span>
                        </div>
                        <div className="bg-gray-900/60 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${(c.revenue / maxRevenue) * 100}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TopClientsWidget;
