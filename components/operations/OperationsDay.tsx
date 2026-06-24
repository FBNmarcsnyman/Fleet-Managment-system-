import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState, useAuth, useVehicles } from '../../contexts/AppContexts';
import { nextStep, statusChip, STATUS_LABEL, isCollectionStage, isAssigned } from '../../lib/loadStatus';
import { fmtDay } from '../../lib/format';
import { manifestHtml, opsEmailFor } from '../../lib/linehaulDocs';
import { invokeFn } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// OPERATIONS — DAY (list-flow worklist)
//
// The whole own-fleet day worked as a staged LIST, the way a dispatch desk
// actually runs it — three stages you click between:
//   📥 Collections — everything still to collect / at the origin depot. Tick the
//      ones going the same way → GROUP → build a line-haul manifest (inter-depot).
//   🚛 Line-haul   — the manifests (trucks) in transit; RECEIVE at the depot,
//      which drops the loads onto the delivery list.
//   🚚 Deliveries  — cargo received at this depot for local delivery to clients.
//      Tick the drops → assign a TRIP SHEET (one truck, multiple drops) → deliver
//      → POD.
//
// Branch-locked: DBN ops sees DBN, JHB ops sees JHB (managers/admin see all and
// can switch). 99% of cargo is collected & delivered on FBN's own vehicles
// (DBN↔JHB run + surrounds), so the unit column shows the FBN reg + driver.
// Operations-only — Broking stays separate. Reuses the existing manifest /
// trip-sheet mechanism (handleCreateManifest / handleReceiveManifest /
// handleCreateTripSheet).
// ---------------------------------------------------------------------------

const BRANCHES = ['FBN JHB', 'FBN DBN', 'FBN CPT'];
const CITY: Record<string, string> = { 'FBN JHB': 'JHB', 'FBN DBN': 'DBN', 'FBN CPT': 'CPT', 'FBN PE': 'PE', 'FBN EL': 'EL', 'FBN BFN': 'BFN' };
const code = (b?: string) => (b && CITY[b]) || (b ? b.replace(/^FBN\s*/, '') : '—');
const todayISO = () => new Date().toISOString().slice(0, 10);

type Stage = 'collect' | 'linehaul' | 'deliver';
type DateMode = 'today' | 'overdue' | 'all';

// Loads sitting at a destination depot ready for local delivery (or already out
// / delivered awaiting POD). POD Submitted / Invoiced are done — off the list.
const DELIVERY_STATUSES = new Set(['At Destination Depot', 'Unloaded', 'Out for Delivery', 'Delivered']);
const READY_TO_LOAD = new Set(['At Destination Depot', 'Unloaded']); // can be put on a trip sheet

