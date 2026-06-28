import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { STATUS_LABEL, statusChip } from '../../lib/loadStatus';
import DateField from './DateField';

// Pick a transporter (subcontractor) → see every LoadCon given to them, filter by
// date range + free-text search. Totals the buy rate for the period — handy for
// reconciling a carrier's loads / month-end.
const rand = (n?: number) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dOnly = (s?: string) => (s || '').slice(0, 10);
const startOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

const TransporterLoadCons: React.FC = () => {
    const { loadConfirmations = [], suppliers = [], clients = [] } = useOperations() as any;
    const { showModal } = useUIState();

    const [transporter, setTransporter] = useState('');
    const [from, setFrom] = useState(startOfMonth());
    const [to, setTo] = useState('');
    const [q, setQ] = useState('');

    const loads = loadConfirmations as LoadConfirmation[];
    const clientName = (lc: any) => clients.find((c: any) => c.id === lc.clientId)?.name || lc.clientName || '—';

    // Transporters that actually have loads, plus any in the supplier book.
    const transporters = useMemo(() => {
        const fromLoads = loads.map(l => (l as any).subcontractorName).filter(Boolean);
        const fromBook = (suppliers as any[]).filter(s => s.type === 'Transport').map(s => s.name).filter(Boolean);
        return [...new Set([...fromLoads, ...fromBook])].sort((a, b) => String(a).localeCompare(String(b)));
    }, [loads, suppliers]);

    const rows = useMemo(() => {
        const term = q.trim().toLowerCase();
        const t = transporter.trim().toLowerCase();
        return loads.filter(l => {
            const sub = ((l as any).subcontractorName || '').toLowerCase();
            if (!sub) return false;
            if (t && sub !== t) return false;
            const d = dOnly(l.collectionDate || (l as any).date);
            if (from && d && d < from) return false;
            if (to && d && d > to) return false;
            if (term) {
                const hay = `${l.loadConNumber} ${(l as any).loadRefNo || ''} ${clientName(l)} ${l.route || ''} ${l.collectionPoint || ''} ${l.deliveryPoint || ''} ${sub}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        }).sort((a, b) => (b.collectionDate || '').localeCompare(a.collectionDate || ''));
    }, [loads, transporter, from, to, q]);

    const totalBuy = useMemo(() => rows.reduce((s, l) => s + (Number((l as any).supplierRate) || 0), 0), [rows]);
    const fmtD = (s?: string) => { if (!s) return '—'; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' }); };

    const inp = 'bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800';

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-xl font-bold text-slate-900">LoadCons by Transporter</h3>
                <p className="text-xs text-slate-500">Pick a transporter and date range to see every LoadCon given to them.</p>
            </div>

            <div className="flex gap-2 flex-wrap items-end bg-white border border-slate-200 rounded-xl p-3">
                <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transporter
                    <input list="transporterList" value={transporter} onChange={e => setTransporter(e.target.value)} className={`${inp} w-56`} placeholder="all transporters" />
                    <datalist id="transporterList">{transporters.map(t => <option key={t as string} value={t as string} />)}</datalist>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">From
                    <DateField value={from} onChange={v => setFrom(v)} className={inp} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">To
                    <DateField value={to} onChange={v => setTo(v)} className={inp} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex-1 min-w-[160px]">Search
                    <input value={q} onChange={e => setQ(e.target.value)} className={`${inp} w-full`} placeholder="load no, waybill, client, route…" />
                </label>
                {(transporter || q || to) && <button onClick={() => { setTransporter(''); setQ(''); setTo(''); setFrom(startOfMonth()); }} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2">Reset</button>}
            </div>

            <div className="flex gap-3">
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-2"><span className="text-2xl font-black text-slate-900">{rows.length}</span> <span className="text-xs text-slate-500">loads</span></div>
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-2"><span className="text-2xl font-black text-amber-700">{rand(totalBuy)}</span> <span className="text-xs text-slate-500">total buy</span></div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr><th className="p-2">Load No</th><th className="p-2">FBN DI</th><th className="p-2">Date</th><th className="p-2">Transporter</th><th className="p-2">Client</th><th className="p-2">Route</th><th className="p-2 text-right">Buy</th><th className="p-2 text-center">Status</th></tr>
                    </thead>
                    <tbody>
                        {rows.map(l => (
                            <tr key={l.id} onClick={() => showModal('loadDetail', { loadCon: l })} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                                <td className="p-2 font-mono font-semibold text-slate-900">{l.loadConNumber}</td>
                                <td className="p-2 font-mono text-slate-600">{(l as any).loadRefNo || '—'}</td>
                                <td className="p-2">{fmtD(l.collectionDate)}</td>
                                <td className="p-2">{(l as any).subcontractorName || '—'}</td>
                                <td className="p-2">{clientName(l)}</td>
                                <td className="p-2 text-slate-500 truncate max-w-[220px]">{l.route || `${l.collectionPoint || ''} → ${l.deliveryPoint || ''}`}</td>
                                <td className="p-2 text-right font-mono">{rand((l as any).supplierRate)}</td>
                                <td className="p-2 text-center"><span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${statusChip(l.status)}`}>{STATUS_LABEL[l.status]}</span></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No loads for this filter.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransporterLoadCons;
