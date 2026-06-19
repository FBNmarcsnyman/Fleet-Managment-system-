import React, { useMemo } from 'react';
import { useUIState, useOperations } from '../../contexts/AppContexts';

// Read-only view of a client or subcontractor — opened by clicking the name in
// the list. An Edit button switches to the matching edit form.
const PartnerDetailModal: React.FC = () => {
    const { modal, showModal } = useUIState();
    const { loadConfirmations = [] } = useOperations() as any;
    const p = modal.payload?.partner;
    const kind: 'client' | 'supplier' = modal.payload?.kind || 'client';
    if (!p) return null;

    const isClient = kind === 'client';
    const contacts = p.contacts || [];
    const branches = p.branches || [];
    const docLabel = isClient ? 'Order' : 'LoadCon';
    const podLabel = isClient ? 'Signed POD' : 'POD to sign';

    const loads = useMemo(() => (loadConfirmations as any[])
        .filter(l => isClient ? (l.clientId === p.id || (l.clientName || '').toLowerCase() === (p.name || '').toLowerCase())
            : (l.supplierId === p.id || (l.subcontractorName || '').toLowerCase() === (p.name || '').toLowerCase()))
        .sort((a, b) => new Date(b.date || b.collectionDate || 0).getTime() - new Date(a.date || a.collectionDate || 0).getTime()), [loadConfirmations, p, isClient]);

    const edit = () => showModal(isClient ? 'addClient' : 'addSupplier', isClient ? { client: p } : { supplier: p });

    const chip = (on: boolean, label: string) => (
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{label}</span>
    );
    const lbl = 'text-[10px] font-black text-slate-400 uppercase tracking-wider';

    return (
        <div className="text-slate-800">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isClient ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{isClient ? 'Client' : 'Subcontractor'}</span>
                    <h2 className="text-2xl font-black text-slate-900 mt-1">{p.name}</h2>
                </div>
                <button onClick={edit} className="bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2 px-5 rounded-lg text-sm shadow">Edit</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                <div><div className={lbl}>Contact</div><div className="text-sm font-semibold">{p.contactPerson || contacts[0]?.name || '—'}</div></div>
                <div><div className={lbl}>Email</div><div className="text-sm">{p.contactEmail || contacts[0]?.email || '—'}</div></div>
                <div><div className={lbl}>Phone</div><div className="text-sm">{p.contactPhone || contacts[0]?.phone || '—'}</div></div>
                <div><div className={lbl}>Loads</div><div className="text-sm font-bold">{loads.length}</div></div>
                {p.address && <div className="col-span-2 md:col-span-4"><div className={lbl}>Address</div><div className="text-sm">{p.address}</div></div>}
            </div>

            <div className="mb-4">
                <div className={`${lbl} mb-2`}>Contacts &amp; what they receive</div>
                {contacts.length === 0 ? <p className="text-xs text-slate-400 italic">No contacts captured.</p> : (
                    <div className="space-y-1.5">
                        {contacts.map((c: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-bold truncate">{c.name || c.email}{c.role ? <span className="text-slate-400 font-normal"> · {c.role}</span> : ''}</div>
                                    <div className="text-[11px] text-slate-500 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {chip(!!c.getsDocs, docLabel)}{chip(!!c.getsPod, podLabel)}{chip(!!c.getsUpdates, 'Updates')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isClient && branches.length > 0 && (
                <div className="mb-4">
                    <div className={`${lbl} mb-2`}>Branches</div>
                    <div className="space-y-1.5">
                        {branches.map((b: any, i: number) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <div className="text-sm font-bold">{b.name}</div>
                                <div className="text-[11px] text-slate-500">{b.address || '—'}{b.contactPerson ? ` · ${b.contactPerson}` : ''}{b.contactEmail ? ` · ${b.contactEmail}` : ''}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loads.length > 0 && (
                <div>
                    <div className={`${lbl} mb-2`}>Recent loads</div>
                    <div className="space-y-1">
                        {loads.slice(0, 6).map((l: any) => (
                            <button key={l.id} onClick={() => showModal('loadDetail', { loadCon: l })} className="w-full text-left flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:border-blue-400">
                                <span className="font-mono text-[11px] text-blue-600">{l.loadConNumber}</span>
                                <span className="text-[11px] text-slate-500 truncate flex-1">{l.collectionPoint} → {l.deliveryPoint}</span>
                                <span className="text-[10px] font-bold text-slate-400">{l.status}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PartnerDetailModal;
