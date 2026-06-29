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
    const { showModal } = useUIState();
    const [sel, setSel] = useState<string | null>(null);

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

    // FCL containers live in their own table — pull active ones for the overview.
    const [containers, setContainers] = useState<any[]>([]);
    useEffect(() => {
        let alive = true;
        // Active only (many have no ETA — an ETA-ordered query buried them past the cap).
        directSelect('containers?select=container_no,client_name,vessel_name,eta_port,status,branch,turn_in_area,turn_in_date&status=not.in.(Delivered,%22Turned%20In%22)&order=eta_port.desc.nullslast&limit=5000')
            .then(({ data }) => { if (alive && Array.isArray(data)) setContainers(data); });
        return () => { alive = false; };
    }, []);
    const ctr = useMemo(() => {
        const DONE = ['Turned In', 'Delivered'];
        const active = containers.filter(c => !DONE.includes(c.status));
        return {
            atSea: active.filter(c => c.status === 'At Sea').length,
            atPort: active.filter(c => c.status === 'Arrived Port' || c.status === 'Available').length,
            atDepot: active.filter(c => c.status === 'At Depot' || c.status === 'Collected' || c.status === 'Unpacked').length,
            empty: active.filter(c => c.status === 'Empty').length,
            // Active containers arriving today, one row per container (drop history dupes).
            etaToday: Array.from(new Map(active.filter(c => dOnly(c.eta_port) === today).map(c => [c.container_no, c])).values()),
            active: active.length,
        };
    }, [containers, today]);

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

    // Open client requests (from the track page) — surface them so ops act, rather
    // than having to open each load to discover a pending request.
    const openRequests = loads.filter(l => ((l as any).clientRequestStatus || (l as any).client_request_status) === 'open');

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-xl font-bold text-slate-900">Daily Overview</h3>
                <p className="text-xs text-slate-500">The live pipeline — booked → collected → in transit → delivered → POD. Click a stage to see the loads.</p>
            </div>

            {openRequests.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                    <p className="text-sm font-black text-amber-800 mb-2">📨 {openRequests.length} client request{openRequests.length !== 1 ? 's' : ''} awaiting a reply</p>
                    <div className="flex flex-wrap gap-2">
                        {openRequests.slice(0, 12).map(l => (
                            <button key={l.id} onClick={() => showModal('loadDetail', { loadCon: l })} className="text-xs font-bold bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg">{l.loadConNumber} · {clientName(l)}</button>
                        ))}
                    </div>
                </div>
            )}

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
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">🚢 Containers (FCL) — {ctr.active} active</h4>
                <div className="flex gap-2 flex-wrap">
                    <Card label="At sea" n={ctr.atSea} active={false} onClick={() => {}} tone="text-blue-600" />
                    <Card label="At port" n={ctr.atPort} active={false} onClick={() => {}} tone="text-amber-600" />
                    <Card label="At depot / yard" n={ctr.atDepot} active={false} onClick={() => {}} tone="text-teal-600" />
                    <Card label="Empty to turn in" n={ctr.empty} active={false} onClick={() => {}} tone="text-rose-600" />
                    <Card label="ETA today" n={ctr.etaToday.length} active={false} onClick={() => {}} tone="text-slate-800" />
                </div>
                {ctr.etaToday.length > 0 && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-xl p-3">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Arriving port today ({ctr.etaToday.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                            {ctr.etaToday.slice(0, 30).map((c: any) => (
                                <span key={c.container_no} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px]">
                                    <span className="font-mono font-bold text-[#13294b]">{c.container_no}</span>
                                    {c.client_name && <span className="text-slate-500">{c.client_name}</span>}
                                </span>
                            ))}
                            {ctr.etaToday.length > 30 && <span className="text-[11px] text-slate-400 self-center">+{ctr.etaToday.length - 30} more</span>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyShipmentsOverview;
