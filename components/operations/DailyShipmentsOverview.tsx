import React, { useEffect, useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState, useAuth } from '../../contexts/AppContexts';
import { STATUS_LABEL, statusChip } from '../../lib/loadStatus';
import { directSelect, supabase } from '../../lib/supabase';

// Branch scoping — each depot sees ITS shipments; managers/admins get an All + per-branch switch.
const BRANCHES = ['FBN JHB', 'FBN DBN', 'FBN CPT'];
const CITY: Record<string, string> = { 'FBN JHB': 'JHB', 'FBN DBN': 'DBN', 'FBN CPT': 'CPT' };
const bcode = (b?: string) => (b && CITY[b]) || (b ? b.replace(/^FBN\s*/, '') : '');

// A live truck position from the Pulsit feed (same `track` edge fn the Live Map uses).
interface LivePos { reg: string; lat: number; lng: number; speed: number; ignition: number; address: string; at: string; driver: string | null; }
const alnum = (s?: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fmtSeen = (s?: string) => { if (!s) return ''; const d = new Date(s); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }); };

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
    const { showModal, handleOperationsSubViewChange } = useUIState();
    const { currentUser } = useAuth();
    const goTab = (view: string) => handleOperationsSubViewChange(view);
    const [sel, setSel] = useState<string | null>(null);

    // Branch scope: single-branch ops are locked to their depot; managers/admins pick
    // All / a branch. A load "belongs" to a branch if it collects, delivers, or is
    // arranged there. Mirrors OperationsTripSheets / OperationsManifests.
    const opsBranches: string[] = (currentUser?.assignedBranches || []).filter((b: string) => BRANCHES.includes(b));
    const isManager = ['Super Admin', 'Manager'].includes(currentUser?.role);
    const locked = !isManager && opsBranches.length === 1;
    const [branch, setBranch] = useState<string>(locked ? opsBranches[0] : (isManager ? 'ALL' : (opsBranches[0] || 'ALL')));
    const inBranch = (l: any, b: string) => b === 'ALL' || l.collectionBranch === b || l.destinationBranch === b || l.arrangingBranch === b;

    const today = todayIso();
    const allLoads = loadConfirmations as LoadConfirmation[];
    const loads = useMemo(() => allLoads.filter(l => inBranch(l, branch)), [allLoads, branch]);
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
    // Broking sub-dashboard: loads THIS branch booked out to a subcontractor, still running —
    // monitor them through to delivery + POD. Grouped by subbie.
    const brokered = useMemo(() => loads.filter(l => ((l as any).subcontractorName || (l as any).supplierId) && !['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'].includes(l.status)), [loads]);
    const brokeredBySub = useMemo(() => {
        const m = new Map<string, LoadConfirmation[]>();
        brokered.forEach(l => { const k = (l as any).subcontractorName || 'Transporter'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(l); });
        return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
    }, [brokered]);

    // Live truck positions (Pulsit) so ops can see where today's collection/delivery
    // trucks are right now — same 30s feed as the Live Map. Keyed by registration; the
    // assigned reg (own-fleet OR subbie) is stored on subcontractorVehicleReg.
    const [positions, setPositions] = useState<LivePos[]>([]);
    useEffect(() => {
        let active = true;
        const pull = async () => {
            try {
                const { data } = await supabase.functions.invoke('track', { body: { action: 'feed' } });
                if (active && Array.isArray((data as any)?.vehicles)) setPositions((data as any).vehicles as LivePos[]);
            } catch { /* tracking is best-effort here — silent if unavailable */ }
        };
        pull();
        const t = setInterval(pull, 30000);
        return () => { active = false; clearInterval(t); };
    }, []);
    const posByReg = useMemo(() => {
        const m = new Map<string, LivePos>();
        positions.forEach(p => { if (p.reg && p.lat != null && p.lng != null) m.set(alnum(p.reg), p); });
        return m;
    }, [positions]);

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
        const active = containers.filter(c => !DONE.includes(c.status) && (branch === 'ALL' || c.branch === branch));
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

    // One-line live position for a load's assigned truck (green=moving, amber=stopped,
    // slate=ignition off). Only rendered when `live` and we have a fresh feed match.
    const LiveLine: React.FC<{ lc: LoadConfirmation }> = ({ lc }) => {
        const pos = posByReg.get(alnum((lc as any).subcontractorVehicleReg));
        if (!pos) return null;
        const moving = (pos.speed || 0) > 5;
        const colour = moving ? 'bg-emerald-500' : pos.ignition ? 'bg-amber-500' : 'bg-slate-400';
        const state = moving ? `${Math.round(pos.speed)} km/h` : pos.ignition ? 'stopped' : 'off';
        return (
            <p className="text-[11px] text-slate-600 truncate mt-0.5 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${colour}`} />
                <span className="font-mono font-bold text-slate-700">{pos.reg}</span>
                {pos.address && <span className="text-slate-500 truncate">· {pos.address}</span>}
                <span className="text-slate-400 shrink-0">· {state}{pos.at ? ` · ${fmtSeen(pos.at)}` : ''}</span>
            </p>
        );
    };

    const List: React.FC<{ items: LoadConfirmation[]; live?: boolean }> = ({ items, live }) => (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {items.length === 0 && <p className="p-4 text-sm text-slate-400 text-center">None.</p>}
            {items.slice(0, 60).map(l => (
                <button key={l.id} onClick={() => showModal('loadDetail', { loadCon: l })} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{l.loadConNumber} · {clientName(l)}</p>
                        <p className="text-[11px] text-slate-500 truncate">{l.collectionPoint} → {l.deliveryPoint}{(l as any).subcontractorName ? ` · ${(l as any).subcontractorName}` : ''}</p>
                        {live && <LiveLine lc={l} />}
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
            <div className="flex flex-wrap items-center gap-3">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Daily Overview{branch !== 'ALL' ? ` — ${bcode(branch)}` : ''}</h3>
                    <p className="text-xs text-slate-500">The live pipeline — booked → collected → in transit → delivered → POD. Click a stage to see the loads.</p>
                </div>
                {locked
                    ? <span className="px-2.5 py-1 rounded-lg bg-[#13294b] text-white text-xs font-black uppercase">{bcode(branch)} depot</span>
                    : <select value={branch} onChange={e => setBranch(e.target.value)} className="ml-auto border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold">
                        <option value="ALL">All depots</option>
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>}
            </div>

            {openRequests.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                    <p className="text-sm font-black text-amber-800 mb-2">{openRequests.length} client request{openRequests.length !== 1 ? 's' : ''} awaiting a reply</p>
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
                    <button onClick={() => goTab('opsDay')} className="text-sm font-black text-slate-700 hover:text-blue-600 uppercase tracking-wider mb-2">Collecting today ({collectingToday.length}) →</button>
                    <List items={collectingToday} live />
                </div>
                <div>
                    <button onClick={() => goTab('opsDay')} className="text-sm font-black text-slate-700 hover:text-blue-600 uppercase tracking-wider mb-2">Delivering today ({deliveringToday.length}) →</button>
                    <List items={deliveringToday} live />
                </div>
                <div>
                    <button onClick={() => goTab('opsManifests')} className="text-sm font-black text-slate-700 hover:text-purple-600 uppercase tracking-wider mb-2">Inbound between depots →</button>
                    <div className="space-y-2">
                        {inbound.length === 0 && <p className="text-sm text-slate-400">Nothing in transit between depots.</p>}
                        {inbound.map(([lane, items]) => (
                            <button key={lane} onClick={() => goTab('opsManifests')} className="w-full text-left bg-white border border-slate-200 hover:border-purple-300 rounded-xl p-3 transition">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-purple-700">{lane}</span>
                                    <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{items.length}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 truncate">{items.map(i => i.loadConNumber).slice(0, 6).join(', ')}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Broking sub-dashboard: what this branch booked out to subbies, to delivery + POD. */}
            <div>
                <button onClick={() => goTab('deliveries')} className="text-sm font-black text-slate-700 hover:text-amber-600 uppercase tracking-wider mb-2">Broking — booked to transporters ({brokered.length}) →</button>
                {brokered.length === 0 ? <p className="text-sm text-slate-400">No brokered loads running{branch !== 'ALL' ? ` for ${bcode(branch)}` : ''}.</p> : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {brokeredBySub.map(([sub, items]) => (
                            <div key={sub} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-100">
                                    <span className="text-sm font-black text-amber-800 truncate">{sub}</span>
                                    <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full shrink-0">{items.length} load{items.length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {items.slice(0, 12).map(l => (
                                        <button key={l.id} onClick={() => showModal('loadDetail', { loadCon: l })} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{l.loadConNumber} · {clientName(l)}</p>
                                                <p className="text-[11px] text-slate-500 truncate">{l.collectionPoint} → {l.deliveryPoint}</p>
                                                <LiveLine lc={l} />
                                            </div>
                                            <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded uppercase ${statusChip(l.status)}`}>{STATUS_LABEL[l.status]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <button onClick={() => goTab('containers')} className="text-sm font-black text-slate-700 hover:text-teal-600 uppercase tracking-wider mb-2">Containers (FCL) — {ctr.active} active →</button>
                <div className="flex gap-2 flex-wrap">
                    <Card label="At sea" n={ctr.atSea} active={false} onClick={() => goTab('containers')} tone="text-blue-600" />
                    <Card label="At port" n={ctr.atPort} active={false} onClick={() => goTab('containers')} tone="text-amber-600" />
                    <Card label="At depot / yard" n={ctr.atDepot} active={false} onClick={() => goTab('containers')} tone="text-teal-600" />
                    <Card label="Empty to turn in" n={ctr.empty} active={false} onClick={() => goTab('containers')} tone="text-rose-600" />
                    <Card label="ETA today" n={ctr.etaToday.length} active={false} onClick={() => goTab('containers')} tone="text-slate-800" />
                </div>
                {ctr.etaToday.length > 0 && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-xl p-3">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Arriving port today ({ctr.etaToday.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                            {ctr.etaToday.slice(0, 30).map((c: any) => (
                                <button key={c.container_no} onClick={() => goTab('containers')} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-lg px-2 py-1 text-[11px]">
                                    <span className="font-mono font-bold text-[#13294b]">{c.container_no}</span>
                                    {c.client_name && <span className="text-slate-500">{c.client_name}</span>}
                                </button>
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
