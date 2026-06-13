import React, { useMemo } from 'react';
import { useOperations } from '../../contexts/AppContexts';
import { LoadConfirmation } from '../../types';

const rand = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;

const STAGES: { label: string; statuses: string[]; color: string }[] = [
    { label: 'Booked', statuses: ['Booked'], color: 'bg-gray-400' },
    { label: 'Assigned', statuses: ['Driver Assigned'], color: 'bg-blue-500' },
    { label: 'In Transit', statuses: ['At Collection Point', 'Collected', 'At Collection Depot', 'In Transit', 'At Destination Depot', 'Out for Delivery'], color: 'bg-amber-500' },
    { label: 'Delivered', statuses: ['Delivered', 'POD Submitted'], color: 'bg-emerald-500' },
    { label: 'Invoiced', statuses: ['Invoiced'], color: 'bg-purple-500' },
];

// A live pipeline of every active load by stage — how many, and how much
// revenue sits at each point in the journey.
const LoadPipelineWidget: React.FC = () => {
    const { loadConfirmations = [] } = useOperations();

    const { rows, maxCount, openValue } = useMemo(() => {
        const loads = (loadConfirmations as LoadConfirmation[]).filter(l => l.status !== 'Cancelled');
        const rows = STAGES.map(s => {
            const items = loads.filter(l => s.statuses.includes(l.status));
            return { ...s, count: items.length, value: items.reduce((sum, l) => sum + (l.totalAmount || 0), 0) };
        });
        const maxCount = Math.max(1, ...rows.map(r => r.count));
        // "Open" = anything not yet invoiced/delivered, i.e. money still on the road.
        const openValue = loads
            .filter(l => !['Delivered', 'POD Submitted', 'Invoiced'].includes(l.status))
            .reduce((sum, l) => sum + (l.totalAmount || 0), 0);
        return { rows, maxCount, openValue };
    }, [loadConfirmations]);

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Revenue in progress</p>
                    <p className="text-2xl font-black text-white">{rand(openValue)}</p>
                </div>
                <p className="text-[11px] text-gray-500">{rows.reduce((s, r) => s + r.count, 0)} active loads</p>
            </div>
            <div className="space-y-2.5">
                {rows.map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-xs font-bold text-gray-400">{r.label}</span>
                        <div className="flex-1 bg-gray-900/60 rounded-full h-6 overflow-hidden">
                            <div className={`h-full ${r.color} rounded-full flex items-center justify-end px-2 transition-all duration-500`} style={{ width: `${Math.max(8, (r.count / maxCount) * 100)}%` }}>
                                <span className="text-[11px] font-black text-white/90">{r.count}</span>
                            </div>
                        </div>
                        <span className="w-24 shrink-0 text-right text-[11px] font-mono text-gray-400">{rand(r.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LoadPipelineWidget;