const OperationsDay: React.FC = () => {
    const { loadConfirmations = [], clients = [], users = [], manifests = [], handleUpdateLoadConfirmation, handleCreateManifest, handleReceiveManifest, handleCreateTripSheet } = useOperations() as any;
    const { vehicles = [] } = (useVehicles() as any) || {};
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();

    // Branch lock — a single-branch ops user is pinned to their branch; a
    // manager / admin sees all and can switch.
    const opsBranches: string[] = (currentUser?.assignedBranches || []).filter((b: string) => BRANCHES.includes(b));
    const isManager = ['Admin', 'Super Admin'].includes(currentUser?.role);
    const locked = !isManager && opsBranches.length === 1;
    const [branch, setBranch] = useState<string>(locked ? opsBranches[0] : (opsBranches[0] || 'All'));

    const [stage, setStage] = useState<Stage>('collect');
    const [q, setQ] = useState('');
    const [dateMode, setDateMode] = useState<DateMode>('all');
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<string | null>(null);
    const [build, setBuild] = useState<{ mode: 'manifest' | 'trip'; loads: LoadConfirmation[] } | null>(null);

    const branchMatch = (v?: string) => branch === 'All' || v === branch;
    const clientName = (lc: LoadConfirmation) => lc.clientName || (clients.find((c: any) => c.id === lc.clientId)?.name) || '—';
    const driverName = (id?: string) => { if (!id) return ''; const u = users.find((u: any) => u.id === id || u.email === id); return u?.name || ''; };
    // FBN unit (reg · driver). Falls back to subbie name only when brokered.
    const unit = (lc: LoadConfirmation) => {
        const reg = lc.vehicleId ? (vehicles.find((v: any) => v.id === lc.vehicleId)?.registration || '') : (lc.subcontractorVehicleReg || '');
        const drv = driverName(lc.driverId) || lc.subcontractorDriverName || '';
        const parts = [reg, drv].filter(Boolean);
        if (parts.length) return parts.join(' · ');
        if (lc.subcontractorName) return lc.subcontractorName;
        return isAssigned(lc) ? 'FBN fleet' : '— not assigned';
    };
    const pkgs = (lc: LoadConfirmation): number => {
        if (lc.loadedPackages) return Number(lc.loadedPackages);
        if (lc.quantity && !isNaN(parseInt(lc.quantity))) return parseInt(lc.quantity);
        if (Array.isArray(lc.items)) return lc.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
        return 0;
    };
    const weight = (lc: LoadConfirmation) => (lc.weightKg ? `${Number(lc.weightKg).toLocaleString('en-ZA')} kg` : '—');
    const matchQ = (lc: LoadConfirmation) => {
        if (!q.trim()) return true;
        return `${lc.loadConNumber} ${lc.loadRefNo || ''} ${clientName(lc)} ${lc.collectionPoint || ''} ${lc.deliveryPoint || ''} ${unit(lc)}`.toLowerCase().includes(q.trim().toLowerCase());
    };

    // ---- Stage data ----
    const collections = useMemo(() => {
        const t = todayISO();
        return (loadConfirmations as LoadConfirmation[])
            .filter(lc => lc.isCollection && isCollectionStage(lc.status))
            .filter(lc => branchMatch(lc.collectionBranch))
            .filter(lc => dateMode === 'all' ? true : dateMode === 'today' ? lc.collectionDate === t : (!!lc.collectionDate && lc.collectionDate < t))
            .filter(matchQ)
            .sort((a, b) => (a.collectionDate || '').localeCompare(b.collectionDate || '') || a.loadConNumber.localeCompare(b.loadConNumber));
    }, [loadConfirmations, clients, vehicles, branch, dateMode, q]);

    const linehaul = useMemo(() =>
        (manifests as any[])
            .filter(m => m.status !== 'Arrived')
            .filter(m => branch === 'All' || m.originBranch === branch || m.destinationBranch === branch)
            .sort((a, b) => String(b.manifestNumber || '').localeCompare(String(a.manifestNumber || ''))),
    [manifests, branch]);

    const deliveries = useMemo(() =>
        (loadConfirmations as LoadConfirmation[])
            .filter(lc => DELIVERY_STATUSES.has(lc.status))
            .filter(lc => branchMatch(lc.destinationBranch))
            .filter(matchQ)
            .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || '') || a.loadConNumber.localeCompare(b.loadConNumber)),
    [loadConfirmations, clients, vehicles, branch, q]);

    const list = stage === 'collect' ? collections : stage === 'deliver' ? deliveries : [];
    const selLoads = useMemo(() => (list as LoadConfirmation[]).filter(lc => sel.has(lc.id)), [list, sel]);
    const selDests = useMemo(() => Array.from(new Set(selLoads.map(l => stage === 'collect' ? l.destinationBranch : l.destinationBranch).filter(Boolean))), [selLoads, stage]);

    const switchStage = (s: Stage) => { setStage(s); setSel(new Set()); };
    const toggle = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const advance = async (lc: LoadConfirmation) => {
        const step = nextStep(lc); if (!step) return;
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: step.status });
        setBusy(null);
        if (res && res.ok === false) showToast?.(res.error || 'Could not update');
    };
    // Quick path: a collection booked with no driver/details, cargo already collected —
    // move it straight to "collected" without forcing the assign step first.
    const markCollected = async (lc: LoadConfirmation) => {
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: 'Collected' });
        setBusy(null);
        if (res && res.ok === false) showToast?.(res.error || 'Could not update');
    };
    const markDelivered = async (lc: LoadConfirmation) => {
        setBusy(lc.id);
        const res = await handleUpdateLoadConfirmation(lc.id, { status: 'Delivered' });
        setBusy(null);
        if (res && res.ok === false) showToast?.(res.error || 'Could not update');
    };
    const getPod = (lc: LoadConfirmation) => showModal('pod', {
        loadCon: lc,
        onSubmit: (id: string, pod: any) => handleUpdateLoadConfirmation(id, { podPhoto: pod.photo, podSignature: pod.signature, status: 'POD Submitted', paymentStatus: 'Awaiting POD' }),
        onCancel: () => showModal('hide'),
    });

    const openBuild = (mode: 'manifest' | 'trip') => {
        if (selLoads.length === 0) return;
        if (selDests.length > 1) { showToast?.('Selected loads go to different branches — pick one destination.'); return; }
        if (mode === 'trip') {
            const notReady = selLoads.filter(l => !READY_TO_LOAD.has(l.status));
            if (notReady.length) { showToast?.('Only depot/received loads can go on a trip sheet (not ones already out / delivered).'); return; }
        }
        setBuild({ mode, loads: selLoads });
    };

    const receive = async (m: any) => {
        if (!window.confirm(`Receive manifest ${m.manifestNumber || ''} at ${code(m.destinationBranch)}? This moves every load on it to the delivery list.`)) return;
        setBusy(m.id);
        const res = await handleReceiveManifest(m.id);
        setBusy(null);
        if (res && res.ok === false) showToast?.(res.error || 'Could not receive manifest');
        else { showToast?.('Received — loads are on the delivery list.'); setStage('deliver'); }
    };

    const inputCls = 'border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
    const STAGES: { key: Stage; label: string; n: number }[] = [
        { key: 'collect', label: '📥 Collections', n: collections.length },
        { key: 'linehaul', label: '🚛 Line-haul', n: linehaul.length },
        { key: 'deliver', label: '🚚 Deliveries', n: deliveries.length },
    ];

    return (
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4">
            {/* Header + stage selector */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className="text-xl font-black text-[#13294b] mr-1">Operations — Day</h2>
                {locked
                    ? <span className="px-2.5 py-1 rounded-lg bg-[#13294b] text-white text-xs font-black uppercase tracking-wide">{code(branch)} depot</span>
                    : <select value={branch} onChange={e => { setBranch(e.target.value); setSel(new Set()); }} className={inputCls}>
                        <option value="All">All branches</option>
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>}
                <div className="flex rounded-lg overflow-x-auto border border-slate-300 ml-0 sm:ml-1 max-w-full">
                    {STAGES.map(s => (
                        <button key={s.key} onClick={() => switchStage(s.key)}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${stage === s.key ? 'bg-[#13294b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                            {s.label} <span className={stage === s.key ? 'text-white/70' : 'text-slate-400'}>{s.n}</span>
                        </button>
                    ))}
                </div>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search load, client, place, reg…" className={`${inputCls} w-full sm:flex-1 sm:w-auto sm:min-w-[180px]`} />
            </div>

            {/* ===== COLLECTIONS ===== */}
            {stage === 'collect' && (
                <ListCard title="Collections to action" count={collections.length} empty="Nothing to collect for this filter."
                    leftFilter={<DateChips mode={dateMode} set={setDateMode} />}
                    action={sel.size > 0 && <BuildBtn count={sel.size} dest={selDests.length === 1 ? code(selDests[0] as string) : ''} label="🚛 Group → build manifest" onClick={() => openBuild('manifest')} onClear={() => setSel(new Set())} />}>
                    {/* desktop table */}
                    <div className="hidden md:block">
                    <Table cols={['', 'Load', 'Client', 'Route', 'Pkgs', 'Weight', 'Collect by', 'FBN unit', 'Status', 'Action']}>
                        {collections.map(lc => {
                            const step = nextStep(lc);
                            const overdue = lc.collectionDate && lc.collectionDate < todayISO();
                            return (
                                <Row key={lc.id} selected={sel.has(lc.id)} onOpen={() => showModal('loadDetail', { loadCon: lc })}>
                                    <Cell stop><input type="checkbox" checked={sel.has(lc.id)} onChange={() => toggle(lc.id)} className="h-4 w-4 accent-[#13294b]" /></Cell>
                                    <Cell><span className="font-bold text-[#13294b]">{lc.loadConNumber}</span>{lc.loadRefNo && <div className="text-[11px] text-slate-400">WB {lc.loadRefNo}</div>}</Cell>
                                    <Cell className="text-slate-700">{clientName(lc)}</Cell>
                                    <RouteCell lc={lc} />
                                    <Cell className="font-bold text-slate-700">{pkgs(lc) || '—'}</Cell>
                                    <Cell className="text-slate-600">{weight(lc)}</Cell>
                                    <Cell className={overdue ? 'text-red-600 font-bold' : 'text-slate-600'}>{fmtDay(lc.collectionDate)}{overdue ? ' ⚠' : ''}</Cell>
                                    <Cell className="text-slate-600 max-w-[150px] truncate">{unit(lc)}</Cell>
                                    <Cell><Chip lc={lc} /></Cell>
                                    <Cell stop className="text-right">
                                        {!isAssigned(lc) && lc.status === 'Booked'
                                            ? <div className="flex gap-1.5 justify-end">
                                                <ActBtn tone="emerald" onClick={() => showModal('assignFbn', { loadCon: lc })}>Assign FBN</ActBtn>
                                                <ActBtn tone="blue" disabled={busy === lc.id} onClick={() => markCollected(lc)}>{busy === lc.id ? '…' : '✓ Collected'}</ActBtn>
                                              </div>
                                            : step ? <ActBtn tone="blue" disabled={busy === lc.id} onClick={() => advance(lc)}>{busy === lc.id ? '…' : step.label}</ActBtn>
                                                : <span className="text-[11px] text-slate-400">ready</span>}
                                    </Cell>
                                </Row>
                            );
                        })}
                    </Table>
                    </div>
                    {/* mobile cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {collections.map(lc => {
                            const step = nextStep(lc);
                            const overdue = lc.collectionDate && lc.collectionDate < todayISO();
                            return (
                                <MobileCard key={lc.id} lc={lc} selected={sel.has(lc.id)} onOpen={() => showModal('loadDetail', { loadCon: lc })}
                                    checkbox={<input type="checkbox" checked={sel.has(lc.id)} onChange={() => toggle(lc.id)} onClick={e => e.stopPropagation()} className="h-5 w-5 accent-[#13294b] mt-0.5" />}
                                    client={clientName(lc)} route={`${code(lc.collectionBranch)} → ${code(lc.destinationBranch)}`} place={lc.collectionPoint}
                                    meta={`${pkgs(lc) || '—'} pkgs · ${weight(lc)}`} dateLabel={`Collect ${fmtDay(lc.collectionDate)}`} overdue={!!overdue} unit={unit(lc)}
                                    action={!isAssigned(lc) && lc.status === 'Booked'
                                        ? <div className="flex gap-1.5">
                                            <ActBtn tone="emerald" onClick={() => showModal('assignFbn', { loadCon: lc })}>Assign FBN</ActBtn>
                                            <ActBtn tone="blue" disabled={busy === lc.id} onClick={() => markCollected(lc)}>{busy === lc.id ? '…' : '✓ Collected'}</ActBtn>
                                          </div>
                                        : step ? <ActBtn tone="blue" disabled={busy === lc.id} onClick={() => advance(lc)}>{busy === lc.id ? '…' : step.label}</ActBtn> : null} />
                            );
                        })}
                    </div>
                </ListCard>
            )}

            {/* ===== LINE-HAUL ===== */}
            {stage === 'linehaul' && (
                <ListCard title="Line-haul / trucks" count={linehaul.length} empty="No line-haul trucks in transit. Build one from the Collections list.">
                    <div className="divide-y divide-slate-100">
                        {linehaul.map(m => {
                            const veh = vehicles.find((v: any) => v.id === m.vehicleId);
                            const n = (m.loadConfirmationIds || []).length;
                            const inbound = branch !== 'All' && m.destinationBranch === branch;
                            return (
                                <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => showModal('manifestDoc', { manifest: m })}>
                                    <span className="font-bold text-[#13294b] underline decoration-dotted">{m.manifestNumber}</span>
                                    <span className="text-sm font-bold text-slate-700">{code(m.originBranch)} → {code(m.destinationBranch)}</span>
                                    {m.trailerSize && <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{m.trailerSize}</span>}
                                    <span className="text-xs text-slate-500">{veh?.registration || 'truck'}{driverName(m.driverId) ? ` · ${driverName(m.driverId)}` : ''} · {n} load{n === 1 ? '' : 's'}</span>
                                    <span className="text-[11px] text-slate-400">disp {fmtDay(m.dispatchDate)}</span>
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{m.status || 'In Transit'}</span>
                                    <button onClick={e => { e.stopPropagation(); receive(m); }} disabled={busy === m.id} className={`ml-auto font-bold py-1 px-3 rounded-lg text-[11px] uppercase text-white ${inbound ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-500 hover:bg-slate-400'} disabled:opacity-50`}>{busy === m.id ? '…' : `📦 Receive at ${code(m.destinationBranch)}`}</button>
                                </div>
                            );
                        })}
                    </div>
                </ListCard>
            )}

            {/* ===== DELIVERIES ===== */}
            {stage === 'deliver' && (
                <ListCard title="Deliveries from depot" count={deliveries.length} empty="No cargo waiting for delivery at this depot."
                    action={sel.size > 0 && <BuildBtn count={sel.size} dest="" label="🚚 Assign trip sheet (multi-drop)" onClick={() => openBuild('trip')} onClear={() => setSel(new Set())} />}>
                    {/* desktop table */}
                    <div className="hidden md:block">
                    <Table cols={['', 'Load', 'Client', 'Deliver to', 'Pkgs', 'Weight', 'Deliver by', 'FBN unit', 'Status', 'Action']}>
                        {deliveries.map(lc => (
                            <Row key={lc.id} selected={sel.has(lc.id)} onOpen={() => showModal('loadDetail', { loadCon: lc })}>
                                <Cell stop>{READY_TO_LOAD.has(lc.status) ? <input type="checkbox" checked={sel.has(lc.id)} onChange={() => toggle(lc.id)} className="h-4 w-4 accent-[#13294b]" /> : <span className="text-slate-300">—</span>}</Cell>
                                <Cell><span className="font-bold text-[#13294b]">{lc.loadConNumber}</span>{lc.loadRefNo && <div className="text-[11px] text-slate-400">WB {lc.loadRefNo}</div>}</Cell>
                                <Cell className="text-slate-700">{clientName(lc)}</Cell>
                                <Cell className="max-w-[200px]"><div className="text-slate-700 truncate">{lc.deliveryPoint || code(lc.destinationBranch)}</div>{lc.deliveryArea && <div className="text-[11px] text-slate-400 truncate">{lc.deliveryArea}</div>}</Cell>
                                <Cell className="font-bold text-slate-700">{pkgs(lc) || '—'}</Cell>
                                <Cell className="text-slate-600">{weight(lc)}</Cell>
                                <Cell className="text-slate-600">{fmtDay(lc.deliveryDate)}</Cell>
                                <Cell className="text-slate-600 max-w-[150px] truncate">{unit(lc)}</Cell>
                                <Cell><Chip lc={lc} /></Cell>
                                <Cell stop className="text-right">
                                    {lc.status === 'Out for Delivery' ? <ActBtn tone="blue" disabled={busy === lc.id} onClick={() => markDelivered(lc)}>{busy === lc.id ? '…' : 'Mark delivered'}</ActBtn>
                                        : lc.status === 'Delivered' ? <ActBtn tone="emerald" onClick={() => getPod(lc)}>Get POD</ActBtn>
                                            : <span className="text-[11px] text-slate-400">tick to load</span>}
                                </Cell>
                            </Row>
                        ))}
                    </Table>
                    </div>
                    {/* mobile cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {deliveries.map(lc => (
                            <MobileCard key={lc.id} lc={lc} selected={sel.has(lc.id)} onOpen={() => showModal('loadDetail', { loadCon: lc })}
                                checkbox={READY_TO_LOAD.has(lc.status) ? <input type="checkbox" checked={sel.has(lc.id)} onChange={() => toggle(lc.id)} onClick={e => e.stopPropagation()} className="h-5 w-5 accent-[#13294b] mt-0.5" /> : undefined}
                                client={clientName(lc)} route={lc.deliveryPoint || code(lc.destinationBranch)} place={lc.deliveryArea}
                                meta={`${pkgs(lc) || '—'} pkgs · ${weight(lc)}`} dateLabel={`Deliver ${fmtDay(lc.deliveryDate)}`} unit={unit(lc)}
                                action={lc.status === 'Out for Delivery' ? <ActBtn tone="blue" disabled={busy === lc.id} onClick={() => markDelivered(lc)}>{busy === lc.id ? '…' : 'Mark delivered'}</ActBtn>
                                    : lc.status === 'Delivered' ? <ActBtn tone="emerald" onClick={() => getPod(lc)}>Get POD</ActBtn> : null} />
                        ))}
                    </div>
                </ListCard>
            )}

            {build && <AssignUnitPanel
                mode={build.mode} loads={build.loads} vehicles={vehicles} users={users} driverName={driverName}
                onClose={() => setBuild(null)}
                onAssign={async (vehicleId, driverId, extra) => {
                    if (build.mode === 'manifest') {
                        const res = await handleCreateManifest({ vehicleId, driverId, loadConIds: build.loads.map(l => l.id), originBranch: build.loads[0].collectionBranch, trailerSize: extra.trailerSize });
                        if (res && res.ok === false) { showToast?.(res.error || 'Could not build manifest'); return; }
                        const man = (res as any)?.value;
                        // Auto-email the RECEIVING depot the full manifest (contents, weights,
                        // packages, cubes, totals, trailer) so they know what's inbound.
                        if (man) {
                            const veh = vehicles.find((v: any) => v.id === vehicleId);
                            const vehicleLabel = veh ? `${veh.registration}${veh.name ? ` (${veh.name})` : ''}` : '';
                            try {
                                await invokeFn('send-email', { body: { to: opsEmailFor(man.destinationBranch), cc: [opsEmailFor(man.originBranch), 'ops@fbn-transport.co.za'], subject: `LINE-HAUL MANIFEST ${man.manifestNumber} — ${man.originBranch} to ${man.destinationBranch}`, html: manifestHtml({ manifest: man, loads: build.loads, vehicleLabel, driverName: driverName(driverId), clientNameOf: clientName }), fromName: 'FBN Transport' } });
                            } catch { /* non-blocking */ }
                            showModal('manifestDoc', { manifest: man });
                        }
                        showToast?.('Manifest built, depot emailed — loads dispatched.'); setStage('linehaul');
                    } else {
                        const res = await handleCreateTripSheet({ vehicleId, driverId, loadConIds: build.loads.map(l => l.id), branch: build.loads[0].destinationBranch, odometerStart: extra.odometerStart });
                        if (res && res.ok === false) { showToast?.(res.error || 'Could not create trip sheet'); return; }
                        const trip = (res as any)?.value;
                        showToast?.('Trip sheet created — loads out for delivery.');
                        if (trip) showModal('tripSheetDoc', { tripSheet: trip });
                    }
                    setBuild(null); setSel(new Set());
                }} />}
        </div>
    );
};

