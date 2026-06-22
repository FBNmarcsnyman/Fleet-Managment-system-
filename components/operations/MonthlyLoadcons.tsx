import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { STATUS_LABEL, statusChip } from '../../lib/loadStatus';

// A month-by-month list of LoadCons done — for billing & reconciliation.
// Pick a month → every load with client, route, subbie, sell/buy/margin, status.
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const rand = (n?: number) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MonthlyLoadcons: React.FC = () => {
    const { loadConfirmations = [], clients = [] } = useOperations() as any;
    const { showModal } = useUIState();
    const [month, setMonth] = useState<string>(monthKey(new Date()));
    const [branch, setBranch] = useState('All');
    const [client, setClient] = useState('All');
    const [transporter, setTransporter] = useState('All');
    const [routeQ, setRouteQ] = useState('');

    const loads = loadConfirmations as LoadConfirmation[];
    const clientName = (lc: any) => clients.find((c: any) => c.id === lc.clientId)?.name || lc.clientName || '—';

    // Months that actually have loads, newest first.
    const months = useMemo(() => {
        const set = new Set<string>();
        loads.forEach(l => { const d = (l.collectionDate || (l as any).date || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(d)) set.add(d); });
        return [...set].sort().reverse();
    }, [loads]);

    // All loads in the chosen month (before the branch/client/etc. filters).
    const monthRows = useMemo(() => loads
        .filter(l => ((l.collectionDate || (l as any).date || '').slice(0, 7)) === month)
        .sort((a, b) => (a.collectionDate || '').localeCompare(b.collectionDate || '')), [loads, month]);

    // Filter option lists come from the month's loads so they're always relevant.
    const branches = useMemo(() => ['All', ...new Set(monthRows.map(l => (l as any).arrangingBranch).filter(Boolean))].sort(), [monthRows]);
    const clientOpts = useMemo(() => ['All', ...new Set(monthRows.map(l => clientName(l)).filter(v => v && v !== '—'))].sort(), [monthRows]);
    const transporterOpts = useMemo(() => ['All', ...new Set(monthRows.map(l => (l as any).subcontractorName).filter(Boolean))].sort(), [monthRows]);

    const rows = useMemo(() => {
        const rq = routeQ.trim().toLowerCase();
        return monthRows.filter(l => {
            if (branch !== 'All' && (l as any).arrangingBranch !== branch) return false;
            if (client !== 'All' && clientName(l) !== client) return false;
            if (transporter !== 'All' && (l as any).subcontractorName !== transporter) return false;
            if (rq) { const hay = `${l.route || ''} ${l.collectionPoint || ''} ${l.deliveryPoint || ''}`.toLowerCase(); if (!hay.includes(rq)) return false; }
            return true;
        });
    }, [monthRows, branch, client, transporter, routeQ]);

    const totals = useMemo(() => {
        const sell = rows.reduce((s, l) => s + (l.totalAmount || 0), 0);
        const buy = rows.reduce((s, l) => s + ((l as any).supplierRate || 0), 0);
        return { sell, buy, margin: sell - buy };
    }, [rows]);

    const fmtD = (s?: string) => { if (!s) return '—'; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); };

    const printSheet = () => {
        const head = ['Load No', 'Date', 'Client', 'Route', 'Subbie', 'Sell', 'Buy', 'Margin', 'Status'];
        const body = rows.map(l => [l.loadConNumber, fmtD(l.collectionDate), clientName(l), l.route || `${l.collectionPoint || ''} → ${l.deliveryPoint || ''}`, (l as any).subcontractorName || '', rand(l.totalAmount), rand((l as any).supplierRate), rand((l.totalAmount || 0) - ((l as any).supplierRate || 0)), STATUS_LABEL[l.status]]);
        const win = window.open('', '_blank'); if (!win) return;
        const tr = (cells: string[], th = false) => `<tr>${cells.map(c => `<${th ? 'th' : 'td'} style="border:1px solid #ccc;padding:4px 8px;font-size:11px;text-align:left">${c}</${th ? 'th' : 'td'}>`).join('')}</tr>`;
        win.document.write(`<html><head><title>FBN LoadCons — ${month}</title></head><body style="font-family:Arial,sans-serif">
            <h2 style="color:#13294b">FBN LoadCons — ${month}</h2>
            <p>Total: ${rows.length} loads · Sell ${rand(totals.sell)} · Buy ${rand(totals.buy)} · Margin ${rand(totals.margin)}</p>
            <table style="border-collapse:collapse;width:100%">${tr(head, true)}${body.map(b => tr(b)).join('')}</table>
            <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
        win.document.close();
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">LoadCons by Month</h3>
                    <p className="text-xs text-slate-500">Every load done in the month — for billing & reconciliation.</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={month} onChange={e => setMonth(e.target.value)} className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm">
                        {(months.includes(month) ? months : [month, ...months]).map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}</option>)}
                    </select>
                    <button onClick={printSheet} disabled={!rows.length} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm">Print / PDF</button>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center bg-white border border-slate-200 rounded-xl p-3">
                <select value={branch} onChange={e => setBranch(e.target.value)} className="bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-700">{branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>)}</select>
                <select value={client} onChange={e => setClient(e.target.value)} className="bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-700 max-w-[200px]">{clientOpts.map(c => <option key={c} value={c}>{c === 'All' ? 'All clients' : c}</option>)}</select>
                <select value={transporter} onChange={e => setTransporter(e.target.value)} className="bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-700 max-w-[200px]">{transporterOpts.map(t => <option key={t} value={t}>{t === 'All' ? 'All transporters' : t}</option>)}</select>
                <input value={routeQ} onChange={e => setRouteQ(e.target.value)} placeholder="Route / origin / destination…" className="bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-700 flex-1 min-w-[160px]" />
                {(branch !== 'All' || client !== 'All' || transporter !== 'All' || routeQ) && <button onClick={() => { setBranch('All'); setClient('All'); setTransporter('All'); setRouteQ(''); }} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2">Reset</button>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-2xl font-black text-slate-900">{rows.length}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Loads</div></div>
                <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-2xl font-black text-blue-700">{rand(totals.sell)}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Sell</div></div>
                <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-2xl font-black text-amber-700">{rand(totals.buy)}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Buy</div></div>
                <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-2xl font-black text-emerald-700">{rand(totals.margin)}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Margin</div></div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr><th className="p-2">Load No</th><th className="p-2">Date</th><th className="p-2">Client</th><th className="p-2">Route</th><th className="p-2">Subbie</th><th className="p-2 text-right">Sell</th><th className="p-2 text-right">Margin</th><th className="p-2 text-center">Status</th></tr>
                    </thead>
                    <tbody>
                        {rows.map(l => (
                            <tr key={l.id} onClick={() => showModal('loadDetail', { loadCon: l })} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                                <td className="p-2 font-mono font-semibold text-slate-900">{l.loadConNumber}</td>
                                <td className="p-2">{fmtD(l.collectionDate)}</td>
                                <td className="p-2">{clientName(l)}</td>
                                <td className="p-2 text-slate-500 truncate max-w-[200px]">{l.route || `${l.collectionPoint || ''} → ${l.deliveryPoint || ''}`}</td>
                                <td className="p-2">{(l as any).subcontractorName || '—'}</td>
                                <td className="p-2 text-right font-mono">{rand(l.totalAmount)}</td>
                                <td className="p-2 text-right font-mono text-emerald-700">{rand((l.totalAmount || 0) - ((l as any).supplierRate || 0))}</td>
                                <td className="p-2 text-center"><span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${statusChip(l.status)}`}>{STATUS_LABEL[l.status]}</span></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No loads in this month.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MonthlyLoadcons;
