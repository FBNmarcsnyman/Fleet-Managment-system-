import React, { useMemo } from 'react';
import { useOperations } from '../../contexts/AppContexts';
import { LoadConfirmation } from '../../types';

const rand = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;

// Margin performance on brokered (subcontracted) loads: what we billed clients
// vs what we paid carriers, and which carriers we use most.
const SubcontractorMarginWidget: React.FC = () => {
    const { loadConfirmations = [], suppliers = [] } = useOperations();

    const data = useMemo(() => {
        const brokered = (loadConfirmations as LoadConfirmation[]).filter(
            l => l.status !== 'Cancelled' && (l.supplierId || l.subcontractorName) && (l.supplierRate || 0) > 0
        );
        const revenue = brokered.reduce((s, l) => s + (l.totalAmount || 0), 0);
        const cost = brokered.reduce((s, l) => s + (l.supplierRate || 0), 0);
        const margin = revenue - cost;
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

        const byName = new Map<string, { loads: number; cost: number; margin: number }>();
        brokered.forEach(l => {
            const name = l.subcontractorName
                || (suppliers as any[]).find(s => s.id === l.supplierId)?.name
                || 'Unknown';
            const cur = byName.get(name) || { loads: 0, cost: 0, margin: 0 };
            cur.loads += 1;
            cur.cost += l.supplierRate || 0;
            cur.margin += (l.totalAmount || 0) - (l.supplierRate || 0);
            byName.set(name, cur);
        });
        const top = [...byName.entries()]
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 5);

        return { count: brokered.length, revenue, cost, margin, marginPct, top };
    }, [loadConfirmations, suppliers]);

    if (data.count === 0) {
        return <p className="text-sm text-gray-500 italic py-6 text-center">No subcontracted loads yet — margins will show here once you broker loads.</p>;
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-900/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subbie spend</p>
                    <p className="text-lg font-black text-white truncate">{rand(data.cost)}</p>
                </div>
                <div className="bg-gray-900/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gross margin</p>
                    <p className="text-lg font-black text-emerald-400 truncate">{rand(data.margin)}</p>
                </div>
                <div className="bg-gray-900/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Margin %</p>
                    <p className={`text-lg font-black truncate ${data.marginPct < 10 ? 'text-red-400' : 'text-emerald-400'}`}>{data.marginPct.toFixed(1)}%</p>
                </div>
            </div>
            <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Most-used carriers</p>
                <div className="space-y-1.5">
                    {data.top.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-3 text-sm">
                            <span className="w-5 text-gray-600 font-black text-xs">{i + 1}</span>
                            <span className="flex-1 text-gray-200 font-semibold truncate">{s.name}</span>
                            <span className="text-[11px] text-gray-500">{s.loads} load{s.loads !== 1 ? 's' : ''}</span>
                            <span className="w-24 text-right font-mono text-[11px] text-gray-400">{rand(s.cost)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SubcontractorMarginWidget;
