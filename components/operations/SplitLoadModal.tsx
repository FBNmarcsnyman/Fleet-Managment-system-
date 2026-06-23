import React, { useMemo, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { sendGroupLoadConToSupplier } from '../../lib/loadEmails';
import { money } from '../../lib/format';

// SPLIT ACROSS TRANSPORTERS
// One client waybill / invoice carried by several trucks run by different subbies.
// Truck 1 is the existing (primary) load and keeps the client charge + single
// invoice; each extra truck becomes its own loadcon (cost only) under the same
// waybill group. Each subbie gets ONE loadcon listing their vehicle(s); the
// client is then updated per vehicle as each loads / moves.
type Alloc = { subcontractorName: string; subcontractorEmail: string; forAttention: string; supplierRate: string; packages: string; weightKg: string };

const blank = (): Alloc => ({ subcontractorName: '', subcontractorEmail: '', forAttention: '', supplierRate: '', packages: '', weightKg: '' });

const SplitLoadModal: React.FC = () => {
    const { modal, hideModal, showToast } = useUIState();
    const { suppliers = [], handleSplitLoad } = useOperations() as any;
    const lc = modal.payload?.loadCon;
    const [sending, setSending] = useState(false);
    const [sendNow, setSendNow] = useState(true);

    const supByName = useMemo(() => new Map<string, any>((suppliers as any[]).map(s => [(s.name || '').toLowerCase(), s])), [suppliers]);

    // Truck 1 pre-filled from the existing load's transporter (if any).
    const [rows, setRows] = useState<Alloc[]>(() => [{
        subcontractorName: lc?.subcontractorName || '', subcontractorEmail: lc?.subcontractorEmail || '', forAttention: lc?.forAttention || '',
        supplierRate: lc?.supplierRate != null ? String(lc.supplierRate) : '', packages: lc?.loadedPackages != null ? String(lc.loadedPackages) : '', weightKg: lc?.weightKg != null ? String(lc.weightKg) : '',
    }, blank()]);

    if (!lc) return null;

    const set = (i: number, patch: Partial<Alloc>) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
    const onName = (i: number, name: string) => {
        const sup = supByName.get(name.trim().toLowerCase());
        const patch: Partial<Alloc> = { subcontractorName: name };
        if (sup) { if (!rows[i].subcontractorEmail) patch.subcontractorEmail = sup.contactEmail || ''; if (!rows[i].forAttention) patch.forAttention = sup.contactPerson || ''; }
        set(i, patch);
    };
    const addRow = () => setRows(rs => [...rs, blank()]);
    const removeRow = (i: number) => setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs);

    const filled = rows.filter(r => r.subcontractorName.trim());
    const totalCost = filled.reduce((s, r) => s + (parseFloat(r.supplierRate) || 0), 0);
    const clientCharge = Number(lc.totalAmount) || 0;
    const margin = clientCharge - totalCost;
    const marginPct = clientCharge ? (margin / clientCharge) * 100 : 0;

    const submit = async () => {
        const allocs = rows.filter(r => r.subcontractorName.trim());
        if (allocs.length < 1) { alert('Add at least one transporter (truck 1).'); return; }
        if (sendNow && allocs.some(r => !r.subcontractorEmail.trim())) {
            if (!window.confirm('Some transporters have no email — their loadcon can’t be sent. Save the split anyway and send the rest?')) return;
        }
        if (margin < 0 && !window.confirm(`Total transporter cost (${money(totalCost)}) is MORE than the client charge (${money(clientCharge)}) — a loss. Continue?`)) return;
        setSending(true);
        const res = await handleSplitLoad(lc.id, allocs);
        if (!res?.ok) { showToast(`Split failed: ${res?.error || 'unknown'}`); setSending(false); return; }
        const loads: any[] = res.value?.loads || [];
        if (sendNow) {
            const byEmail = new Map<string, any[]>();
            loads.forEach(l => { const e = (l.subcontractorEmail || '').toLowerCase(); if (!e) return; if (!byEmail.has(e)) byEmail.set(e, []); byEmail.get(e)!.push(l); });
            let sent = 0, failed = 0;
            for (const [email, group] of byEmail) { const r = await sendGroupLoadConToSupplier(group, email); r.ok ? sent++ : failed++; }
            showToast(`Split into ${loads.length} trucks · loadcons sent to ${sent} subbie${sent !== 1 ? 's' : ''}${failed ? ` (${failed} failed)` : ''}.`);
        } else {
            showToast(`Split into ${loads.length} trucks. Send loadcons from the Broking board when ready.`);
        }
        setSending(false);
        hideModal();
    };

    const inp = 'w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';

    return (
        <div className="text-slate-800">
            <div className="mb-3">
                <h2 className="text-xl font-black text-[#13294b]">Split across transporters</h2>
                <p className="text-xs text-slate-500">Waybill <strong>{lc.loadRefNo || lc.loadConNumber}</strong> · {lc.collectionPoint} → {lc.deliveryPoint} · {lc.clientName || ''} — one invoice, several trucks. Each subbie gets one loadcon for their vehicle(s); the client is updated per vehicle.</p>
            </div>

            <datalist id="split-subbies">{(suppliers as any[]).map(s => <option key={s.id} value={s.name} />)}</datalist>

            <div className="space-y-2">
                {rows.map((r, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-[#13294b]">🚚 Truck {i + 1}{i === 0 ? ' (this load)' : ''}</span>
                            {i > 0 && <button onClick={() => removeRow(i)} className="text-rose-500 hover:text-rose-600 text-xs font-bold">Remove</button>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <div className="lg:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Transporter</label>
                                <input list="split-subbies" value={r.subcontractorName} onChange={e => onName(i, e.target.value)} placeholder="Subbie name" className={inp} />
                            </div>
                            <div className="lg:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Their email</label>
                                <input value={r.subcontractorEmail} onChange={e => set(i, { subcontractorEmail: e.target.value })} placeholder="loadcon goes here" className={inp} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Attention</label>
                                <input value={r.forAttention} onChange={e => set(i, { forAttention: e.target.value })} placeholder="Contact" className={inp} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Rate (cost)</label>
                                <input value={r.supplierRate} onChange={e => set(i, { supplierRate: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="R" className={inp} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Packages</label>
                                <input value={r.packages} onChange={e => set(i, { packages: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" placeholder="pkgs" className={inp} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Weight (kg)</label>
                                <input value={r.weightKg} onChange={e => set(i, { weightKg: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="kg" className={inp} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={addRow} className="mt-2 text-sm font-bold text-[#13294b] border border-dashed border-slate-300 hover:border-[#13294b] rounded-lg px-3 py-2 w-full">+ Add another truck</button>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[10px] font-bold text-slate-500 uppercase">Client charge</div><div className="text-lg font-black text-slate-900">{money(clientCharge)}</div></div>
                <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="text-[10px] font-bold text-slate-500 uppercase">Total cost ({filled.length})</div><div className="text-lg font-black text-amber-600">{money(totalCost)}</div></div>
                <div className={`rounded-xl p-3 border ${margin < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}><div className="text-[10px] font-bold text-slate-500 uppercase">Margin{margin < 0 ? ' ⚠' : ''}</div><div className={`text-lg font-black ${margin < 0 ? 'text-red-600' : marginPct < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{money(margin)} <span className="text-xs">({marginPct.toFixed(0)}%)</span></div></div>
            </div>

            <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
                <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} className="h-4 w-4 accent-[#13294b]" />
                Email each subbie their loadcon now (one per subbie, listing their vehicle(s))
            </label>

            <div className="flex justify-end gap-2 mt-4">
                <button onClick={hideModal} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={submit} disabled={sending} className="px-5 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{sending ? 'Saving…' : `Split into ${filled.length || 1} truck${(filled.length || 1) !== 1 ? 's' : ''}`}</button>
            </div>
        </div>
    );
};

export default SplitLoadModal;
