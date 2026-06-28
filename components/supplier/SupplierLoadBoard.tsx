import React, { useMemo, useState } from 'react';
import { Supplier, LoadBoardPost } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import Modal from '../Modal';
import DateField from '../operations/DateField';

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';
const cls = 'w-full bg-white text-slate-800 p-2.5 rounded-md border border-slate-300 text-sm';
const label = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1';
const STATUS_STYLE: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Filled: 'bg-blue-100 text-blue-700',
    Withdrawn: 'bg-slate-200 text-slate-600',
    Declined: 'bg-red-100 text-red-700',
};

const PostModal: React.FC<{ supplier: Supplier; onClose: () => void }> = ({ supplier, onClose }) => {
    const { handleCreateLoadBoardPost } = useOperations() as any;
    const { showToast } = useUIState();
    const [f, setF] = useState({
        origin: '', destination: '', collectionDate: '', cargoDescription: '', vehicleTypeNeeded: '', loadType: '',
        contactName: supplier.contactPerson || '', contactPhone: supplier.contactPhone || '', contactEmail: supplier.contactEmail || '',
    });
    const [saving, setSaving] = useState(false);
    const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

    const submit = async () => {
        if (saving) return;
        if (!f.origin.trim() || !f.destination.trim()) { showToast('Enter origin and destination.'); return; }
        setSaving(true);
        const res = await handleCreateLoadBoardPost({ supplierId: supplier.id, postedByName: supplier.name, ...f });
        setSaving(false);
        if (res?.ok) { showToast('Posted — FBN will authorise it before it goes live.'); onClose(); }
        else showToast(`Could not post: ${res?.error}`);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-1 text-slate-900">Post a load to the network</h2>
            <p className="text-slate-500 mb-6 text-sm">Other approved FBN carriers can pick it up. FBN authorises each post before it appears.</p>
            <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Origin *</label><input value={f.origin} onChange={e => set('origin', e.target.value)} className={cls} /></div>
                <div><label className={label}>Destination *</label><input value={f.destination} onChange={e => set('destination', e.target.value)} className={cls} /></div>
                <div><label className={label}>Collection date</label><DateField value={f.collectionDate} onChange={v => set('collectionDate', v)} className={cls} /></div>
                <div><label className={label}>Vehicle type needed</label><input value={f.vehicleTypeNeeded} onChange={e => set('vehicleTypeNeeded', e.target.value)} placeholder="e.g. Tri-axle" className={cls} /></div>
                <div><label className={label}>Load type</label><input value={f.loadType} onChange={e => set('loadType', e.target.value)} placeholder="Full / Part / Pallets" className={cls} /></div>
                <div className="col-span-2"><label className={label}>Cargo description</label><input value={f.cargoDescription} onChange={e => set('cargoDescription', e.target.value)} className={cls} /></div>
                <div><label className={label}>Contact name</label><input value={f.contactName} onChange={e => set('contactName', e.target.value)} className={cls} /></div>
                <div><label className={label}>Contact phone</label><input value={f.contactPhone} onChange={e => set('contactPhone', e.target.value)} className={cls} /></div>
                <div className="col-span-2"><label className={label}>Contact email</label><input value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} className={cls} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button onClick={onClose} className="bg-slate-200 text-slate-700 hover:bg-slate-300 py-2 px-4 rounded-lg text-sm">Cancel</button>
                <button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 py-2 px-5 rounded-lg text-white text-sm font-bold disabled:opacity-50">{saving ? 'Posting…' : 'Post load'}</button>
            </div>
        </div>
    );
};

const SupplierLoadBoard: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    const { loadBoardPosts = [], handleUpdateLoadBoardPost } = useOperations() as any;
    const { showToast } = useUIState();
    const [posting, setPosting] = useState(false);

    const myPosts = useMemo(() => (loadBoardPosts as LoadBoardPost[])
        .filter(p => p.supplierId === supplier.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [loadBoardPosts, supplier.id]);
    const networkPosts = useMemo(() => (loadBoardPosts as LoadBoardPost[])
        .filter(p => p.supplierId !== supplier.id && p.status === 'Approved')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [loadBoardPosts, supplier.id]);

    const setStatus = async (p: LoadBoardPost, status: LoadBoardPost['status']) => {
        const res = await handleUpdateLoadBoardPost(p.id, { status });
        showToast(res?.ok ? `Post marked ${status}.` : `Failed: ${res?.error}`);
    };

    const spec = (p: LoadBoardPost) => [p.vehicleTypeNeeded, p.loadType, p.cargoDescription, p.collectionDate ? `collect ${fmt(p.collectionDate)}` : ''].filter(Boolean).join(' · ');

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Load Board</h2>
                <button onClick={() => setPosting(true)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded-lg">＋ Post a load</button>
            </div>
            <p className="text-slate-500 mb-6">Post a load you need help covering, or pick up a load another FBN carrier has posted.</p>

            {/* Network board */}
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3">Available from the network · {networkPosts.length}</h3>
            <div className="space-y-3 mb-8">
                {networkPosts.map(p => (
                    <div key={p.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
                        <h4 className="text-lg font-black text-slate-900">{p.origin} → {p.destination}</h4>
                        <p className="text-xs text-slate-500 mt-1">{spec(p)}</p>
                        <div className="mt-3 pt-3 border-t border-slate-200 text-[12px] text-slate-600">
                            <span className="text-slate-400">Enquiries: </span>
                            {[p.contactName, p.contactPhone, p.contactEmail].filter(Boolean).join(' · ') || 'see FBN'}
                        </div>
                    </div>
                ))}
                {networkPosts.length === 0 && <p className="text-sm text-slate-400 py-6 text-center bg-slate-50 rounded-xl">No network loads available right now.</p>}
            </div>

            {/* My posts */}
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">My posts · {myPosts.length}</h3>
            <div className="space-y-3">
                {myPosts.map(p => (
                    <div key={p.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
                        <div className="flex justify-between items-start gap-3">
                            <div>
                                <h4 className="text-base font-black text-slate-900">{p.origin} → {p.destination}</h4>
                                <p className="text-xs text-slate-500 mt-1">{spec(p)}</p>
                            </div>
                            <span className={`shrink-0 text-[11px] font-black px-2.5 py-1 rounded-lg ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                        </div>
                        {p.status === 'Declined' && p.declineNote && <p className="mt-2 text-[11px] text-red-700">Declined: {p.declineNote}</p>}
                        {(p.status === 'Approved' || p.status === 'Pending') && (
                            <div className="flex justify-end gap-2 mt-3">
                                {p.status === 'Approved' && <button onClick={() => setStatus(p, 'Filled')} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white py-1.5 px-3 rounded-lg">Mark filled</button>}
                                <button onClick={() => setStatus(p, 'Withdrawn')} className="text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 py-1.5 px-3 rounded-lg">Withdraw</button>
                            </div>
                        )}
                    </div>
                ))}
                {myPosts.length === 0 && <p className="text-sm text-slate-400 py-6 text-center bg-slate-50 rounded-xl">You haven't posted any loads yet.</p>}
            </div>

            {posting && <Modal isOpen={posting} onClose={() => setPosting(false)}><PostModal supplier={supplier} onClose={() => setPosting(false)} /></Modal>}
        </div>
    );
};

export default SupplierLoadBoard;
