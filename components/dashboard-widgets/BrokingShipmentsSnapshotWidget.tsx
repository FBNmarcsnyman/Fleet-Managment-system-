import React, { useMemo } from 'react';
import { LoadConfirmation, ViewType } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { startOfToday } from 'date-fns';

// Management snapshot: what's slipping on each side of the business. Broking
// (brokered freight) and Operations/Shipments (own consolidation) shown side by
// side, each with the loads that should have moved on by now — not collected,
// not delivered, not updated since yesterday, awaiting POD.
const PRE_COLLECTION = ['Booked', 'Driver Assigned', 'At Collection Point', 'Loading'];
const MOVING = ['Collected', 'At Collection Depot', 'In Transit', 'At Destination Depot', 'Unloaded', 'Out for Delivery'];
const CLOSED = ['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'];

const before = (d?: string, t?: number) => { if (!d || !t) return false; const x = new Date(d).getTime(); return !isNaN(x) && x < t; };

const buckets = (loads: LoadConfirmation[], todayStart: number) => {
    const active = loads.filter(lc => !CLOSED.includes(lc.status));
    return {
        notCollected: active.filter(lc => PRE_COLLECTION.includes(lc.status) && before(lc.collectionDate, todayStart)),
        notDelivered: active.filter(lc => MOVING.includes(lc.status) && before(lc.collectionDate, todayStart)),
        notUpdated: active.filter(lc => before(lc.updatedAt || lc.date, todayStart)),
        awaitingPod: loads.filter(lc => lc.status === 'Delivered' && !lc.podPhoto),
        active: active.length,
    };
};

const BrokingShipmentsSnapshotWidget: React.FC = () => {
    const { loadConfirmations = [] } = useOperations();
    const { handleViewChange, handleOperationsSubViewChange } = useUIState();

    const { broking, shipments } = useMemo(() => {
        const todayStart = startOfToday().getTime();
        const all = loadConfirmations || [];
        return {
            broking: buckets(all.filter(lc => !lc.isCollection), todayStart),
            shipments: buckets(all.filter(lc => lc.isCollection), todayStart),
        };
    }, [loadConfirmations]);

    const open = (view: ViewType, subView: string) => { handleOperationsSubViewChange(subView); handleViewChange(view); };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AreaCard title="Broking" subtitle="Brokered freight" accent="blue" data={broking}
                onOpen={() => open('broking', 'loadBoard')} />
            <AreaCard title="Shipments" subtitle="Consolidation & line-haul" accent="teal" data={shipments}
                onOpen={() => open('operations', 'shipments')} />
        </div>
    );
};

const AreaCard: React.FC<{ title: string; subtitle: string; accent: 'blue' | 'teal'; data: ReturnType<typeof buckets>; onOpen: () => void }> = ({ title, subtitle, accent, data, onOpen }) => {
    const ring = accent === 'blue' ? 'border-blue-200' : 'border-teal-200';
    const badge = accent === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800';
    return (
        <div className={`bg-white border ${ring} rounded-xl p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
                <div>
                    <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${badge}`}>{title}</span>
                    <p className="text-[11px] text-slate-500 mt-1">{subtitle} · {data.active} active</p>
                </div>
                <button onClick={onOpen} className="text-[11px] font-bold text-slate-500 hover:text-slate-900">Open →</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Tile label="Not collected" items={data.notCollected} tone="amber" onClick={onOpen} />
                <Tile label="Not delivered" items={data.notDelivered} tone="red" onClick={onOpen} />
                <Tile label="Not updated since yesterday" items={data.notUpdated} tone="slate" onClick={onOpen} />
                <Tile label="Awaiting POD" items={data.awaitingPod} tone="blue" onClick={onOpen} />
            </div>
        </div>
    );
};

const TONES: Record<string, string> = {
    amber: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-700', blue: 'text-blue-600',
};

const Tile: React.FC<{ label: string; items: LoadConfirmation[]; tone: string; onClick: () => void }> = ({ label, items, tone, onClick }) => (
    <button onClick={onClick} className="text-left bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-slate-400 transition">
        <div className={`text-2xl font-black ${items.length ? TONES[tone] : 'text-slate-300'}`}>{items.length}</div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight mt-0.5">{label}</div>
    </button>
);

export default BrokingShipmentsSnapshotWidget;
