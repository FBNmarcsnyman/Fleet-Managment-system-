import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';

// OFFER THIS LOAD — market a load to carriers. Carriers are matched to the load
// by LANE and TRUCK TYPE, inferred from each carrier's own load history (the
// lanes + load types they've actually run for FBN). Tick the carriers, send the
// offer (best-rate invite) — replies come back by email. No client info leaves.
const CITY: { code: string; tokens: string[] }[] = [
    { code: 'JHB', tokens: ['johannesburg', 'jhb', 'joburg', 'gauteng', 'midrand', 'kempton', 'isando', 'germiston', 'boksburg', 'pretoria', 'centurion', 'wadeville', 'spartan', 'jet park', 'modderfontein'] },
    { code: 'DBN', tokens: ['durban', 'dbn', 'pinetown', 'prospecton', 'jacobs', 'mobeni', 'umhlanga', 'new germany', 'westmead', 'cato ridge', 'richards bay'] },
    { code: 'CPT', tokens: ['cape town', 'capetown', 'cpt', 'montague', 'epping', 'paarden', 'bellville', 'killarney', 'parow', 'maitland', 'brackenfell'] },
    { code: 'PE', tokens: ['port elizabeth', 'gqeberha', 'pe ', 'coega'] },
    { code: 'EL', tokens: ['east london', 'el '] },
    { code: 'BFN', tokens: ['bloemfontein', 'bfn'] },
];
const cityOf = (branch?: string, point?: string): string => {
    if (branch && /FBN\s+(\w+)/i.test(branch)) return branch.replace(/^FBN\s*/i, '').toUpperCase();
    const s = `${point || ''}`.toLowerCase();
    for (const c of CITY) if (c.tokens.some(t => s.includes(t))) return c.code;
    return (point || '').trim().split(/[\s,]+/)[0]?.toUpperCase() || '?';
};
const typeKey = (t?: string) => (t || '').toLowerCase().replace(/[^a-z]/g, '');

