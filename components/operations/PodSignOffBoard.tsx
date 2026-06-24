import React, { useMemo, useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';

// POD sign-off board — the POD lifecycle in one place:
//   1) Awaiting sign-off — a POD has been uploaded but not yet released to the client
//      (subbie uploads are held for review; legacy submitted PODs land here too).
//   2) Finalised — POD authorised/auto-sent to the client.
//   3) Archived — closed/filed loads, searchable for later.
// "Sign off" opens the load so an admin can View / Authorise (or upload a cleaned copy).
const podLink = (lc: LoadConfirmation): string | null =>
    (lc as any).podDriveUrl || lc.podPhoto?.data || (lc as any).podDocUrls?.[0] || null;

const PodSignOffBoard: React.FC = () => {
    const { loadConfirmations = [], clients = [] } = useOperations() as any;
    const { showModal } = useUIState();
    const [q, setQ] = useState('');

    const clientMap = useMemo(() => new Map<string, string>((clients as any[]).map(c => [c.id, c.name])), [clients]);
    const fmtDay = (s?: string) => { if (!s) return '—'; const d = new Date(s); return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }); };

    const { awaiting, finalised, archived } = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const match = (lc: LoadConfirmation) => {
            if (!needle) return true;
            return `${lc.loadConNumber} ${lc.loadRefNo || ''} ${clientMap.get(lc.clientId || '') || lc.clientName || ''} ${lc.subcontractorName || ''} ${lc.collectionPoint || ''} ${lc.deliveryPoint || ''}`.toLowerCase().includes(needle);
        };
        const withPod = (loadConfirmations as LoadConfirmation[]).filter(lc => podLink(lc) && match(lc));
        const auth = (lc: LoadConfirmation) => (lc as any).podAuthorisation;
        return {
            awaiting: withPod.filter(lc => !(lc as any).archived && auth(lc) !== 'authorised' && auth(lc) !== 'auto'),
            finalised: withPod.filter(lc => !(lc as any).archived && (auth(lc) === 'authorised' || auth(lc) === 'auto')),
            archived: withPod.filter(lc => (lc as any).archived),
        };
    }, [loadConfirmations, q, clientMap]);

    const Row: React.FC<{ lc: LoadConfirmation; cta: 'signoff' | 'view' }> = ({ lc, cta }) => {
        const pod = podLink(lc);
        const pending = (lc as any).podAuthorisation === 'pending';
        return (
            <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-700 font-mono text-xs">{lc.loadConNumber}</span>
                        {(lc as any).podAuthorisation === 'blocked' && <span className="text-[10px] font-black text-red-600 uppercase">⛔ blocked</span>}
                        {pending && <span className="text-[10px] font-black text-amber-600 uppercase">⚠ review</span>}
                        {(lc as any).podAuthorisation === 'authorised' && <span className="text-[10px] font-black text-emerald-600 uppercase">sent ✓</span>}
                    </div>
                    <div className="text-xs text-slate-600 truncate">{clientMap.get(lc.clientId || '') || lc.clientName || '—'} · {lc.collectionPoint} → {lc.deliveryPoint}</div>
                    <div className="text-[11px] text-slate-400 truncate">🚚 {lc.subcontractorName || 'Own fleet'} · delivered {fmtDay(lc.deliveryDate || lc.collectionDate)}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {pod && <a href={pod} target="_blank" rel="noreferrer" className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-2.5 rounded-lg">📄 View</a>}
                    <button onClick={() => showModal('loadDetail', { loadCon: lc })} className="text-[11px] font-bold bg-[#13294b] hover:bg-[#1d3a66] text-white py-1.5 px-2.5 rounded-lg">{cta === 'signoff' ? 'Sign off →' : 'Open'}</button>
                </div>
            </div>
        );
    };

    const SectionCard: React.FC<{ title: string; hint: string; rows: LoadConfirmation[]; cta: 'signoff' | 'view'; accent: string }> = ({ title, hint, rows, cta, accent }) => (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className={`px-4 py-2.5 border-b border-slate-200 ${accent}`}>
                <h4 className="text-sm font-black uppercase tracking-wide">{title} <span className="opacity-60">{rows.length}</span></h4>
                <p className="text-[11px] opacity-80">{hint}</p>
            </div>
            {rows.length === 0 ? <div className="px-4 py-6 text-center text-slate-400 text-sm">Nothing here.</div> : rows.map(lc => <Row key={lc.id} lc={lc} cta={cta} />)}
        </div>
    );

    return (
        <div className="space-y-4 max-w-[1600px] mx-auto px-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">PODs</h3>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search PODs…" className="bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm w-56" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <SectionCard title="📤 Awaiting sign-off" hint="Uploaded — review & authorise to the client" rows={awaiting} cta="signoff" accent="bg-amber-50 text-amber-800" />
                <SectionCard title="✅ Finalised" hint="Authorised / sent to the client" rows={finalised} cta="view" accent="bg-emerald-50 text-emerald-800" />
                <SectionCard title="🗄 Archived" hint="Filed — search & view later" rows={archived} cta="view" accent="bg-slate-100 text-slate-600" />
            </div>
        </div>
    );
};

export default PodSignOffBoard;
