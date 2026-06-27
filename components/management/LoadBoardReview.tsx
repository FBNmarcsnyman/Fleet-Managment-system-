import React, { useMemo, useState } from 'react';
import { LoadBoardPost, Supplier } from '../../types';
import { useOperations, useUIState, useAuth } from '../../contexts/AppContexts';
import Modal from '../Modal';

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';
const STATUS_STYLE: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Filled: 'bg-blue-100 text-blue-700',
    Withdrawn: 'bg-slate-200 text-slate-600',
    Declined: 'bg-red-100 text-red-700',
};

// FBN admin authorisation of carrier-posted loads: approve so other carriers see it, or decline.
const LoadBoardReview: React.FC = () => {
    const { loadBoardPosts = [], suppliers = [], handleUpdateLoadBoardPost } = useOperations() as any;
    const { currentUser } = useAuth() as any;
    const { showToast } = useUIState();
    const [filter, setFilter] = useState<'Pending' | 'Approved' | 'all'>('Pending');
    const [declineFor, setDeclineFor] = useState<LoadBoardPost | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const supName = (id: string) => (suppliers as Supplier[]).find(s => s.id === id)?.name || 'Carrier';
    const posts = useMemo(() => (loadBoardPosts as LoadBoardPost[]).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [loadBoardPosts]);
    const shown = filter === 'all' ? posts : posts.filter(p => p.status === filter);
    const pendingCount = posts.filter(p => p.status === 'Pending').length;

    const approve = async (p: LoadBoardPost) => {
        const res = await handleUpdateLoadBoardPost(p.id, { status: 'Approved', approvedByName: currentUser?.name });
        showToast(res?.ok ? `${p.origin} → ${p.destination} approved — now visible to carriers.` : `Failed: ${res?.error}`);
    };
    const confirmDecline = async () => {
        if (!declineFor) return;
        if (!note.trim()) { showToast('Add a short reason.'); return; }
        setBusy(true);
        const res = await handleUpdateLoadBoardPost(declineFor.id, { status: 'Declined', declineNote: note.trim() });
        setBusy(false);
        showToast(res?.ok ? 'Post declined — carrier notified.' : `Failed: ${res?.error}`);
        setDeclineFor(null); setNote('');
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black text-slate-900">Load Board</h3>
                {pendingCount > 0 && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">{pendingCount} awaiting approval</span>}
            </div>
            <p className="text-xs text-slate-500 mb-4">Authorise a carrier's posted load so other approved carriers can see it, or decline it.</p>
            <div className="flex items-center gap-2 mb-4">
                {(['Pending', 'Approved', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${filter === f ? 'bg-[#13294b] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f === 'all' ? 'All' : f}</button>
                ))}
            </div>
            {shown.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No posts{filter !== 'all' ? ` (${filter})` : ''}.</p> : (
                <div className="space-y-2">
                    {shown.map(p => (
                        <div key={p.id} className="border border-slate-200 rounded-xl p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-sm">{p.origin} → {p.destination} <span className="font-normal text-slate-500">· {supName(p.supplierId)}</span></p>
                                    <p className="text-[11px] text-slate-500">{[p.vehicleTypeNeeded, p.loadType, p.cargoDescription, p.collectionDate ? `collect ${fmt(p.collectionDate)}` : ''].filter(Boolean).join(' · ')}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Enquiries: {[p.contactName, p.contactPhone, p.contactEmail].filter(Boolean).join(' · ') || '—'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                                    {p.status === 'Pending' && (
                                        <div className="flex gap-2 mt-2 justify-end">
                                            <button onClick={() => approve(p)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800">Approve</button>
                                            <button onClick={() => { setDeclineFor(p); setNote(''); }} className="text-[11px] font-bold text-red-600 hover:text-red-800">Decline</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {p.status === 'Declined' && p.declineNote && <p className="mt-1 text-[11px] text-red-600">Declined: {p.declineNote}</p>}
                        </div>
                    ))}
                </div>
            )}
            {declineFor && (
                <Modal isOpen={!!declineFor} onClose={() => setDeclineFor(null)}>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 mb-1">Decline post</h2>
                        <p className="text-slate-500 text-sm mb-4">{declineFor.origin} → {declineFor.destination} · {supName(declineFor.supplierId)}</p>
                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Reason (emailed to the carrier)" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" />
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setDeclineFor(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={confirmDecline} disabled={busy} className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50">{busy ? 'Saving…' : 'Decline'}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default LoadBoardReview;
