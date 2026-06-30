import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState, useAuth, useVehicles } from '../../contexts/AppContexts';
import { fmtDay } from '../../lib/format';

// OPERATIONS → TRIP SHEETS (per branch)
// Once line-haul cargo arrives it sits on this branch's depot floor. Load it onto
// local delivery vehicles on a trip sheet, then track exactly what's on each
// vehicle through delivery + POD.
const BRANCHES = ['FBN JHB', 'FBN DBN', 'FBN CPT'];
const CITY: Record<string, string> = { 'FBN JHB': 'JHB', 'FBN DBN': 'DBN', 'FBN CPT': 'CPT' };
const code = (b?: string) => (b && CITY[b]) || (b ? b.replace(/^FBN\s*/, '') : '—');
const pkgsOf = (l: any): number => Number(l.loadedPackages) || (l.quantity && !isNaN(parseInt(l.quantity)) ? parseInt(l.quantity) : 0) || (Array.isArray(l.items) ? l.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0) : 0);
const kg = (n: number) => Math.round(n).toLocaleString('en-ZA');
const ON_FLOOR = new Set(['At Destination Depot', 'Unloaded']);     // arrived, awaiting local delivery

const OperationsTripSheets: React.FC = () => {
    const { loadConfirmations = [], clients = [], users = [], tripSheets = [], handleCreateTripSheet, handleUpdateTripSheet, handleUpdateLoadConfirmation } = useOperations() as any;
    const { vehicles = [] } = (useVehicles() as any) || {};
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();

    const opsBranches: string[] = (currentUser?.assignedBranches || []).filter((b: string) => BRANCHES.includes(b));
    const isManager = ['Admin', 'Super Admin'].includes(currentUser?.role);
    const locked = !isManager && opsBranches.length === 1;
    const [branch, setBranch] = useState<string>(locked ? opsBranches[0] : (opsBranches[0] || 'FBN JHB'));
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [building, setBuilding] = useState<LoadConfirmation[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const clientName = (lc: LoadConfirmation) => lc.clientName || (clients.find((c: any) => c.id === lc.clientId)?.name) || '—';

    // Loads already on an out-for-delivery trip sheet — don't offer them again.
    const tripped = useMemo(() => {
        const s = new Set<string>();
        (tripSheets as any[]).filter(t => t.status !== 'Completed').forEach(t => (t.loadConfirmationIds || []).forEach((id: string) => s.add(id)));
        return s;
    }, [tripSheets]);

    // Cargo on this branch's floor: arrived (destination = this branch), awaiting local delivery.
    const floor = useMemo(() => (loadConfirmations as LoadConfirmation[])
        .filter(lc => ON_FLOOR.has(lc.status) && lc.destinationBranch === branch && !tripped.has(lc.id))
        .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || '')),
    [loadConfirmations, branch, tripped]);

    const trips = useMemo(() => (tripSheets as any[])
        .filter(t => t.status !== 'Completed' && (isManager || t.branch === branch))
        .sort((a, b) => String(b.tripSheetNumber || '').localeCompare(String(a.tripSheetNumber || ''))),
    [tripSheets, branch, isManager]);

    const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const getPod = (lc: LoadConfirmation) => showModal('pod', { loadCon: lc, onSubmit: (id: string, pod: any) => handleUpdateLoadConfirmation(id, { podPhoto: pod.photo, podSignature: pod.signature, status: 'POD Submitted', paymentStatus: 'Awaiting POD' }), onCancel: () => showModal('hide') });
    const markDelivered = async (lc: LoadConfirmation) => { setBusy(lc.id); const r = await handleUpdateLoadConfirmation(lc.id, { status: 'Delivered' }); setBusy(null); if (r?.ok === false) showToast(`Could not update: ${r.error}`); };

    // The ordered delivery run for a trip sheet (falls back to load order for old sheets).
    const runStops = (t: any): { loadId: string; order: number; urgent?: boolean }[] => {
        const base = (Array.isArray(t.stops) && t.stops.length) ? t.stops : (t.loadConfirmationIds || []).map((id: string, i: number) => ({ loadId: id, order: i, urgent: false }));
        return [...base].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    };
    const saveStops = async (t: any, stops: any[]) => { const r = await handleUpdateTripSheet(t.id, { stops }); if (r?.ok === false) showToast(`Could not reorder: ${r.error}`); };
    const move = (t: any, fromIdx: number, toIdx: number) => { const arr = runStops(t); if (toIdx < 0 || toIdx >= arr.length) return; const [m] = arr.splice(fromIdx, 1); arr.splice(toIdx, 0, m); saveStops(t, arr.map((s, i) => ({ ...s, order: i }))); };
    const toggleUrgent = (t: any, loadId: string) => { const arr = runStops(t).map(s => s.loadId === loadId ? { ...s, urgent: !s.urgent } : s); saveStops(t, arr); };

    return (
        <div className="max-w-[1600px] mx-auto px-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-xl font-black text-[#13294b]">Trip sheets — local delivery</h3>
                {locked
                    ? <span className="px-2.5 py-1 rounded-lg bg-[#13294b] text-white text-xs font-black uppercase">{code(branch)} depot</span>
                    : <select value={branch} onChange={e => { setBranch(e.target.value); setSel(new Set()); }} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>}
                <p className="text-xs text-slate-500">Cargo on the {code(branch)} floor → load local vehicles → deliver → POD.</p>
            </div>

            {/* On the floor */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="font-black text-[#13294b] text-sm uppercase tracking-wider">🏬 On the floor — {code(branch)} <span className="text-slate-400">({floor.length})</span></div>
                    {sel.size > 0 && <button onClick={() => setBuilding(floor.filter(l => sel.has(l.id)))} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-black py-1.5 px-3 rounded-lg text-xs uppercase tracking-wider">🚚 Load vehicle → trip sheet ({sel.size})</button>}
                </div>
                {floor.length === 0 ? <div className="px-4 py-8 text-center text-slate-400 text-sm">Nothing on the {code(branch)} floor awaiting delivery.</div> : (
                    <div className="divide-y divide-slate-100">
                        {floor.map(lc => (
                            <label key={lc.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${sel.has(lc.id) ? 'bg-amber-50' : 'hover:bg-amber-50/40'}`}>
                                <input type="checkbox" checked={sel.has(lc.id)} onChange={() => toggle(lc.id)} className="h-4 w-4 accent-[#13294b]" />
                                <span className="font-bold text-[#13294b] w-36">{lc.loadConNumber}</span>
                                <span className="text-sm text-slate-700 flex-1 truncate">{clientName(lc)} — {lc.deliveryPoint || ''}</span>
                                <span className="text-xs text-slate-500 w-44 text-right">{pkgsOf(lc) || '—'} pkgs · {lc.weightKg ? kg(Number(lc.weightKg)) + ' kg' : '—'} · {fmtDay(lc.deliveryDate)}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Trip sheets out for delivery */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-black text-[#13294b] text-sm uppercase tracking-wider">🚚 Out for delivery <span className="text-slate-400">({trips.length})</span></div>
                {trips.length === 0 ? <div className="px-4 py-8 text-center text-slate-400 text-sm">No trip sheets running.</div> : (
                    <div className="divide-y divide-slate-100">
                        {trips.map(t => {
                            const veh = vehicles.find((v: any) => v.id === t.vehicleId);
                            const loads = (loadConfirmations as LoadConfirmation[]).filter(l => (t.loadConfirmationIds || []).includes(l.id));
                            return (
                                <div key={t.id} className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button onClick={() => showModal('tripSheetDoc', { tripSheet: t })} className="font-bold text-[#13294b] underline decoration-dotted">{t.tripSheetNumber}</button>
                                        <span className="text-sm font-bold text-slate-700">{veh?.registration || 'vehicle'}</span>
                                        <span className="text-xs text-slate-500">{loads.length} drop{loads.length === 1 ? '' : 's'} · {code(t.branch)}</span>
                                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{t.status || 'Out for Delivery'}</span>
                                    </div>
                                    {/* Ordered delivery run — drop 1, 2, 3… (reorder / flag urgent) */}
                                    {loads.length > 1 && <p className="text-[10px] text-slate-400 mt-2 mb-0.5 uppercase tracking-wider font-bold">Delivery run · {loads.length} drops — reorder with ▲▼ or flag urgent</p>}
                                    <div className="mt-1 divide-y divide-slate-50 border border-slate-100 rounded-lg">
                                        {runStops(t).map((stop, idx) => {
                                            const l = loads.find(x => x.id === stop.loadId);
                                            if (!l) return null;
                                            const multi = loads.length > 1;
                                            return (
                                            <div key={l.id} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${stop.urgent ? 'bg-red-50' : ''}`}>
                                                {multi && (
                                                    <span className="flex flex-col leading-none">
                                                        <button onClick={() => move(t, idx, idx - 1)} disabled={idx === 0} className="text-slate-400 hover:text-[#13294b] disabled:opacity-20 text-xs">▲</button>
                                                        <button onClick={() => move(t, idx, idx + 1)} disabled={idx === runStops(t).length - 1} className="text-slate-400 hover:text-[#13294b] disabled:opacity-20 text-xs">▼</button>
                                                    </span>
                                                )}
                                                {multi && <span className="text-[10px] font-black text-white bg-[#13294b] rounded-full w-5 h-5 flex items-center justify-center shrink-0">{idx + 1}</span>}
                                                <span className="font-bold text-[#13294b] w-32 truncate">{l.loadConNumber}</span>
                                                <span className="text-slate-600 flex-1 truncate">{clientName(l)} — {l.deliveryPoint || ''}</span>
                                                {stop.urgent && <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded uppercase">Urgent</span>}
                                                <span className="text-[11px] text-slate-400 hidden sm:inline">{pkgsOf(l) || '?'} pkgs</span>
                                                {multi && <button onClick={() => toggleUrgent(t, l.id)} title="Flag this drop urgent (go first)" className={`text-[10px] font-bold py-1 px-1.5 rounded ${stop.urgent ? 'bg-red-600 text-white' : 'text-red-500 hover:bg-red-50'}`}>⚑</button>}
                                                {l.status === 'Delivered' && !l.podPhoto
                                                    ? <button onClick={() => getPod(l)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1 px-2 rounded uppercase">Get POD</button>
                                                    : l.status === 'POD Submitted'
                                                        ? <span className="text-[10px] font-bold text-emerald-600">✓ POD</span>
                                                        : <button onClick={() => markDelivered(l)} disabled={busy === l.id} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-bold py-1 px-2 rounded uppercase">{busy === l.id ? '…' : 'Delivered'}</button>}
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {building && <BuildTripPanel loads={building} branch={branch} vehicles={vehicles} users={users} clientName={clientName}
                onClose={() => setBuilding(null)}
                onBuild={async (vehicleId, driverId, odo) => {
                    const r = await handleCreateTripSheet({ vehicleId, driverId, loadConIds: building.map(l => l.id), branch, odometerStart: odo });
                    if (r?.ok === false) { showToast(`Could not create: ${r.error}`); return; }
                    showToast('Trip sheet created — out for delivery.');
                    if (r?.value) showModal('tripSheetDoc', { tripSheet: r.value });
                    setBuilding(null); setSel(new Set());
                }} />}
        </div>
    );
};

// Max payload (kg) from the vehicle's category — rigids + trailers. Longest match
// first so "15 tonner" doesn't trip the "5 ton" rule. See fleet-weight-overload-rules.
const payloadCap = (v: any): number | null => {
    const c = (v?.weightCategory || '').toLowerCase();
    if (/15\s*ton/.test(c)) return 14500;
    if (/12\s*ton/.test(c)) return 11500;
    if (/8\s*ton/.test(c)) return 7500;
    if (/5\s*ton/.test(c)) return 4500;
    if (/2\s*ton/.test(c)) return 1500;
    if (/1\s*ton/.test(c)) return 750;
    if (/triaxle|tri-axle/.test(c)) return 28000;
    if (/12\s*m/.test(c)) return 22000;
    if (/6\s*m/.test(c)) return 12000;
    return null;
};

const BuildTripPanel: React.FC<{ loads: LoadConfirmation[]; branch: string; vehicles: any[]; users: any[]; clientName: (l: LoadConfirmation) => string; onClose: () => void; onBuild: (vehicleId: string, driverId: string, odo?: number) => Promise<void> }> = ({ loads, branch, vehicles, users, clientName, onClose, onBuild }) => {
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [odo, setOdo] = useState('');
    const [saving, setSaving] = useState(false);
    // Fleet picker ordered by THIS depot first, then LM, then the rest — others can help.
    const trucks = useMemo(() => vehicles.filter((v: any) => v.status === 'On the road' && !/trailer|triaxle|skeleton|superlink/i.test(v.weightCategory || ''))
        .sort((a: any, b: any) => {
            const rank = (v: any) => v.branch === branch ? 0 : v.branch === 'LOADMASTER' ? 1 : 2;
            return rank(a) - rank(b) || (a.registration || '').localeCompare(b.registration || '');
        }), [vehicles, branch]);
    const drivers = users.filter((u: any) => ['Staff', 'Driver'].includes(u.role));
    const totalKg = useMemo(() => loads.reduce((s, l) => s + (Number(l.weightKg) || 0), 0), [loads]);
    const selVeh = vehicles.find((v: any) => v.id === vehicleId);
    const cap = selVeh ? payloadCap(selVeh) : null;
    const over = cap != null && totalKg > cap;
    const submit = async () => {
        if (!vehicleId || !driverId) { alert('Pick a vehicle and a driver.'); return; }
        if (over && !window.confirm(`⚠ OVERLOADED — ${kg(totalKg)} kg vs ${kg(cap!)} kg cap (over by ${kg(totalKg - cap!)} kg). Dispatch anyway? This override is recorded.`)) return;
        setSaving(true); await onBuild(vehicleId, driverId, odo ? Number(odo) : undefined); setSaving(false);
    };
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-3 rounded-t-2xl bg-[#13294b] text-white flex items-center justify-between">
                    <h3 className="font-black text-lg">Load delivery vehicle</h3>
                    <span className="text-sm text-white/80">{code(branch)} · {loads.length} drop{loads.length === 1 ? '' : 's'} · {kg(totalKg)} kg</span>
                </div>
                <div className="p-5 space-y-4">
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {loads.map(l => <div key={l.id} className="px-3 py-1.5 text-sm flex justify-between gap-2"><span className="font-bold text-[#13294b]">{l.loadConNumber}</span><span className="text-slate-500 truncate">{clientName(l)} — {l.deliveryPoint || ''}{l.weightKg ? ` · ${kg(Number(l.weightKg))} kg` : ''}</span></div>)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Vehicle (this depot first)</label>
                            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- vehicle --</option>
                                {trucks.map((v: any) => <option key={v.id} value={v.id}>{v.registration} · {v.branch === 'LOADMASTER' ? 'LM' : (v.branch || '').replace('FBN ', '')} ({v.name})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Driver</label>
                            <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- driver --</option>
                                {drivers.map((d: any) => <option key={d.email} value={d.email}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Odo start (km)</label>
                            <input value={odo} onChange={e => setOdo(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="km" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                    {cap != null && (
                        <p className={`text-xs font-bold ${over ? 'text-red-600' : 'text-emerald-600'}`}>
                            {over ? '⚠ ' : '✓ '}Load {kg(totalKg)} kg vs {kg(cap)} kg cap{over ? ` — OVER by ${kg(totalKg - cap)} kg` : ` — ${kg(cap - totalKg)} kg headroom`}
                        </p>
                    )}
                </div>
                <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{saving ? 'Creating…' : 'Create trip sheet'}</button>
                </div>
            </div>
        </div>
    );
};

export default OperationsTripSheets;
