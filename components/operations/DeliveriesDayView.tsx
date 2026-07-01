import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState, useAuth } from '../../contexts/AppContexts';
import { requestPodInteractive } from '../../lib/podRequest';
import { driveViewUrl } from '../../lib/driveView';

// Delivered / POD — a day-by-day checklist instead of one giant column. Loads are
// grouped by delivery date (newest first), each day collapsible with an
// outstanding-POD count, compact one-line rows, and a one-tap Get POD.
const dOnly = (s?: string) => (s || '').slice(0, 10);
// POD is outstanding only when one is actually EXPECTED (pod_required !== false).
// A transfer / crane / non-delivery leg is marked pod_required=false and never chased.
const podOut = (lc: LoadConfirmation) => lc.status === 'Delivered' && !(lc as any).podPhoto && (lc as any).podRequired !== false;
// Brokered = a subbie is doing it (name OR supplier_id — never supplier_id alone, see
// the brokered-load-visibility rule). Own-fleet = an FBN truck, no subcontractor.
const isBrokered = (lc: any) => !!(lc.subcontractorName || lc.supplierId);

type Lens = 'all' | 'brokered' | 'ownfleet';

const DeliveriesDayView: React.FC<{ lens?: Lens }> = ({ lens: initialLens = 'all' }) => {
    const { loadConfirmations = [], clients = [], suppliers = [], handleUpdateLoadConfirmation, handleUpdateSupplier } = useOperations() as any;
    const { showModal, showToast } = useUIState();
    const { currentUser } = useAuth();
    const [reqBusy, setReqBusy] = useState<string | null>(null);
    const [scope, setScope] = useState<'week' | 'all' | 'podout'>('week');
    const [lens, setLens] = useState<Lens>(initialLens);
    const [q, setQ] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const clientName = (lc: any) => clients.find((c: any) => c.id === lc.clientId)?.name || lc.clientName || '—';
    const supplierMap = useMemo(() => new Map((suppliers as any[]).map(s => [s.id, s.name])), [suppliers]);
    const transporterOf = (lc: any) => supplierMap.get(lc.supplierId) || lc.subcontractorName || '';

    const loads = loadConfirmations as LoadConfirmation[];
    const today = new Date(); const weekAgo = new Date(today.getTime() - 13 * 86400000).toISOString().slice(0, 10);

    const days = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const rel = loads.filter(l => {
            if (!['Delivered', 'POD Submitted'].includes(l.status)) return false;
            if (lens === 'brokered' && !isBrokered(l)) return false;
            if (lens === 'ownfleet' && isBrokered(l)) return false;
            if (scope === 'podout' && !podOut(l)) return false;
            const dd = dOnly((l as any).deliveryDate) || dOnly(l.collectionDate);
            if (scope === 'week' && dd && dd < weekAgo) return false;
            if (needle) {
                const hay = `${l.loadConNumber} ${clientName(l)} ${l.route || ''} ${l.collectionPoint || ''} ${l.deliveryPoint || ''} ${transporterOf(l)}`.toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        });
        const map = new Map<string, LoadConfirmation[]>();
        rel.forEach(l => { const k = dOnly((l as any).deliveryDate) || dOnly(l.collectionDate) || 'No date'; map.set(k, [...(map.get(k) || []), l]); });
        return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    }, [loads, scope, lens, q, clients, suppliers]);

    const totalOut = useMemo(() => loads.filter(l => podOut(l) && (lens === 'all' || (lens === 'brokered' ? isBrokered(l) : !isBrokered(l)))).length, [loads, lens]);

    const getPod = (lc: LoadConfirmation) => showModal('pod', {
        loadCon: lc, isManualUpload: true,
        onSubmit: (loadConId: string, podData: any) => handleUpdateLoadConfirmation(loadConId, { podPhoto: podData.photo, podSignature: podData.signature, podAnalysis: podData.analysisResult, status: 'POD Submitted', paymentStatus: 'Awaiting POD' }),
        onCancel: () => showModal('hide'),
    });

    // Email the SUBCONTRACTOR on the load to upload the signed POD (link opens the
    // public upload page). They upload -> submit-pod HOLDS it for admin authorisation
    // before it ever reaches the client (see the POD authorisation rule). loadcons@ CC'd.
    const requestPod = async (lc: any) => {
        setReqBusy(lc.id);
        await requestPodInteractive({
            lc, suppliers, requestedBy: currentUser?.name || currentUser?.email || 'Staff',
            updateLoad: handleUpdateLoadConfirmation, updateSupplier: handleUpdateSupplier, toast: showToast,
        });
        setReqBusy(null);
    };

    const dayLabel = (k: string) => {
        if (k === 'No date') return 'No delivery date';
        const d = new Date(k); const t = new Date(); const yest = new Date(t.getTime() - 86400000);
        if (k === t.toISOString().slice(0, 10)) return 'Today';
        if (k === yest.toISOString().slice(0, 10)) return 'Yesterday';
        return d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short' });
    };
    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-md ${active ? 'bg-[#13294b] text-white' : 'text-slate-600 hover:bg-white'}`;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Deliveries / POD — Day View</h3>
                    <p className="text-xs text-slate-500">{totalOut} POD{totalOut !== 1 ? 's' : ''} still outstanding. Work through them by day.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-40" />
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg" title="Brokered = subbie did it · Own-fleet = FBN truck">
                        <button onClick={() => setLens('all')} className={chip(lens === 'all')}>All</button>
                        <button onClick={() => setLens('brokered')} className={chip(lens === 'brokered')}>Brokered</button>
                        <button onClick={() => setLens('ownfleet')} className={chip(lens === 'ownfleet')}>Own-fleet</button>
                    </div>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setScope('week')} className={chip(scope === 'week')}>Last 2 weeks</button>
                        <button onClick={() => setScope('podout')} className={chip(scope === 'podout')}>POD outstanding</button>
                        <button onClick={() => setScope('all')} className={chip(scope === 'all')}>All</button>
                    </div>
                </div>
            </div>

            {days.length === 0 && <p className="text-center text-slate-400 py-12">Nothing here.</p>}

            <div className="space-y-3">
                {days.map(([day, list]) => {
                    const out = list.filter(podOut).length;
                    const isCollapsed = collapsed[day];
                    return (
                        <div key={day} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <button onClick={() => setCollapsed(p => ({ ...p, [day]: !p[day] }))} className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-200">
                                <span className="font-black text-[#13294b] text-sm">{isCollapsed ? '▶' : '▼'} {dayLabel(day)} <span className="text-slate-400 font-semibold">· {list.length}</span></span>
                                {out > 0 ? <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase">{out} POD due</span> : <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">all PODs in</span>}
                            </button>
                            {!isCollapsed && (
                                <div className="divide-y divide-slate-100">
                                    {list.map(l => {
                                        const out = podOut(l);
                                        const podLink = (l as any).podDriveUrl || (l as any).podPhoto?.data || ((l as any).podDocUrls || [])[0] || '';
                                        return (
                                            <div key={l.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                                                <button onClick={() => showModal('loadDetail', { loadCon: l })} className="flex-1 min-w-0 text-left flex items-center gap-2">
                                                    <span className="font-mono font-bold text-blue-600 text-sm shrink-0">{l.loadConNumber}</span>
                                                    <span className="font-semibold text-slate-800 text-sm truncate">{clientName(l)}</span>
                                                    <span className="text-[11px] text-slate-400 truncate hidden sm:inline">{l.collectionPoint} → {l.deliveryPoint}</span>
                                                    {transporterOf(l) && <span className="text-[11px] text-slate-500 truncate hidden md:inline">· {transporterOf(l)}</span>}
                                                </button>
                                                <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded uppercase ${out ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{out ? 'POD due' : 'POD in'}</span>
                                                {(l as any).podRequestedAt && (() => {
                                                    const cnt = Number((l as any).podRequestCount || 1);
                                                    const at = new Date((l as any).podRequestedAt);
                                                    const by = (l as any).podRequestedBy || '';
                                                    const dShort = at.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
                                                    return (
                                                        <span className="shrink-0 text-[10px] font-semibold text-emerald-700 hidden md:inline-flex items-center gap-1"
                                                            title={`Last POD request: ${at.toLocaleString('en-ZA')}${by ? ` — by ${by}` : ''}${cnt > 1 ? ` · ${cnt} requests sent in total` : ''}`}>
                                                            ✓ Requested {dShort}{cnt > 1 && <span className="text-amber-600">·{cnt}x</span>}
                                                        </span>
                                                    );
                                                })()}
                                                {out && (l as any).subcontractorName && <button onClick={() => requestPod(l)} disabled={reqBusy === l.id} title="Email the subcontractor to upload the signed POD" className="shrink-0 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-1 px-2.5 rounded-lg">{reqBusy === l.id ? '…' : '✉ Request POD'}</button>}
                                                {!out && podLink && <a href={driveViewUrl(podLink)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="View the POD on file" className="shrink-0 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-1 px-2.5 rounded-lg">View POD</a>}
                                                {out && <button onClick={() => getPod(l)} title="Upload the POD yourself" className="shrink-0 text-[11px] font-bold bg-[#13294b] hover:bg-[#1d3a66] text-white py-1 px-2.5 rounded-lg">Get POD</button>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DeliveriesDayView;