// ---- small presentational helpers (keep the stages tidy) ----
const ListCard: React.FC<{ title: string; count: number; empty: string; leftFilter?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, count, empty, leftFilter, action, children }) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
                <div className="font-black text-[#13294b] text-sm uppercase tracking-wider">{title} <span className="text-slate-400">({count})</span></div>
                {leftFilter}
            </div>
            {action}
        </div>
        {count === 0 ? <div className="px-4 py-10 text-center text-slate-400 text-sm">{empty}</div> : children}
    </div>
);

const Table: React.FC<{ cols: string[]; children: React.ReactNode }> = ({ cols, children }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                {cols.map((c, i) => <th key={i} className={`py-2 px-2 ${i === 0 ? 'pl-3 w-8' : ''} ${i === cols.length - 1 ? 'text-right pr-3' : ''}`}>{c}</th>)}
            </tr></thead>
            <tbody>{children}</tbody>
        </table>
    </div>
);

const Row: React.FC<{ selected: boolean; onOpen: () => void; children: React.ReactNode }> = ({ selected, onOpen, children }) => (
    <tr onClick={onOpen} className={`border-b border-slate-100 cursor-pointer hover:bg-amber-50/40 ${selected ? 'bg-amber-50' : ''}`}>{children}</tr>
);

const Cell: React.FC<{ children?: React.ReactNode; className?: string; stop?: boolean }> = ({ children, className = '', stop }) => (
    <td className={`py-2 px-2 ${className}`} onClick={stop ? (e => e.stopPropagation()) : undefined}>{children}</td>
);