const OfferLoadModal: React.FC = () => {
    const { modal, hideModal, showToast } = useUIState();
    const { loadConfirmations = [], suppliers = [], handleOfferLoad } = useOperations() as any;
    const lc: LoadConfirmation = modal.payload?.loadCon;
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [showAll, setShowAll] = useState(false);
    const [sending, setSending] = useState(false);
    if (!lc) return null;

    const from = cityOf(lc.collectionBranch, lc.collectionPoint);
    const to = cityOf(lc.destinationBranch, lc.deliveryPoint);
    const lanePair = [from, to].sort().join('|');
    const loadType = typeKey(lc.loadType);
    const alreadyOffered = new Set(((lc as any).offeredCarriers || []).map((o: any) => (o.email || '').toLowerCase()));

    // Build each carrier's history (lanes + load types they've run for us).
    const carriers = useMemo(() => {
        const hist = new Map<string, { lanes: Set<string>; directed: Set<string>; types: Set<string> }>();
        (loadConfirmations as LoadConfirmation[]).forEach(l => {
            const key = l.supplierId || (l.subcontractorName || '').toLowerCase();
            if (!key) return;
            const f = cityOf(l.collectionBranch, l.collectionPoint), t = cityOf(l.destinationBranch, l.deliveryPoint);
            const h = hist.get(key) || { lanes: new Set(), directed: new Set(), types: new Set() };
            h.lanes.add([f, t].sort().join('|')); h.directed.add(`${f}>${t}`); if (l.loadType) h.types.add(typeKey(l.loadType));
            hist.set(key, h);
        });
        return (suppliers as any[])
            .filter(s => s.isActive !== false && (s.type === 'Transport' || !s.type))
            .map(s => {
                const email = s.contactEmail || (s.contacts || []).find((c: any) => c.email)?.email || '';
                const h = hist.get(s.id) || hist.get((s.name || '').toLowerCase());
                const laneMatch = !!h && h.lanes.has(lanePair);
                const directedMatch = !!h && h.directed.has(`${from}>${to}`);
                const typeMatch = !!h && !!loadType && h.types.has(loadType);
                const score = (laneMatch ? 2 : 0) + (directedMatch ? 1 : 0) + (typeMatch ? 1 : 0);
                const reasons: string[] = [];
                if (laneMatch) reasons.push(`runs ${from}↔${to}`);
                if (typeMatch) reasons.push(lc.loadType || 'same truck');
                return { id: s.id, name: s.name, email, score, reasons, ran: h ? h.lanes.size : 0, offered: alreadyOffered.has(email.toLowerCase()), vetted: !!s.isVetted };
            })
            // Best lane/type match first, then vetted carriers ahead of un-vetted.
            .sort((a, b) => b.score - a.score || (Number(b.vetted) - Number(a.vetted)) || a.name.localeCompare(b.name));
    }, [suppliers, loadConfirmations, lanePair, loadType, from, to]);

    const matched = carriers.filter(c => c.score > 0);
    const shown = showAll ? carriers : matched;

    const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const send = async () => {
        const chosen = carriers.filter(c => sel.has(c.id) && c.email).map(c => ({ supplierId: c.id, name: c.name, email: c.email }));
        if (!chosen.length) { showToast('Tick at least one carrier with an email.'); return; }
        setSending(true);
        const res = await handleOfferLoad(lc.id, chosen);
        setSending(false);
        if (res?.ok === false) { showToast(`Could not send: ${res.error}`); return; }
        showToast(`Offer sent to ${res.value?.sent ?? chosen.length} carrier${(res.value?.sent ?? chosen.length) === 1 ? '' : 's'}.`);
        hideModal();
    };

    return (
        <div className="text-slate-800">
            <div className="mb-3">
                <h2 className="text-xl font-black text-[#13294b]">Offer load to carriers</h2>
                <p className="text-xs text-slate-500">{lc.loadConNumber} · <strong>{from} → {to}</strong>{lc.loadType ? ` · ${lc.loadType}` : ''}{lc.collectionDate ? ` · ${lc.collectionDate}` : ''} — matched by lane &amp; truck type from each carrier's history. Replies (rates) come back to ops by email.</p>
            </div>

            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{matched.length} matching carrier{matched.length === 1 ? '' : 's'}{sel.size ? ` · ${sel.size} selected` : ''}</div>
                <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="h-4 w-4 accent-[#13294b]" /> Show all carriers</label>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
                {shown.length === 0 ? <div className="px-4 py-8 text-center text-slate-400 text-sm">No matching carriers yet — tick “Show all carriers” to offer it to anyone.</div> : (
                    <table className="w-full text-sm">
                        <tbody>
                            {shown.map(c => (
                                <tr key={c.id} className={`border-b border-slate-100 ${sel.has(c.id) ? 'bg-amber-50' : ''} ${!c.email ? 'opacity-50' : 'cursor-pointer hover:bg-amber-50/40'}`} onClick={() => c.email && toggle(c.id)}>
                                    <td className="py-2 pl-3 pr-2 w-8"><input type="checkbox" disabled={!c.email} checked={sel.has(c.id)} onChange={() => toggle(c.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 accent-[#13294b]" /></td>
                                    <td className="py-2 px-2">
                                        <div className="font-bold text-[#13294b]">{c.name}{c.offered && <span className="ml-2 text-[10px] font-bold text-emerald-600">✓ offered</span>}{!c.vetted && <span className="ml-2 text-[10px] font-bold text-amber-600">⚠ not vetted</span>}</div>
                                        <div className="text-[11px] text-slate-400">{c.email || 'no email on file'}</div>
                                    </td>
                                    <td className="py-2 px-2">
                                        {c.score > 0
                                            ? <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">{c.reasons.join(' · ')}</span>
                                            : <span className="text-[11px] text-slate-400">{c.ran ? `${c.ran} past lane${c.ran === 1 ? '' : 's'}` : 'no history'}</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-4">
                <button onClick={() => setSel(new Set(matched.filter(c => c.email).map(c => c.id)))} className="text-xs font-bold text-[#13294b] hover:underline">Select all matched</button>
                <div className="flex gap-2">
                    <button onClick={hideModal} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button onClick={send} disabled={sending || sel.size === 0} className="px-5 py-2 rounded-lg text-sm font-black text-white bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50">{sending ? 'Sending…' : `Send offer (${sel.size})`}</button>
                </div>
            </div>
        </div>
    );
};

export default OfferLoadModal;
