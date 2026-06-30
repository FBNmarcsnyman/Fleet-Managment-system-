import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState, useAuth, useVehicles } from '../../contexts/AppContexts';
import { fmtDay } from '../../lib/format';
import { invokeFn } from '../../lib/supabase';

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
    const { loadConfirmations = [], clients = [], suppliers = [], users = [], manifests = [], handleCreateManifest, handleReceiveManifest } = useOperations() as any;
    const { vehicles = [], drivers = [] } = (useVehicles() as any) || {};
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
                                <span className="font-bold text-[#13294b] w-24 sm:w-36 shrink-0 truncate">{lc.loadConNumber}</span>
                                <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{clientName(lc)}</span>
                                <span className="text-xs font-bold text-slate-600 shrink-0">{code(lc.collectionBranch)} → {code(lc.destinationBranch)}</span>
                                <span className="text-xs text-slate-500 w-28 sm:w-40 shrink-0 text-right">{pkgsOf(lc) || '—'} pkgs · {lc.weightKg ? kg(Number(lc.weightKg)) + ' kg' : '—'}</span>
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
                            const turnover = loads.reduce((s, l) => s + (Number((l as any).totalAmount) || 0), 0);
                            const margin = turnover - (Number((m as any).totalRate) || 0);
                            const inbound = !isManager && m.destinationBranch === origin;
                            return (
                                <div key={m.id} className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button onClick={() => showModal('manifestDoc', { manifest: m })} className="font-bold text-[#13294b] underline decoration-dotted">{m.manifestNumber}</button>
                                        <span className="text-sm font-bold text-slate-700">{code(m.originBranch)} → {code(m.destinationBranch)}</span>
                                        {m.trailerSize && <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{m.trailerSize}</span>}
                                        {m.carrierName && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">BROKER</span>}
                                        <span className="text-xs text-slate-500">{m.carrierName ? `${m.carrierName}${m.carrierVehicleReg ? ' · ' + m.carrierVehicleReg : ''}` : (veh?.registration || 'truck')} · {loads.length} load{loads.length === 1 ? '' : 's'} · {tot.p} pkgs · {kg(tot.k)} kg</span>
                                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{m.status || 'In Transit'}</span>
                                        {isManager && (m as any).totalRate != null && <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${margin < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>margin R {kg(margin)}</span>}
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

            {building && <BuildManifestPanel loads={building} origin={origin} vehicles={vehicles} drivers={drivers} suppliers={suppliers} canSeeMargin={isManager} clientName={clientName}
                onClose={() => setBuilding(null)}
                onBuild={async (data) => {
                    const r = await handleCreateManifest({ ...data, loadConIds: building.map(l => l.id), originBranch: origin });
                    if (r?.ok === false) { showToast(`Could not build: ${r.error}`); return; }
                    showToast('Manifest built — truck dispatched.');
                    if (r?.value) showModal('manifestDoc', { manifest: r.value });
                    setBuilding(null); setSel(new Set());
                }} />}
        </div>
    );
};

// Per-trailer payload caps (kg) — see fleet-weight-overload-rules.
const TRAILER_CAP: Record<string, number> = { '6m': 12000, '12m': 22000 };
const isTrailerVeh = (v: any) => /trailer|triaxle|skeleton|superlink/i.test(v.weightCategory || '');
// weight_category is UPPERCASE + messy — classify case-insensitively (see fleet-structure).
const isHorseVeh = (v: any) => String(v?.weightCategory || '').toUpperCase().includes('HORSE');
// City code from the vehicle's branch (fleet uses full names: FBN Durban / Loadmaster …).
const vBranchCode = (v: any): string => {
    const n = String(v?.branch?.name || v?.branch || '').toLowerCase();
    if (n.includes('durban')) return 'DBN';
    if (n.includes('johannes') || n.includes('jhb')) return 'JHB';
    if (n.includes('cape') || n.includes('cpt')) return 'CPT';
    if (n.includes('loadmaster') || n.includes('lm')) return 'LM';
    return '—';
};

interface BuildData { vehicleId: string; driverId: string; trailerSize: string; trailerReg6m?: string; trailerReg12m?: string; trailerSplit?: Record<string, '6m' | '12m'>; startOdometer?: number; totalRate?: number; carrierName?: string; carrierVehicleReg?: string; carrierDriver?: string; carrierCell?: string; carrierEmail?: string; }
const BuildManifestPanel: React.FC<{ loads: LoadConfirmation[]; origin: string; vehicles: any[]; drivers: any[]; suppliers?: any[]; canSeeMargin?: boolean; clientName: (l: LoadConfirmation) => string; onClose: () => void; onBuild: (data: BuildData) => Promise<void> }> = ({ loads, origin, vehicles, drivers, suppliers = [], canSeeMargin = false, clientName, onClose, onBuild }) => {
    const [runner, setRunner] = useState<'own' | 'broker'>('own');
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [trailer, setTrailer] = useState('12m');
    const [reg6m, setReg6m] = useState('');
    const [reg12m, setReg12m] = useState('');
    const [odometer, setOdometer] = useState('');
    const [totalRate, setTotalRate] = useState('');
    const [split, setSplit] = useState<Record<string, '6m' | '12m'>>({});
    const [saving, setSaving] = useState(false);
    // Broker (subbie) running the depot->depot leg — their details + email.
    const [carrierName, setCarrierName] = useState('');
    const [carrierReg, setCarrierReg] = useState('');
    const [carrierDriver, setCarrierDriver] = useState('');
    const [carrierCell, setCarrierCell] = useState('');
    const [carrierEmail, setCarrierEmail] = useState('');
    const isBroker = runner === 'broker';
    const supplierNames = useMemo(() => (suppliers || []).filter((s: any) => s.type === 'Transport').map((s: any) => s.name).filter(Boolean), [suppliers]);
    // Auto-fill the broker email from the matched supplier's first contact.
    const onCarrierName = (name: string) => {
        setCarrierName(name);
        const s = (suppliers || []).find((x: any) => (x.name || '').toLowerCase() === name.toLowerCase());
        const email = s?.contactEmail || (s?.contacts || [])[0]?.email;
        if (email && !carrierEmail) setCarrierEmail(email);
    };
    const dest = loads[0]?.destinationBranch;
    const homeCode = code(origin);
    const [odoMsg, setOdoMsg] = useState('');
    const [odoLoading, setOdoLoading] = useState(false);

    // Line-haul = horses. List this depot first, then Loadmaster, then others.
    const eligibleTrucks = useMemo(() => vehicles
        .filter((v: any) => isHorseVeh(v))
        .sort((a: any, b: any) => {
            const r = (v: any) => { const c = vBranchCode(v); return c === homeCode ? 0 : c === 'LM' ? 1 : 2; };
            return r(a) - r(b) || String(a.registration || '').localeCompare(String(b.registration || ''));
        }), [vehicles, homeCode]);
    const truckGroups = useMemo(() => {
        const g: Record<string, any[]> = { [homeCode]: [], LM: [], Other: [] };
        eligibleTrucks.forEach((v: any) => { const c = vBranchCode(v); (g[c === homeCode ? homeCode : c === 'LM' ? 'LM' : 'Other'] ||= []).push(v); });
        return g;
    }, [eligibleTrucks, homeCode]);
    const trailerRegs = useMemo(() => vehicles.filter(isTrailerVeh).map((v: any) => v.registration).filter(Boolean), [vehicles]);
    // Active drivers from the register, this depot first.
    const driverList = useMemo(() => (drivers || [])
        .filter((d: any) => d.isActive !== false)
        .sort((a: any, b: any) => (code(a.branch) === homeCode ? 0 : 1) - (code(b.branch) === homeCode ? 0 : 1) || String(a.name || '').localeCompare(String(b.name || ''))), [drivers, homeCode]);
    const isSuper = trailer === '6m + 12m';

    // Pull the live odometer from the tracker when a truck is chosen.
    const pullOdo = async (reg?: string) => {
        if (!reg) return;
        setOdoLoading(true); setOdoMsg('');
        try {
            const { data } = await invokeFn('track', { body: { action: 'vehicle', reg } });
            const km = (data as any)?.odometer ?? (data as any)?.vehicle?.odometer;
            if (km) { setOdometer(String(Math.round(Number(km)))); setOdoMsg('Pulled from live tracker'); }
            else setOdoMsg('No live odometer — enter manually');
        } catch { setOdoMsg('Tracker unavailable — enter manually'); }
        setOdoLoading(false);
    };
    const onPickTruck = (id: string) => { setVehicleId(id); const v = vehicles.find((x: any) => x.id === id); if (v?.registration) pullOdo(v.registration); };
    // Turnover = sum of every loaded waybill's client charge; line-haul cost (LM /
    // broker, changes monthly with diesel) is entered below; margin = turnover − cost.
    const turnover = useMemo(() => loads.reduce((s, l) => s + (Number((l as any).totalAmount) || 0), 0), [loads]);
    const lineHaulCost = parseFloat(totalRate) || 0;

    const kgOf = (l: any) => Number(l.weightKg) || 0;
    // Which trailer each load sits on. Single-trailer = all on it; superlink = per the split (default 12m).
    const trailerOf = (l: any): '6m' | '12m' => isSuper ? (split[l.id] || '12m') : (trailer as '6m' | '12m');
    const totals = useMemo(() => {
        const t: Record<string, number> = { '6m': 0, '12m': 0 };
        loads.forEach(l => { t[trailerOf(l)] = (t[trailerOf(l)] || 0) + kgOf(l); });
        return t;
    }, [loads, split, trailer]);
    const legs = isSuper ? ['6m', '12m'] : [trailer];
    const overloaded = legs.filter(leg => (totals[leg] || 0) > (TRAILER_CAP[leg] || Infinity));

    const submit = async () => {
        if (isBroker) { if (!carrierName.trim()) { alert('Enter the broker (carrier) name.'); return; } }
        else if (!vehicleId || !driverId) { alert('Pick a truck and a driver.'); return; }
        if (overloaded.length) {
            const msg = overloaded.map(leg => `${leg}: ${kg(totals[leg])} kg vs ${kg(TRAILER_CAP[leg])} kg cap (over by ${kg(totals[leg] - TRAILER_CAP[leg])} kg)`).join('\n');
            if (!window.confirm(`⚠ OVERLOADED — dispatch anyway?\n\n${msg}\n\nThis override will be recorded.`)) return;
        }
        setSaving(true);
        await onBuild({
            vehicleId: isBroker ? '' : vehicleId, driverId: isBroker ? '' : driverId, trailerSize: trailer,
            trailerReg6m: (isSuper || trailer === '6m') ? (reg6m || undefined) : undefined,
            trailerReg12m: (isSuper || trailer === '12m') ? (reg12m || undefined) : undefined,
            trailerSplit: isSuper ? loads.reduce((m, l) => ({ ...m, [l.id]: trailerOf(l) }), {} as Record<string, '6m' | '12m'>) : undefined,
            startOdometer: odometer ? parseFloat(odometer) : undefined,
            totalRate: totalRate ? parseFloat(totalRate) : undefined,
            carrierName: isBroker ? carrierName.trim() : undefined,
            carrierVehicleReg: isBroker ? (carrierReg || undefined) : undefined,
            carrierDriver: isBroker ? (carrierDriver || undefined) : undefined,
            carrierCell: isBroker ? (carrierCell || undefined) : undefined,
            carrierEmail: isBroker ? (carrierEmail || undefined) : undefined,
        });
        setSaving(false);
    };
    const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
    const lbl = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1';
    const capPill = (leg: string) => { const over = (totals[leg] || 0) > (TRAILER_CAP[leg] || Infinity); return <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${over ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{leg}: {kg(totals[leg] || 0)} / {kg(TRAILER_CAP[leg])} kg{over ? ` · OVER ${kg(totals[leg] - TRAILER_CAP[leg])}` : ''}</span>; };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-3 rounded-t-2xl bg-[#13294b] text-white flex items-center justify-between sticky top-0">
                    <h3 className="font-black text-lg">Load line-haul truck</h3>
                    <span className="text-sm text-white/80">{code(origin)} → {code(dest)}</span>
                </div>
                <div className="p-5 space-y-4">
                    {/* cargo + per-trailer assignment */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{loads.length} shipment{loads.length === 1 ? '' : 's'}{isSuper ? ' — assign each to 6m / 12m' : ''}</div>
                            <div className="flex gap-1.5 flex-wrap">{legs.map(capPill)}</div>
                        </div>
                        <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {loads.map(l => (
                                <div key={l.id} className="px-3 py-1.5 text-sm flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate"><span className="font-bold text-[#13294b]">{l.loadConNumber}</span> <span className="text-slate-500">{clientName(l)} · {kgOf(l) ? kg(kgOf(l)) + ' kg' : '? kg'}</span></span>
                                    {isSuper && (
                                        <span className="flex gap-1 shrink-0">
                                            {(['6m', '12m'] as const).map(leg => <button key={leg} type="button" onClick={() => setSplit(s => ({ ...s, [l.id]: leg }))} className={`text-[11px] font-bold px-2 py-0.5 rounded ${trailerOf(l) === leg ? 'bg-[#13294b] text-white' : 'bg-slate-100 text-slate-500'}`}>{leg}</button>)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Who runs the depot->depot leg */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                        <button type="button" onClick={() => setRunner('own')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${!isBroker ? 'bg-[#13294b] text-white' : 'text-slate-600'}`}>Own fleet</button>
                        <button type="button" onClick={() => setRunner('broker')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${isBroker ? 'bg-amber-500 text-white' : 'text-slate-600'}`}>Broker (subbie)</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={lbl}>Trailer config</label>
                            <select value={trailer} onChange={e => setTrailer(e.target.value)} className={inp}>
                                <option value="6m">6 m</option>
                                <option value="12m">12 m</option>
                                <option value="6m + 12m">6 m + 12 m (superlink)</option>
                            </select>
                        </div>
                        {!isBroker ? (
                            <>
                                <div>
                                    <label className={lbl}>Line-haul truck <span className="text-slate-400 normal-case">({homeCode} first)</span></label>
                                    <select value={vehicleId} onChange={e => onPickTruck(e.target.value)} className={inp}>
                                        <option value="">-- truck --</option>
                                        {[homeCode, 'LM', 'Other'].map(gk => (truckGroups[gk] && truckGroups[gk].length) ? (
                                            <optgroup key={gk} label={gk === homeCode ? `${homeCode} depot` : gk === 'LM' ? 'Loadmaster' : 'Other branches'}>
                                                {truckGroups[gk].map((v: any) => <option key={v.id} value={v.id}>{v.registration} — {v.name}{v.status !== 'On the road' ? ' ⚠ off-road' : ''}</option>)}
                                            </optgroup>
                                        ) : null)}
                                    </select>
                                    {eligibleTrucks.length === 0 && <div className="text-[11px] text-amber-600 mt-1">No horses in the fleet.</div>}
                                </div>
                                <div>
                                    <label className={lbl}>Driver</label>
                                    <select value={driverId} onChange={e => setDriverId(e.target.value)} className={inp}>
                                        <option value="">-- driver --</option>
                                        {driverList.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.branch ? ` · ${code(d.branch)}` : ''}</option>)}
                                    </select>
                                    {driverList.length === 0 && <div className="text-[11px] text-amber-600 mt-1">No drivers on the register (add under Fleet → Drivers).</div>}
                                </div>
                            </>
                        ) : (
                            <>
                                <div><label className={lbl}>Broker (carrier)</label><input list="brokerList" value={carrierName} onChange={e => onCarrierName(e.target.value)} className={inp} placeholder="carrier name" /><datalist id="brokerList">{supplierNames.map((n: string) => <option key={n} value={n} />)}</datalist></div>
                                <div><label className={lbl}>Carrier email</label><input type="email" value={carrierEmail} onChange={e => setCarrierEmail(e.target.value)} className={inp} placeholder="manifest is emailed here" /></div>
                                <div><label className={lbl}>Vehicle reg</label><input value={carrierReg} onChange={e => setCarrierReg(e.target.value)} className={inp} placeholder="reg" /></div>
                                <div><label className={lbl}>Driver name</label><input value={carrierDriver} onChange={e => setCarrierDriver(e.target.value)} className={inp} /></div>
                                <div><label className={lbl}>Driver cell</label><input value={carrierCell} onChange={e => setCarrierCell(e.target.value)} className={inp} /></div>
                            </>
                        )}
                        {(isSuper || trailer === '6m') && (
                            <div><label className={lbl}>6m trailer reg</label><input list="trReg" value={reg6m} onChange={e => setReg6m(e.target.value)} className={inp} placeholder="reg" /></div>
                        )}
                        {(isSuper || trailer === '12m') && (
                            <div><label className={lbl}>12m trailer reg</label><input list="trReg" value={reg12m} onChange={e => setReg12m(e.target.value)} className={inp} placeholder="reg" /></div>
                        )}
                        <datalist id="trReg">{trailerRegs.map((r: string) => <option key={r} value={r} />)}</datalist>
                        {!isBroker && <div>
                            <label className={lbl}>Truck mileage (km)</label>
                            <div className="flex gap-1.5">
                                <input type="number" value={odometer} onChange={e => { setOdometer(e.target.value); setOdoMsg(''); }} className={inp} placeholder="auto from tracker" />
                                <button type="button" onClick={() => pullOdo(vehicles.find((v: any) => v.id === vehicleId)?.registration)} disabled={!vehicleId || odoLoading} title="Pull the live odometer from the tracker" className="px-2.5 rounded-lg border border-slate-300 text-sm font-bold text-[#13294b] hover:bg-slate-50 disabled:opacity-40">{odoLoading ? '…' : '↻'}</button>
                            </div>
                            {odoMsg && <div className="text-[10px] text-slate-500 mt-0.5">{odoMsg}</div>}
                        </div>}
                        <div><label className={lbl}>Line-haul cost this trip (excl VAT)</label><input type="number" step="0.01" value={totalRate} onChange={e => setTotalRate(e.target.value)} className={inp} placeholder="LM / broker cost — changes monthly with diesel" /></div>
                    </div>
                    {/* Turnover + margin = MANAGEMENT only. Ops view/enter the cost, not profit/revenue. */}
                    {canSeeMargin && (
                        <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <span className="text-slate-600">Turnover (all {loads.length} waybills): <strong className="text-slate-800">R {kg(turnover)}</strong></span>
                            <span className="text-slate-400">−</span>
                            <span className="text-slate-600">Line-haul cost: <strong className="text-slate-800">R {kg(lineHaulCost)}</strong></span>
                            <span className="text-slate-400">=</span>
                            <span className={`font-bold ${turnover - lineHaulCost < 0 ? 'text-red-600' : 'text-emerald-700'}`}>Margin: R {kg(turnover - lineHaulCost)}</span>
                            <span className="text-[11px] text-slate-400 ml-auto">management view · each waybill invoiced to its own client</span>
                        </div>
                    )}
                    {isBroker && <p className="text-[11px] text-slate-500">Depot → depot transfer — no POD requested from the broker (the receiving-depot GRN is the proof). The manifest is emailed to the carrier.</p>}
                    {overloaded.length > 0 && <p className="text-[11px] font-bold text-red-600">⚠ Overloaded on {overloaded.join(' & ')} — remove stock or override on dispatch (recorded).</p>}
                </div>
                <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{saving ? 'Building…' : 'Build & dispatch'}</button>
                </div>
            </div>
        </div>
    );
};

export default OperationsManifests;