const RouteCell: React.FC<{ lc: LoadConfirmation }> = ({ lc }) => (
    <td className="py-2 px-2 whitespace-nowrap">
        <span className="font-bold text-slate-700">{code(lc.collectionBranch)}</span>
        <span className="text-slate-300 mx-1">→</span>
        <span className="font-bold text-slate-700">{code(lc.destinationBranch)}</span>
        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{lc.collectionPoint || ''}{lc.deliveryPoint ? ` → ${lc.deliveryPoint}` : ''}</div>
    </td>
);

const Chip: React.FC<{ lc: LoadConfirmation }> = ({ lc }) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
);

// One load as a stacked, tappable card — the mobile equivalent of a table row.
const MobileCard: React.FC<{ lc: LoadConfirmation; selected: boolean; onOpen: () => void; checkbox?: React.ReactNode; client: string; route?: string; place?: string; meta: string; dateLabel: string; overdue?: boolean; unit: string; action: React.ReactNode }> = ({ lc, selected, onOpen, checkbox, client, route, place, meta, dateLabel, overdue, unit, action }) => (
    <div onClick={onOpen} className={`flex gap-2.5 p-3 active:bg-amber-50 ${selected ? 'bg-amber-50' : ''}`}>
        {checkbox && <div className="pt-0.5">{checkbox}</div>}
        <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#13294b]">{lc.loadConNumber}</span>
                <Chip lc={lc} />
            </div>
            <div className="font-bold text-slate-800 truncate">{client}</div>
            {route && <div className="text-xs text-slate-500 truncate">{route}{place ? ` · ${place}` : ''}</div>}
            <div className="flex items-center gap-2 flex-wrap text-[11px] mt-1">
                <span className="font-bold text-slate-700">{meta}</span>
                <span className={overdue ? 'text-red-600 font-bold' : 'text-slate-500'}>{dateLabel}{overdue ? ' ⚠' : ''}</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">🚚 {unit}</div>
            {action && <div className="mt-2" onClick={e => e.stopPropagation()}>{action}</div>}
        </div>
    </div>
);

