import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { uploadFile } from '../../lib/supabase';
import { Supplier, RfqRequest, ComplianceDoc } from '../../types';

// Subcontractor portal home. Pulls the carrier's own RFQs, active loads and
// compliance certs into one glance. Posted-loads (Load Board) and outstanding
// invoices tiles are placeholders until those phases ship.
interface Props {
    supplier: Supplier;
    onNavigate: (view: string) => void;
}

// Loads that count as "in progress" (anything before it's delivered/closed).
const TERMINAL = ['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled', 'Completed'];

// Live countdown to a deadline → "2d 4h", "3h 12m", "8m 40s", or "closed".
const fmtCountdown = (iso: string | undefined, now: number): { text: string; urgent: boolean; over: boolean } => {
    if (!iso) return { text: 'no deadline', urgent: false, over: false };
    const ms = new Date(iso).getTime() - now;
    if (isNaN(ms)) return { text: '—', urgent: false, over: false };
    if (ms <= 0) return { text: 'closed', urgent: false, over: true };
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
    return { text, urgent: ms < 3600_000, over: false };
};

// Compliance traffic light from an expiry date.
const certState = (d: ComplianceDoc, now: number): { tone: 'green' | 'amber' | 'red'; label: string; days: number | null } => {
    if (!d.expiryDate) return { tone: 'amber', label: 'no expiry on file', days: null };
    const days = Math.ceil((new Date(d.expiryDate).getTime() - now) / 86400000);
    if (isNaN(days)) return { tone: 'amber', label: 'no expiry on file', days: null };
    if (days < 0) return { tone: 'red', label: `expired ${Math.abs(days)}d ago`, days };
    if (days <= 30) return { tone: 'amber', label: `${days}d to expiry`, days };
    return { tone: 'green', label: `${days}d to expiry`, days };
};

const toneDot: Record<string, string> = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-red-500' };
const toneText: Record<string, string> = { green: 'text-emerald-300', amber: 'text-amber-300', red: 'text-red-300' };

