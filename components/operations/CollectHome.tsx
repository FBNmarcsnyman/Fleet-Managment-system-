import React, { useMemo } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import { STATUS_LABEL, statusChip } from '../../lib/loadStatus';

// Mobile front page: book a collection in one tap. Everything else is a tap away
// via the ☰ menu. Defaults as the landing view on phones.
const CollectHome: React.FC = () => {
    const { showModal, showToast, setSidebarOpen, handleViewChange } = useUIState();
    const { loadConfirmations = [], quotes = [], handleCreateLoadConfirmation: createLoadCon } = useOperations() as any;
    // New quote requests waiting to be priced/attended — surfaced on the phone.
    const newQuotes = useMemo(() => (quotes as any[]).filter(q => q.status === 'Requested' || q.status === 'More Info Requested').length, [quotes]);

    const onSubmit = async (data: any) => {
        const r = await createLoadCon(data);
        if (r?.ok) showToast((r as any).warning ? `${r.value?.loadConNumber} logged — ⚠ ${(r as any).warning}` : `${r.value?.loadConNumber} logged.`);
        else showToast(`Failed: ${r?.error}`);
        return r;
    };
    const recent = useMemo(() => (loadConfirmations as LoadConfirmation[])
        .filter(l => l.isCollection)
        .sort((a, b) => new Date(b.date || b.collectionDate || 0).getTime() - new Date(a.date || a.collectionDate || 0).getTime())
        .slice(0, 8), [loadConfirmations]);
    const clientName = (lc: LoadConfirmation) => lc.clientName || 'Client';

    return (
        <div className="max-w-xl mx-auto space-y-5">
            <div className="text-center pt-2">
                <h1 className="text-2xl font-black text-slate-900">Book a collection</h1>
                <p className="text-sm text-slate-500">Quick capture — ops gets it instantly.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
                <button onClick={() => showModal('quickCollection', { onSubmit })}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl p-5 text-left shadow-lg">
                    <div className="text-lg font-black">New Collection</div>
                    <div className="text-xs text-emerald-100 mt-1">Client, addresses, packages → ops assigns a driver.</div>
                </button>
                <button onClick={() => showModal('brokingCollection', { onSubmit })}
                    className="bg-[#13294b] hover:bg-[#1d3a66] active:scale-[0.99] text-white rounded-2xl p-5 text-left shadow-lg">
                    <div className="text-lg font-black">Broking Collection</div>
                    <div className="text-xs text-blue-100 mt-1">Assign a transporter → LoadCon + client order sent.</div>
                </button>
                <button onClick={() => handleViewChange('quotes')}
                    className="bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-white rounded-2xl p-5 text-left shadow-lg flex items-center justify-between">
                    <div>
                        <div className="text-lg font-black">Quotes</div>
                        <div className="text-xs text-amber-50 mt-1">View &amp; price new quote requests on the road.</div>
                    </div>
                    {newQuotes > 0 && <span className="shrink-0 bg-white text-amber-600 text-xs font-black px-3 py-1 rounded-full">{newQuotes} new</span>}
                </button>
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Recent collections</h2>
                    <button onClick={() => setSidebarOpen(true)} className="text-xs font-bold text-blue-600">☰ Menu</button>
                </div>
                <div className="space-y-2">
                    {recent.length === 0 && <p className="text-sm text-slate-400 italic">No collections yet — book one above.</p>}
                    {recent.map(lc => (
                        <button key={lc.id} onClick={() => showModal('loadDetail', { loadCon: lc })}
                            className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-sm truncate">{clientName(lc)}</p>
                                <p className="text-[11px] text-slate-500 truncate">{lc.collectionPoint} → {lc.deliveryPoint}</p>
                            </div>
                            <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded uppercase ${statusChip(lc.status)}`}>{STATUS_LABEL[lc.status]}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CollectHome;