const ActBtn: React.FC<{ tone: 'emerald' | 'blue'; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ tone, disabled, onClick, children }) => (
    <button onClick={onClick} disabled={disabled} className={`${tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-50 text-white font-bold py-1 px-2.5 rounded-lg text-[11px] uppercase`}>{children}</button>
);

const DateChips: React.FC<{ mode: DateMode; set: (m: DateMode) => void }> = ({ mode, set }) => (
    <div className="flex rounded-lg overflow-hidden border border-slate-300">
        {(['today', 'overdue', 'all'] as DateMode[]).map(m => (
            <button key={m} onClick={() => set(m)} className={`px-2.5 py-1 text-[11px] font-bold uppercase ${mode === m ? 'bg-[#13294b] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{m === 'today' ? 'Today' : m === 'overdue' ? 'Overdue' : 'All open'}</button>
        ))}
    </div>
);

const BuildBtn: React.FC<{ count: number; dest: string; label: string; onClick: () => void; onClear: () => void }> = ({ count, dest, label, onClick, onClear }) => (
    <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-600">{count} selected{dest ? ` → ${dest}` : ''}</span>
        <button onClick={onClick} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-black py-1.5 px-3 rounded-lg text-xs uppercase tracking-wider">{label}</button>
        <button onClick={onClear} className="text-xs text-slate-500 hover:text-slate-700 font-bold">Clear</button>
    </div>
);

// Pick a truck + driver for either a line-haul manifest or a delivery trip sheet.
const AssignUnitPanel: React.FC<{ mode: 'manifest' | 'trip'; loads: LoadConfirmation[]; vehicles: any[]; users: any[]; driverName: (id?: string) => string; onClose: () => void; onAssign: (vehicleId: string, driverId: string, extra: { trailerSize?: string; odometerStart?: number }) => Promise<void> }> = ({ mode, loads, vehicles, users, onClose, onAssign }) => {
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [trailerSize, setTrailerSize] = useState('12m');
    const [odo, setOdo] = useState('');
    const [saving, setSaving] = useState(false);
    const isManifest = mode === 'manifest';
    const origin = loads[0]?.collectionBranch, dest = loads[0]?.destinationBranch;
    // Line-haul = horses; local delivery = any on-road vehicle.
    const trucks = vehicles.filter((v: any) => v.status === 'On the road' && (isManifest ? v.weightCategory === 'Horse' : true));
    const drivers = users.filter((u: any) => ['Staff', 'Driver'].includes(u.role));
    const submit = async () => { if (!vehicleId || !driverId) { alert('Pick a truck and a driver.'); return; } setSaving(true); await onAssign(vehicleId, driverId, { trailerSize: isManifest ? trailerSize : undefined, odometerStart: !isManifest && odo ? Number(odo) : undefined }); setSaving(false); };
    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-3 rounded-t-2xl bg-[#13294b] text-white flex items-center justify-between">
                    <h3 className="font-black text-lg">{isManifest ? 'Build line-haul manifest' : 'Assign delivery trip sheet'}</h3>
                    <span className="text-sm text-white/80">{isManifest ? `${code(origin)} → ${code(dest)}` : `${code(dest)} local`}</span>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{loads.length} {isManifest ? 'load' : 'drop'}{loads.length === 1 ? '' : 's'} on this {isManifest ? 'manifest' : 'trip sheet'}</div>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {loads.map(l => (
                                <div key={l.id} className="px-3 py-1.5 text-sm flex justify-between gap-2">
                                    <span className="font-bold text-[#13294b]">{l.loadConNumber}</span>
                                    <span className="text-slate-500 truncate">{isManifest ? (l.clientName || '') : (l.deliveryPoint || '')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{isManifest ? 'Line-haul truck' : 'Delivery vehicle'}</label>
                            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- Select vehicle --</option>
                                {trucks.map((v: any) => <option key={v.id} value={v.id}>{v.registration} ({v.name})</option>)}
                            </select>
                            {trucks.length === 0 && <div className="text-[11px] text-amber-600 mt-1">No vehicles marked On the road.</div>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Driver</label>
                            <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                <option value="">-- Select driver --</option>
                                {drivers.map((d: any) => <option key={d.email} value={d.email}>{d.name}</option>)}
                            </select>
                        </div>
                        {isManifest ? (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Trailer</label>
                                <select value={trailerSize} onChange={e => setTrailerSize(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                    <option value="6m">6 m</option>
                                    <option value="12m">12 m</option>
                                    <option value="6m + 6m">6 m + 6 m (superlink)</option>
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Odometer start (km)</label>
                                <input value={odo} onChange={e => setOdo(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="e.g. 248500" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{saving ? 'Saving…' : (isManifest ? 'Build & dispatch' : 'Create trip sheet')}</button>
                </div>
            </div>
        </div>
    );
};

export default OperationsDay;
