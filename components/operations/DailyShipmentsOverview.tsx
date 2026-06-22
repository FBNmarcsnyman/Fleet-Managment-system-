import React, { useEffect, useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { STATUS_LABEL, statusChip } from '../../lib/loadStatus';
import { directSelect } from '../../lib/supabase';

// FBN daily operations overview: the whole live pipeline at a glance — what's
// booked / loading / collected / in transit / at depot / delivered / awaiting POD,
// plus what's inbound between depots ("coming from JHB"). Click a stage to list it.
const PIPELINE: { key: LoadConfirmation['status']; label: string }[] = [
    { key: 'Booked', label: 'Booked' },
    { key: 'Driver Assigned', label: 'Assigned' },
    { key: 'At Collection Point', label: 'At Collection' },
    { key: 'Loading', label: 'Loading' },
    { key: 'Collected', label: 'Collected / Loaded' },
    { key: 'At Collection Depot', label: 'At Collect Depot' },
    { key: 'In Transit', label: 'In Transit' },
    { key: 'At Destination Depot', label: 'At Dest Depot' },
    { key: 'Out for Delivery', label: 'Out for Delivery' },
    { key: 'Delivered', label: 'Delivered · awaiting POD' },
    { key: 'POD Submitted', label: 'POD In' },
];
const todayIso = () => new Date().toISOString().slice(0, 10);
const dOnly = (s?: string) => (s || '').slice(0, 10);

const DailyShipmentsOverview: React.FC = () => {
    const { loadConfirmations = [], clients = [] } = useOperations() as any;
    const { showModal, handleOperationsSubViewChange } = useUIState() as any;
    const [sel, setSel] = useState<string | null>(null);

    // Container snapshot for the overview — loaded straight from the containers
    // table (same source as the Containers tab) and kept fresh on changes.
    const [containers, setContainers] = useState<any[]>([]);
    useEffect(() => {
        let alive = true;
        const load = async () => {
            const { data } = await directSelect('containers?select=id,container_no,client_name,client_ref,vessel_name,eta_port,plan,status,branch,turn_in_area,turn_in_date&order=eta_port.desc.nullslast&limit=2000');
            if (alive) setContainers(Array.isArray(data) ? data : []);
        };
        load();
        const h = () => load();
        window.addEventListener('containers-changed', h);
        return () => { alive = false; window.removeEventListener('containers-changed', h); };
    }, []);
    const cStats = useMemo(() => {
        const DONE = ['Turned In', 'Delivered'];
        const active = containers.filter(c => !DONE.includes(c.status));
        return {
            active: active.length,
            atSea: containers.filter(c => c.status === 'At Sea').length,
            atPort: containers.filter(c => c.status === 'Arrived Port' || c.status === 'Available').length,
            atDepot: containers.filter(c => c.status === 'At Depot' || c.status === 'Collected').length,
            empty: containers.filter(c => c.status === 'Empty').length,
            attention: active.filter(c => ['Arrived Port', 'Available', 'At Depot'].includes(c.status)),
        };
    }, [containers]);

    const today = todayIso();
    const loads = loadConfirmations as LoadConfirmation[];
    const clientName = (lc: any) => clients.find((c: any) => c.id === lc.clientId)?.name || lc.clientName || '—';

    const byStatus = useMemo(() => {
        const m = new Map<string, LoadConfirmation[]>();
        loads.forEach(l => { const k = l.status; if (!m.has(k)) m.set(k, []); m.get(k)!.push(l); });
        return m;
    }, [loads]);

    // Inter-depot inbound — in transit between two different FBN branches.
    const inbound = useMemo(() => {
        const groups = new Map<string, LoadConfirmation[]>();
        loads.filter(l => (l.status === 'In Transit' || l.status === 'At Destination Depot') && l.collectionBranch && l.destinationBranch && l.collectionBranch !== l.destinationBranch)
            .forEach(l => { const k = `${l.collectionBranch} → ${l.destinationBranch}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(l); });
        return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    }, [loads]);

    const collectingToday = useMemo(() => loads.filter(l => dOnly(l.collectionDate) === today && ['Booked', 'Driver Assigned', 'At Collection Point', 'Loading'].includes(l.status)), [loads, today]);
    const deliveringToday = useMemo(() => loads.filter(l => dOnly((l as any).deliveryDate) === today && !['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'].includes(l.status)), [loads, today]);

    const selected = sel ? (byStatus.get(sel) || []) : null;

    const Card: React.FC<{ label: string; n: number; active: boolean; onClick: () => void; tone?: string }> = ({ label, n, active, onClick, tone }) => (
        <button onClick={onClick} className={`text-left rounded-xl px-3 py-2.5 border min-w-[120px] transition ${active ? 'bg-[#13294b] border-[#13294b] text-white' : `bg-white border-slate-200 hover:border-blue-300 ${tone || 'text-slate-800'}`}`}>
            <div className="text-2xl font-black">{n}</div>
            <div className={`text-[10px] uppercase tracking-wider ${active ? 'text-blue-200' : 'text-slate-500'}`}>{label}</div>
        </button>
    );

    const List: React.FC<{ items: LoadConfirmation[] }> = ({ items }) => (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {items.length === 0 && <p className="p-4 text-sm text-slate-400 text-center">None.</p>}
            {items.slice(0, 60).map(l => (
                <button key={l.id} onClick={() => showModal('loadDetail', { loadCon: l })} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{l.loadConNumber} · {clientName(l)}</p>
                        <p className="text-[11px] text-slate-500 truncate">{l.collectionPoint} → {l.deliveryPoint}{(l as any).subcontractorName ? ` · ${(l as any).subcontractorName}` : ''}</p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded uppercase ${statusChip(l.status)}`}>{STATUS_LABEL[l.status]}</span>
                </button>
            ))}
        </div>
    );

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-xl font-bold text-slate-900">Daily Overview</h3>
                <p className="text-xs text-slate-500">The live pipeline — booked → collected → in transit → delivered → POD. Click a stage to see the loads.</p>
            </div>

            <div className="flex gap-2 flex-wrap">
                {PIPELINE.map(s => <Card key={s.key} label={s.label} n={(byStatus.get(s.key) || []).length} active={sel === s.key} onClick={() => setSel(sel === s.key ? null : s.key)} />)}
            </div>

            {selected && (
                <div>
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">{STATUS_LABEL[sel as any] || sel} — {selected.length}</h4>
                    <List items={selected} />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div>
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">🚚 Collecting today ({collectingToday.length})</h4>
                    <List items={collectingToday} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">📦 Delivering today ({deliveringToday.length})</h4>
                    <List items={deliveringToday} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">🔄 Inbound between depots</h4>
                    <div className="space-y-2">
                        {inbound.length === 0 && <p className="text-sm text-slate-400">Nothing in transit between depots.</p>}
                        {inbound.map(([lane, items]) => (
                            <div key={lane} className="bg-white border border-slate-200 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-purple-700">{lane}</span>
                                    <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{items.length}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 truncate">{items.map(i => i.loadConNumber).slice(0, 6).join(', ')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">📦 Containers ({cStats.active} active)</h4>
                    <button onClick={() => handleOperationsSubViewChange?.('containers')} className="text-xs font-bold text-blue-600 hover:underline">View all →</button>
                </div>
                <div className="flex gap-2 flex-wrap mb-3">
                    {([['At sea', cStats.atSea, 'text-blue-600'], ['At port', cStats.atPort, 'text-amber-600'], ['At depot', cStats.atDepot, 'text-teal-600'], ['Empties to turn in', cStats.empty, 'text-rose-600']] as [string, number, string][]).map(([l, n, tone]) => (
                        <button key={l} onClick={() => handleOperationsSubViewChange?.('containers')} className="text-left rounded-xl px-3 py-2.5 border min-w-[120px] bg-white border-slate-200 hover:border-blue-300 transition">
                            <div className={`text-2xl font-black ${tone}`}>{n}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">{l}</div>
                        </button>
                    ))}
                </div>
                {cStats.attention.length > 0 && (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {cStats.attention.slice(0, 12).map(c => (
                            <button key={c.id} onClick={() => showModal('logContainer', { container: c })} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{c.container_no} · {c.client_name || '—'}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{c.vessel_name || ''}{c.eta_port ? ` · ETA ${new Date(c.eta_port).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}` : ''}{c.branch ? ` · ${c.branch}` : ''}</p>
                                </div>
                                <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded uppercase bg-amber-100 text-amber-800">{c.status}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyShipmentsOverview;
