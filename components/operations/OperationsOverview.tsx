import React, { useMemo } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { isAssigned, STATUS_LABEL, statusChip } from '../../lib/loadStatus';

// Operations Dashboard — the consolidation / line-haul side (own cargo moving
// through the depot flow). Distinct from the Broking dashboard, which tracks
// brokered subcontractor loads. Driven off `is_collection` shipments.
const STAGE_BUCKETS: { title: string; statuses: string[]; accent: string }[] = [
    { title: 'Collecting', statuses: ['Booked', 'Driver Assigned', 'At Collection Point', 'Loading', 'Collected'], accent: 'text-amber-600' },
    { title: 'At Depot / Line-haul', statuses: ['At Collection Depot', 'In Transit'], accent: 'text-blue-600' },
    { title: 'Destination / Delivering', statuses: ['At Destination Depot', 'Unloaded', 'Out for Delivery'], accent: 'text-purple-600' },
    { title: 'Delivered / POD', statuses: ['Delivered', 'POD Submitted'], accent: 'text-emerald-600' },
];

const OperationsOverview: React.FC = () => {
    const { loadConfirmations = [], clients = [] } = useOperations() as any;
    const { showModal, handleOperationsSubViewChange } = useUIState();
    const goShipments = () => handleOperationsSubViewChange('shipments');

    const clientName = (lc: LoadConfirmation) => (clients as any[]).find(c => c.id === lc.clientId)?.name || lc.clientName || '—';

    const shipments = useMemo(() =>
        (loadConfirmations as LoadConfirmation[]).filter(lc => lc.isCollection && !['Invoiced', 'Cancelled'].includes(lc.status)),
        [loadConfirmations]);

    const buckets = useMemo(() => STAGE_BUCKETS.map(b => ({
        ...b, count: shipments.filter(lc => b.statuses.includes(lc.status)).length,
    })), [shipments]);

    // Cargo still to move, grouped by lane (collection branch → destination branch).
    const lanes = useMemo(() => {
        const map = new Map<string, { lane: string; count: number; pkgs: number; weight: number; cube: number }>();
        shipments.filter(lc => !['Delivered', 'POD Submitted'].includes(lc.status)).forEach(lc => {
            const key = `${lc.collectionBranch || '?'} → ${lc.destinationBranch || '?'}`;
            const m = map.get(key) || { lane: key, count: 0, pkgs: 0, weight: 0, cube: 0 };
            m.count++; m.pkgs += Number(lc.loadedPackages) || 0; m.weight += Number(lc.weightKg) || 0; m.cube += Number((lc as any).cubeM3) || 0;
            map.set(key, m);
        });
        return [...map.values()].sort((a, b) => b.count - a.count);
    }, [shipments]);
    const kg = (n: number) => Math.round(n).toLocaleString('en-ZA');

    const awaitingDriver = useMemo(() =>
        shipments.filter(lc => !isAssigned(lc) && !['Delivered', 'POD Submitted'].includes(lc.status)),
        [shipments]);
    const awaitingPod = useMemo(() =>
        shipments.filter(lc => lc.status === 'Delivered' && !lc.podPhoto),
        [shipments]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-black text-slate-900">Operations overview</h3>
                <p className="text-xs text-slate-500">Own consolidation &amp; line-haul cargo — collect → depot → line-haul → deliver → POD.</p>
            </div>

            {/* Stage KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {buckets.map(b => (
                    <button key={b.title} onClick={goShipments}
                        className="text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-400 transition">
                        <div className={`text-3xl font-black ${b.accent}`}>{b.count}</div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">{b.title}</div>
                    </button>
                ))}
            </div>

            {/* Cargo to move by lane */}
            <div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Cargo to move</p>
                {lanes.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {lanes.map(l => (
                            <div key={l.lane} className="shrink-0 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm min-w-[150px]">
                                <div className="text-sm font-black text-[#13294b]">{l.lane}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{l.count} shipment{l.count !== 1 ? 's' : ''}</div>
                                <div className="text-[11px] text-slate-700 font-bold mt-1">{l.pkgs} pkgs · {kg(l.weight)} kg{l.cube ? ` · ${l.cube.toFixed(1)} m³` : ''}</div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-xs text-slate-400 italic">No cargo currently in transit.</p>}
            </div>

            {/* Action queues */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Queue title="Awaiting collection driver" items={awaitingDriver} clientName={clientName}
                    action={(lc) => (
                        <div className="flex gap-1.5">
                            <button onClick={() => showModal('assignFbn', { loadCon: lc })} className="text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-2.5 rounded-lg uppercase">FBN</button>
                            <button onClick={() => showModal('assignLoadCon', { loadCon: lc })} className="text-[10px] font-black bg-amber-500 hover:bg-amber-400 text-white py-1.5 px-2.5 rounded-lg uppercase">Subbie</button>
                        </div>
                    )} />
                <Queue title="Awaiting POD" items={awaitingPod} clientName={clientName}
                    action={(lc) => (
                        <button onClick={() => showModal('pod', { loadCon: lc, isManualUpload: true })} className="text-[10px] font-black bg-blue-600 hover:bg-blue-500 text-white py-1.5 px-2.5 rounded-lg uppercase">Get POD</button>
                    )} />
            </div>
        </div>
    );
};

const Queue: React.FC<{ title: string; items: LoadConfirmation[]; clientName: (lc: LoadConfirmation) => string; action: (lc: LoadConfirmation) => React.ReactNode }> = ({ title, items, clientName, action }) => {
    const { showModal } = useUIState();
    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">{title} ({items.length})</h4>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {items.length > 0 ? items.map(lc => (
                    <div key={lc.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center gap-2">
                        <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-left min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{clientName(lc)}</p>
                            <p className="font-mono text-[10px] text-slate-500">{lc.loadConNumber}</p>
                            <p className="text-[10px] text-slate-500 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                            <span className={`inline-block mt-1 text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                        </button>
                        <div className="shrink-0">{action(lc)}</div>
                    </div>
                )) : <p className="text-xs text-slate-400 text-center py-6 italic font-medium">Nothing in this queue.</p>}
            </div>
        </div>
    );
};

export default OperationsOverview;