const SupplierDashboard: React.FC<Props> = ({ supplier, onNavigate }) => {
    const { loadConfirmations = [], rfqRequests = [], subcontractorInvoices = [], handleUpdateLoadConfirmation } = useOperations() as any;
    const { showToast } = useUIState();
    const [now, setNow] = useState(() => Date.now());
    // Tick the countdowns once a second (cheap — this screen is small).
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

    const sid = supplier.id;

    const myLoads = useMemo(() => (loadConfirmations || []).filter((l: any) => l.supplierId === sid), [loadConfirmations, sid]);
    const activeLoads = useMemo(() => myLoads.filter((l: any) => !l.archived && !TERMINAL.includes(l.status)), [myLoads]);
    // Delivered loads still missing a POD — the carrier owes us the proof of delivery.
    const outstandingPods = useMemo(() => myLoads.filter((l: any) => !l.podPhoto && l.status === 'Delivered'), [myLoads]);
    // Invoices not yet paid (Submitted / Approved / Queried).
    const outstandingInvoices = useMemo(() => (subcontractorInvoices || []).filter((i: any) => i.supplierId === sid && i.status !== 'Paid'), [subcontractorInvoices, sid]);

    // POD upload — same flow as My Loads (upload to driver-docs, mark POD Submitted / Awaiting Review).
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const podForId = useRef<string | null>(null);
    const startPodUpload = (id: string) => { podForId.current = id; fileRef.current?.click(); };
    const onPodFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; const id = podForId.current; e.target.value = '';
        if (!file || !id) return;
        setUploadingId(id);
        try {
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const up = await uploadFile('driver-docs', `pods/${id}_${Date.now()}_${safe}`, file);
            if (up.error || !up.url) { showToast(`POD upload failed: ${up.error || 'unknown error'}`); return; }
            const res = await handleUpdateLoadConfirmation(id, { podPhoto: { name: file.name, type: file.type, data: up.url }, status: 'POD Submitted', paymentStatus: 'Awaiting Review' });
            if (res && res.ok === false) { showToast(`Could not save POD: ${res.error}`); return; }
            showToast('POD submitted — thank you!');
        } catch (err) {
            showToast(`POD upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
        } finally { setUploadingId(null); podForId.current = null; }
    };

    const openRfqs = useMemo(() => (rfqRequests as RfqRequest[])
        .filter(r => r.status === 'Open'
            && r.recipients?.some(rec => rec.supplierId === sid)
            && !r.quotes?.some(q => q.supplierId === sid))
        .sort((a, b) => new Date(a.closesAt || 0).getTime() - new Date(b.closesAt || 0).getTime()),
    [rfqRequests, sid]);

    const certs = supplier.complianceDocs || [];
    const certRows = useMemo(() => certs.map(c => ({ doc: c, st: certState(c, now) })), [certs, now]);
    const hasGit = certs.some(c => c.type === 'GIT');
    const worst = certRows.reduce<'green' | 'amber' | 'red'>((acc, r) => {
        if (acc === 'red' || r.st.tone === 'red') return 'red';
        if (acc === 'amber' || r.st.tone === 'amber') return 'amber';
        return 'green';
    }, certRows.length ? 'green' : 'amber');
    const overall = !hasGit ? 'red' : worst;

    const kpi = (label: string, value: React.ReactNode, sub: string, onClick?: () => void, accent = 'text-white') => (
        <button onClick={onClick} disabled={!onClick}
            className={`text-left bg-[#111827] border border-white/5 rounded-2xl p-5 ${onClick ? 'hover:border-brand-primary/40 transition-all' : 'opacity-90 cursor-default'}`}>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-3xl font-black ${accent}`}>{value}</p>
            <p className="text-[11px] text-gray-500 mt-1">{sub}</p>
        </button>
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Welcome, {supplier.name}</h1>
                <p className="text-gray-500 text-sm mt-1">Your carrier dashboard — RFQs, loads and compliance at a glance.</p>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {kpi('Open RFQs', openRfqs.length, openRfqs.length ? 'awaiting your quote' : 'none right now', () => onNavigate('rfqs'), 'text-emerald-300')}
                {kpi('Active loads', activeLoads.length, 'in progress', () => onNavigate('loads'), 'text-blue-300')}
                {kpi('Outstanding PODs', outstandingPods.length, outstandingPods.length ? 'delivered — POD due' : 'all up to date', () => onNavigate('loads'), outstandingPods.length ? 'text-amber-300' : 'text-white')}
                {kpi('Posted to network', 0, 'Load Board — coming soon', undefined, 'text-gray-500')}
                {kpi('Compliance', <span className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${toneDot[overall]}`} />{overall === 'green' ? 'OK' : overall === 'amber' ? 'Check' : 'Action'}</span>, overall === 'red' ? 'needs attention' : overall === 'amber' ? 'expiring soon' : 'all valid', () => onNavigate('compliance'), toneText[overall])}
                {kpi('Outstanding invoices', outstandingInvoices.length, outstandingInvoices.length ? 'awaiting payment/approval' : 'all settled', () => onNavigate('invoicing'), outstandingInvoices.length ? 'text-amber-300' : 'text-white')}
            </div>

            {/* Outstanding PODs — upload right here */}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onPodFile} />
            {outstandingPods.length > 0 && (
                <section className="bg-[#111827] border border-amber-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-black text-amber-300 uppercase tracking-widest">Outstanding PODs ({outstandingPods.length})</h2>
                        <button onClick={() => onNavigate('loads')} className="text-xs font-bold text-brand-secondary hover:text-blue-300">My Loads →</button>
                    </div>
                    <div className="space-y-2">
                        {outstandingPods.map((l: any) => (
                            <div key={l.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl p-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-white text-sm truncate">{l.loadConNumber || l.loadRefNo || '—'}</p>
                                    <p className="text-[11px] text-gray-500 truncate">{l.collectionPoint} → {l.deliveryPoint}{l.deliveryDate ? ` · delivered ${new Date(l.deliveryDate).toLocaleDateString('en-ZA')}` : ''}</p>
                                </div>
                                <button onClick={() => startPodUpload(l.id)} disabled={uploadingId === l.id} className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-lg disabled:opacity-50">
                                    {uploadingId === l.id ? 'Uploading…' : 'Upload POD'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Open RFQs with countdown */}
            <section className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Open RFQs awaiting your quote</h2>
                    {openRfqs.length > 0 && <button onClick={() => onNavigate('rfqs')} className="text-xs font-bold text-brand-secondary hover:text-blue-300">Go to RFQ board →</button>}
                </div>
                {openRfqs.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">No open RFQs awaiting your quote.</p>
                ) : (
                    <div className="space-y-2">
                        {openRfqs.slice(0, 6).map(r => {
                            const cd = fmtCountdown(r.closesAt, now);
                            return (
                                <button key={r.id} onClick={() => onNavigate('rfqs')} className="w-full text-left flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-all">
                                    <div className="min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{r.origin} → {r.destination}</p>
                                        <p className="text-[11px] text-gray-500 truncate">{[r.loadType, r.commodity, r.weightKg ? `${r.weightKg.toLocaleString()}kg` : '', r.collectionDate ? `collect ${new Date(r.collectionDate).toLocaleDateString('en-ZA')}` : ''].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-lg ${cd.over ? 'bg-gray-700 text-gray-400' : cd.urgent ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                                        {cd.over ? 'closed' : `⏳ ${cd.text}`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active loads */}
                <section className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Active loads</h2>
                        <button onClick={() => onNavigate('loads')} className="text-xs font-bold text-brand-secondary hover:text-blue-300">All loads →</button>
                    </div>
                    {activeLoads.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6 text-center">No active loads right now.</p>
                    ) : (
                        <div className="space-y-2">
                            {activeLoads.slice(0, 6).map((l: any) => (
                                <button key={l.id} onClick={() => onNavigate('loads')} className="w-full text-left flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition-all">
                                    <div className="min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{l.loadConNumber || l.loadRefNo || '—'}</p>
                                        <p className="text-[11px] text-gray-500 truncate">{l.collectionPoint} → {l.deliveryPoint}</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300">{l.status}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {/* Compliance */}
                <section className="bg-[#111827] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Compliance certificates</h2>
                        <button onClick={() => onNavigate('compliance')} className="text-xs font-bold text-brand-secondary hover:text-blue-300">Manage →</button>
                    </div>
                    {!hasGit && (
                        <div className="mb-3 flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-lg p-2.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <p className="text-[11px] text-red-300 font-bold">No GIT certificate on file — required to receive RFQs.</p>
                        </div>
                    )}
                    {certRows.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6 text-center">No certificates uploaded yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {certRows.map(({ doc, st }) => (
                                <div key={doc.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl p-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${toneDot[st.tone]}`} />
                                        <span className="font-bold text-white text-sm truncate">{doc.type}</span>
                                    </div>
                                    <span className={`shrink-0 text-[11px] font-bold ${toneText[st.tone]}`}>{st.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default SupplierDashboard;
