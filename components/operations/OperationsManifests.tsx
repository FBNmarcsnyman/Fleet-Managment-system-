import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState, useAuth, useVehicles } from '../../contexts/AppContexts';
import { fmtDay } from '../../lib/format';

// OPERATIONS → MANIFESTS
// Load the line-haul (LM) trucks for inter-depot transfer. Cargo that's been
// collected / is at the origin depot and routed to the OTHER branch is loaded
// onto a superlink (6m / 12m / 6m+12m) truck, dispatched, and received at the
// far depot — which drops it onto that branch's Trip Sheets floor.
const BRANCHES = ['FBN JHB', 'FBN DBN', 'FBN CPT'];
const CITY: Record<string, string> = { 'FBN JHB': 'JHB', 'FBN DBN': 'DBN', 'FBN CPT': 'CPT' };
const code = (b?: string) => (b && CITY[b]) || (b ? b.replace(/^FBN\s*/, '') : '—');
const pkgsOf = (l: any): number => Number(l.loadedPackages) || (l.quantity && !isNaN(parseInt(l.quantity)) ? parseInt(l.quantity) : 0) || (Array.isArray(l.items) ? l.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0) : 0);
const kg = (n: number) => Math.round(n).toLocaleString('en-ZA');
const READY = new Set(['Collected', 'At Collection Depot']); // ready to load on the line-haul

