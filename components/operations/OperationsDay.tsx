import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState, useAuth, useVehicles } from '../../contexts/AppContexts';
import { nextStep, statusChip, STATUS_LABEL, isCollectionStage, isAssigned } from '../../lib/loadStatus';
import { fmtDay } from '../../lib/format';

// ---------------------------------------------------------------------------
// OPERATIONS — DAY (list-flow worklist)
//
// The operations desk worked as a staged LIST instead of a kanban board, the
// way a dispatch desk actually runs the day:
//   1. Collections (today) — everything still to collect / at the origin depot.
//      Tick several going the same way → GROUP → build a line-haul manifest.
//   2. Today's line-haul — the manifests (trucks) built today, each receivable
//      at the destination depot (drops the loads onto the delivery list).
//
// This is Phase 1 (Collections → Manifest + receive). It reuses the existing
// manifest mechanism (handleCreateManifest / handleReceiveManifest) — it's a
// cleaner surface over the same data, Operations-only (Broking stays separate).
// ---------------------------------------------------------------------------

const BRANCHES = ['FBN JHB', 'FBN DBN', 'FBN CPT'];
const CITY: Record<string, string> = { 'FBN JHB': 'JHB', 'FBN DBN': 'DBN', 'FBN CPT': 'CPT', 'FBN PE': 'PE', 'FBN EL': 'EL', 'FBN BFN': 'BFN' };
const code = (b?: string) => (b && CITY[b]) || (b ? b.replace(/^FBN\s*/, '') : '—');

const todayISO = () => new Date().toISOString().slice(0, 10);

type DateMode = 'today' | 'overdue' | 'all';