const OperationsManifests: React.FC = () => {
    const { loadConfirmations = [], clients = [], users = [], manifests = [], handleCreateManifest, handleReceiveManifest } = useOperations() as any;
    const { vehicles = [] } = (useVehicles() as any) || {};
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();

    const opsBranches: string[] = (currentUser?.assignedBranches || []).filter((b: string) => BRANCHES.includes(b));
    const isManager = ['Admin', 'Super Admin'].includes(currentUser?.role);
    const locked = !isManager && opsBranches.length === 1;
    const [origin, setOrigin] = useState<string>(locked ? opsBranches[0] : (opsBranches[0] || 'FBN JHB'));
    const [building, setBuilding] = useState<LoadConfirmation[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const clientName = (lc: LoadConfirmation) => lc.clientName || (clients.find((c: any) => c.id === lc.clientId)?.name) || '—';

    // Cargo already committed to an in-transit manifest (so we don't offer it twice).
    const manifested = useMemo(() => {
        const s = new Set<string>();
        (manifests as any[]).filter(m => m.status !== 'Arrived').forEach(m => (m.loadConfirmationIds || []).forEach((id: string) => s.add(id)));
        return s;
    }, [manifests]);

    // Cargo ready to line-haul OUT of the chosen origin (routed to another branch).
    const ready = useMemo(() => (loadConfirmations as LoadConfirmation[])
        .filter(lc => READY.has(lc.status) && lc.collectionBranch === origin && lc.destinationBranch && lc.destinationBranch !== origin && !manifested.has(lc.id))
        .sort((a, b) => (a.destinationBranch || '').localeCompare(b.destinationBranch || '')),
    [loadConfirmations, origin, manifested]);

    const linehaul = useMemo(() => (manifests as any[])
        .filter(m => m.status !== 'Arrived' && (isManager || m.originBranch === origin || m.destinationBranch === origin))
        .sort((a, b) => String(b.manifestNumber || '').localeCompare(String(a.manifestNumber || ''))),
    [manifests, origin, isManager]);

    const [sel, setSel] = useState<Set<string>>(new Set());
    const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selDest = useMemo(() => Array.from(new Set(ready.filter(l => sel.has(l.id)).map(l => l.destinationBranch))), [ready, sel]);

    const openBuild = () => {
        const loads = ready.filter(l => sel.has(l.id));
        if (!loads.length) return;
        if (selDest.length > 1) { showToast('Those loads go to different branches — a truck runs one way. Pick one destination.'); return; }
        setBuilding(loads);
    };

    const receive = async (m: any) => {
        if (!window.confirm(`Receive ${m.manifestNumber} at ${code(m.destinationBranch)}? Its cargo drops onto the ${code(m.destinationBranch)} delivery floor.`)) return;
        setBusy(m.id);
        const r = await handleReceiveManifest(m.id);
        setBusy(null);
        showToast(r?.ok === false ? `Could not receive: ${r.error}` : 'Received — cargo is on the delivery floor.');
    };

    return (
        <div className="max-w-[1600px] mx-auto px-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-xl font-black text-[#13294b]">Manifests — line-haul</h3>
                {locked
                    ? <span className="px-2.5 py-1 rounded-lg bg-[#13294b] text-white text-xs font-black uppercase">{code(origin)} depot</span>
                    : <select value={origin} onChange={e => { setOrigin(e.target.value); setSel(new Set()); }} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
                        {BRANCHES.map(b => <option key={b} value={b}>From {b}</option>)}
                    </select>}
                <p className="text-xs text-slate-500">Load the LM superlink trucks for inter-depot transfer.</p>
            </div>

            {/* Cargo ready to load */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="font-black text-[#13294b] text-sm uppercase tracking-wider">📦 Ready to load — {code(origin)} <span className="text-slate-400">({ready.length})</span></div>
                    {sel.size > 0 && <button onClick={openBuild} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-black py-1.5 px-3 rounded-lg text-xs uppercase tracking-wider">🚛 Load truck → manifest ({sel.size})</button>}
                </div>
                {ready.length === 0 ? <div className="px-4 py-8 text-center text-slate-400 text-sm">No cargo waiting to line-haul out of {code(origin)}.</div> : (
                    <div className="divide-y divide-slate-100">
                        {ready.map(lc => (
                            <label key={lc.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${sel.has(lc.id) ? 'bg-amber-50' : 'hover:bg-amber-50/40'}`}>
                                <input type="checkbox" checked={sel.has(lc.id)} onChange={() => toggle(lc.id)} className="h-4 w-4 accent-[#13294b]" />
                                <span className="font-bold text-[#13294b] w-36">{lc.loadConNumber}</span>
                                <span className="text-sm text-slate-700 flex-1 truncate">{clientName(lc)}</span>
                                <span className="text-xs font-bold text-slate-600">{code(lc.collectionBranch)} → {code(lc.destinationBranch)}</span>
                                <span className="text-xs text-slate-500 w-40 text-right">{pkgsOf(lc) || '—'} pkgs · {lc.weightKg ? kg(Number(lc.weightKg)) + ' kg' : '—'}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Trucks in transit */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-black text-[#13294b] text-sm uppercase tracking-wider">🚛 Line-haul trucks <span className="text-slate-400">({linehaul.length})</span></div>
                {linehaul.length === 0 ? <div className="px-4 py-8 text-center text-slate-400 text-sm">No trucks in transit.</div> : (
                    <div className="divide-y divide-slate-100">
                        {linehaul.map(m => {
                            const veh = vehicles.find((v: any) => v.id === m.vehicleId);
                            const loads = (loadConfirmations as LoadConfirmation[]).filter(l => (m.loadConfirmationIds || []).includes(l.id));
                            const tot = loads.reduce((t, l) => ({ p: t.p + pkgsOf(l), k: t.k + (Number(l.weightKg) || 0) }), { p: 0, k: 0 });
                            const inbound = !isManager && m.destinationBranch === origin;
                            return (
                                <div key={m.id} className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button onClick={() => showModal('manifestDoc', { manifest: m })} className="font-bold text-[#13294b] underline decoration-dotted">{m.manifestNumber}</button>
                                        <span className="text-sm font-bold text-slate-700">{code(m.originBranch)} → {code(m.destinationBranch)}</span>
                                        {m.trailerSize && <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{m.trailerSize}</span>}
                                        <span className="text-xs text-slate-500">{veh?.registration || 'truck'} · {loads.length} load{loads.length === 1 ? '' : 's'} · {tot.p} pkgs · {kg(tot.k)} kg</span>
                                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{m.status || 'In Transit'}</span>
                                        <button onClick={() => receive(m)} disabled={busy === m.id} className={`ml-auto font-bold py-1 px-3 rounded-lg text-[11px] uppercase text-white ${inbound ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-500 hover:bg-slate-400'} disabled:opacity-50`}>{busy === m.id ? '…' : `📦 Receive at ${code(m.destinationBranch)}`}</button>
                                    </div>
                                    {/* what's loaded on this trailer */}
                                    <div className="mt-1.5 pl-1 text-[11px] text-slate-500">
                                        {loads.map(l => <span key={l.id} className="inline-block mr-3">{l.loadConNumber} · {clientName(l)} ({pkgsOf(l) || '?'} pkgs)</span>)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {building && <BuildManifestPanel loads={building} origin={origin} vehicles={vehicles} users={users} clientName={clientName}
                onClose={() => setBuilding(null)}
                onBuild={async (vehicleId, driverId, trailerSize) => {
                    const r = await handleCreateManifest({ vehicleId, driverId, loadConIds: building.map(l => l.id), originBranch: origin, trailerSize });
                    if (r?.ok === false) { showToast(`Could not build: ${r.error}`); return; }
                    showToast('Manifest built — truck dispatched.');
                    if (r?.value) showModal('manifestDoc', { manifest: r.value });
                    setBuilding(null); setSel(new Set());
                }} />}
        </div>
    );
};

const BuildManifestPanel: React.FC<{ loads: LoadConfirmation[]; origin: string; vehicles: any[]; users: any[]; clientName: (l: LoadConfirmation) => string; onClose: () => void; onBuild: (vehicleId: string, driverId: string, trailerSize: string) => Promise<void> }> = ({ loads, origin, vehicles, users, clientName, onClose, onBuild }) => {
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [trailer, setTrailer] = useState('12m');
    const [saving, setSaving] = useState(false);
    const dest = loads[0]?.destinationBranch;
    const horses = vehicles.filter((v: any) => v.status === 'On the road' && v.weightCategory === 'Horse');
    const drivers = users.filter((u: any) => ['Staff', 'Driver'].includes(u.role));
    const submit = async () => { if (!vehicleId || !driverId) { alert('Pick a truck and a driver.'); return; } setSaving(true); await onBuild(vehicleId, driverId, trailer); setSaving(false); };
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-3 rounded-t-2xl bg-[#13294b] text-white flex items-center justify-between">
                    <h3 className="font-black text-lg">Load line-haul truck</h3>
                    <span className="text-sm text-white/80">{code(origin)} → {code(dest)}</span>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{loads.length} shipment{loads.length === 1 ? '' : 's'} on this trailer</div>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {loads.map(l => <div key={l.id} className="px-3 py-1.5 text-sm flex justify-between gap-2"><span className="font-bold text-[#13294b]">{l.loadConNumber}</span><span className="text-slate-500 truncate">{clientName(l)} · {pkgsOf(l) || '?'} pkgs</span></div>)}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trailer</label>
                            <select value={trailer} onChange={e => setTrailer(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="6m">6 m</option>
                                <option value="12m">12 m</option>
                                <option value="6m + 12m">6 m + 12 m (superlink)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">LM truck</label>
                            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- truck --</option>
                                {horses.map((v: any) => <option key={v.id} value={v.id}>{v.registration}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Driver</label>
                            <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- driver --</option>
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

export default OperationsManifests;