const OperationsDay: React.FC = () => {
    const { loadConfirmations = [], clients = [], users = [], manifests = [], handleUpdateLoadConfirmation, handleCreateManifest, handleReceiveManifest } = useOperations() as any;
    const { vehicles = [] } = (useVehicles() as any) || {};
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();

    const myBranch = (currentUser?.assignedBranches || []).find((b: string) => BRANCHES.includes(b));
    const [branch, setBranch] = useState<string>(myBranch || 'All');
    const [q, setQ] = useState('');
    const [dateMode, setDateMode] = useState<DateMode>('all');
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);
    const [building, setBuilding] = useState<LoadConfirmation[] | null>(null);

    const clientName = (lc: LoadConfirmation) => lc.clientName || (clients.find((c: any) => c.id === lc.clientId)?.name) || '—';
    const carrier = (lc: LoadConfirmation) =>
        lc.subcontractorName || lc.subcontractorDriverName ||
        (lc.vehicleId ? (vehicles.find((v: any) => v.id === lc.vehicleId)?.registration || 'FBN fleet') : '') ||
        (isAssigned(lc) ? 'FBN fleet' : '—');

    // The collections worklist: own-fleet/ops shipments still in a collection
    // stage (to collect → loaded → at origin depot). Not terminal, not yet on
    // the line-haul. Branch = the COLLECTING branch.
    const collections = useMemo(() => {
        const t = todayISO();
        return (loadConfirmations as LoadConfirmation[])
            .filter(lc => lc.isCollection && isCollectionStage(lc.status))
            .filter(lc => branch === 'All' || lc.collectionBranch === branch)
            .filter(lc => {
                if (dateMode === 'all') return true;
                const d = lc.collectionDate || '';
                if (dateMode === 'today') return d === t;
                return !!d && d < t; // overdue
            })
            .filter(lc => {
                if (!q.trim()) return true;
                const hay = `${lc.loadConNumber} ${lc.loadRefNo || ''} ${clientName(lc)} ${lc.collectionPoint || ''} ${lc.deliveryPoint || ''} ${carrier(lc)}`.toLowerCase();
                return hay.includes(q.trim().toLowerCase());
            })
            .sort((a, b) => (a.collectionDate || '').localeCompare(b.collectionDate || '') || a.loadConNumber.localeCompare(b.loadConNumber));
    }, [loadConfirmations, clients, vehicles, branch, dateMode, q]);

    // Manifests dispatched today (the "truck board" strip) that haven't yet been
    // received at the destination depot.
    const todaysLinehaul = useMemo(() => {
        const t = todayISO();
        return (manifests as any[])
            .filter(m => (m.dispatchDate || m.dispatch_date || '').slice(0, 10) === t && m.status !== 'Arrived')
            .sort((a, b) => String(b.manifestNumber || '').localeCompare(String(a.manifestNumber || '')));
    }, [manifests]);

    const toggle = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selLoads = useMemo(() => collections.filter(lc => sel.has(lc.id)), [collections, sel]);
    // Destinations represented in the current selection — a manifest should go
    // ONE way, so warn if the desk has mixed destinations selected.
    const selDests = useMemo(() => Array.from(new Set(selLoads.map(l => l.destinationBranch).filter(Boolean))), [selLoads]);

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc);
        if (!step) return;
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: step.status });
        setBusy(null);
        if (res && res.ok === false) showToast?.(res.error || 'Could not update');
    };

    const openBuild = () => {
        if (selLoads.length === 0) return;
        if (selDests.length > 1) { showToast?.('Selected loads go to different branches — pick one destination for a manifest.'); return; }
        setBuilding(selLoads);
    };

    const receive = async (m: any) => {
        const dest = m.destinationBranch || m.destination_branch || '';
        if (!window.confirm(`Receive manifest ${m.manifestNumber || ''} at ${code(dest) || 'destination'}? This moves every load on it to the delivery list.`)) return;
        setBusy(m.id);
        const res = await handleReceiveManifest(m.id);
        setBusy(null);
        if (res && res.ok === false) showToast?.(res.error || 'Could not receive manifest');
        else showToast?.('Received — loads are on the delivery list.');
    };

    const inputCls = 'border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';

    return (
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4">
            {/* Header + filters */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className="text-xl font-black text-[#13294b] mr-2">Operations — Day</h2>
                <div className="flex rounded-lg overflow-hidden border border-slate-300">
                    {(['today', 'overdue', 'all'] as DateMode[]).map(m => (
                        <button key={m} onClick={() => setDateMode(m)}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${dateMode === m ? 'bg-[#13294b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            {m === 'today' ? 'Today' : m === 'overdue' ? 'Overdue' : 'All open'}
                        </button>
                    ))}
                </div>
                <select value={branch} onChange={e => { setBranch(e.target.value); setSel(new Set()); }} className={inputCls}>
                    <option value="All">All branches</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search load, client, place, carrier…" className={`${inputCls} flex-1 min-w-[180px]`} />
            </div>

            {/* ---- COLLECTIONS LIST ---- */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="font-black text-[#13294b] text-sm uppercase tracking-wider">📥 Collections <span className="text-slate-400">({collections.length})</span></div>
                    {sel.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">{sel.size} selected{selDests.length === 1 ? ` → ${code(selDests[0] as string)}` : ''}</span>
                            <button onClick={openBuild} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-black py-1.5 px-3 rounded-lg text-xs uppercase tracking-wider">🚛 Group → build manifest</button>
                            <button onClick={() => setSel(new Set())} className="text-xs text-slate-500 hover:text-slate-700 font-bold">Clear</button>
                        </div>
                    )}
                </div>

                {collections.length === 0 ? (
                    <div className="px-4 py-10 text-center text-slate-400 text-sm">Nothing to collect for this filter.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <th className="py-2 pl-3 pr-2 w-8"></th>
                                    <th className="py-2 px-2">Load</th>
                                    <th className="py-2 px-2">Client</th>
                                    <th className="py-2 px-2">Route</th>
                                    <th className="py-2 px-2">Collect by</th>
                                    <th className="py-2 px-2">Carrier</th>
                                    <th className="py-2 px-2">Status</th>
                                    <th className="py-2 px-2 text-right pr-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {collections.map(lc => {
                                    const step = nextStep(lc);
                                    const overdue = lc.collectionDate && lc.collectionDate < todayISO();
                                    return (
                                        <tr key={lc.id} className={`border-b border-slate-100 hover:bg-amber-50/40 ${sel.has(lc.id) ? 'bg-amber-50' : ''}`}>
                                            <td className="py-2 pl-3 pr-2">
                                                <input type="checkbox" checked={sel.has(lc.id)} onChange={() => toggle(lc.id)} className="h-4 w-4 accent-[#13294b]" />
                                            </td>
                                            <td className="py-2 px-2">
                                                <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="font-bold text-[#13294b] hover:underline">{lc.loadConNumber}</button>
                                                {lc.loadRefNo && <div className="text-[11px] text-slate-400">WB {lc.loadRefNo}</div>}
                                            </td>
                                            <td className="py-2 px-2 text-slate-700">{clientName(lc)}</td>
                                            <td className="py-2 px-2 whitespace-nowrap">
                                                <span className="font-bold text-slate-700">{code(lc.collectionBranch)}</span>
                                                <span className="text-slate-300 mx-1">→</span>
                                                <span className="font-bold text-slate-700">{code(lc.destinationBranch)}</span>
                                                <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{lc.collectionPoint || ''}{lc.deliveryPoint ? ` → ${lc.deliveryPoint}` : ''}</div>
                                            </td>
                                            <td className={`py-2 px-2 whitespace-nowrap ${overdue ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{fmtDay(lc.collectionDate)}{overdue ? ' ⚠' : ''}</td>
                                            <td className="py-2 px-2 text-slate-600 truncate max-w-[140px]">{carrier(lc)}</td>
                                            <td className="py-2 px-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span></td>
                                            <td className="py-2 px-2 text-right pr-3 whitespace-nowrap">
                                                {!isAssigned(lc) && lc.status === 'Booked' ? (
                                                    <button onClick={() => showModal('assignFbn', { loadCon: lc })} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-2.5 rounded-lg text-[11px] uppercase">Assign</button>
                                                ) : step ? (
                                                    <button onClick={() => advance(lc)} disabled={busy === lc.id} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-1 px-2.5 rounded-lg text-[11px] uppercase">{busy === lc.id ? '…' : step.label}</button>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400">ready</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ---- TODAY'S LINE-HAUL (truck strip) ---- */}
            {todaysLinehaul.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-4">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-black text-[#13294b] text-sm uppercase tracking-wider">🚛 Today's line-haul <span className="text-slate-400">({todaysLinehaul.length})</span></div>
                    <div className="divide-y divide-slate-100">
                        {todaysLinehaul.map(m => {
                            const veh = vehicles.find((v: any) => v.id === (m.vehicleId || m.vehicle_id));
                            const n = (m.loadConfirmationIds || m.load_confirmation_ids || []).length;
                            return (
                                <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                                    <span className="font-bold text-[#13294b]">{m.manifestNumber || m.manifest_number}</span>
                                    <span className="text-sm text-slate-600">{code(m.originBranch || m.origin_branch)} → {code(m.destinationBranch || m.destination_branch)}</span>
                                    <span className="text-xs text-slate-500">{veh?.registration || 'truck'} · {n} load{n === 1 ? '' : 's'}</span>
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{m.status || 'In Transit'}</span>
                                    <button onClick={() => receive(m)} disabled={busy === m.id} className="ml-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-1 px-3 rounded-lg text-[11px] uppercase">{busy === m.id ? '…' : '📦 Receive'}</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {building && <BuildManifestPanel loads={building} vehicles={vehicles} users={users}
                onClose={() => setBuilding(null)}
                onBuild={async (vehicleId, driverId) => {
                    const origin = building[0].collectionBranch;
                    const res = await handleCreateManifest({ vehicleId, driverId, loadConIds: building.map(l => l.id), originBranch: origin });
                    if (res && res.ok === false) { showToast?.(res.error || 'Could not build manifest'); return; }
                    showToast?.('Line-haul manifest built — loads dispatched.');
                    setBuilding(null); setSel(new Set());
                }} />}
        </div>
    );
};

// Light-theme build-manifest step, pre-seeded with the loads the desk ticked.
const BuildManifestPanel: React.FC<{ loads: LoadConfirmation[]; vehicles: any[]; users: any[]; onClose: () => void; onBuild: (vehicleId: string, driverId: string) => Promise<void> }> = ({ loads, vehicles, users, onClose, onBuild }) => {
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [saving, setSaving] = useState(false);
    const dest = loads[0]?.destinationBranch;
    const origin = loads[0]?.collectionBranch;
    const horses = vehicles.filter((v: any) => v.weightCategory === 'Horse' && v.status === 'On the road');
    const drivers = users.filter((u: any) => u.role === 'Staff' || u.role === 'Driver');
    const submit = async () => {
        if (!vehicleId || !driverId) { alert('Pick a truck and a driver.'); return; }
        setSaving(true); await onBuild(vehicleId, driverId); setSaving(false);
    };
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-3 rounded-t-2xl bg-[#13294b] text-white flex items-center justify-between">
                    <h3 className="font-black text-lg">Build line-haul manifest</h3>
                    <span className="text-sm text-white/80">{code(origin)} → {code(dest)}</span>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{loads.length} load{loads.length === 1 ? '' : 's'} on this manifest</div>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {loads.map(l => (
                                <div key={l.id} className="px-3 py-1.5 text-sm flex justify-between">
                                    <span className="font-bold text-[#13294b]">{l.loadConNumber}</span>
                                    <span className="text-slate-500 truncate ml-3">{l.clientName || ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Line-haul truck</label>
                            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- Select truck --</option>
                                {horses.map((v: any) => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}
                            </select>
                            {horses.length === 0 && <div className="text-[11px] text-amber-600 mt-1">No horses marked On the road.</div>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Driver</label>
                            <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- Select driver --</option>
                                {drivers.map((d: any) => <option key={d.email} value={d.email}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{saving ? 'Building…' : 'Build & dispatch'}</button>
                </div>
            </div>
        </div>
    );
};

export default OperationsDay;
