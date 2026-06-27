import React, { useMemo, useState } from 'react';
import { Supplier, LoadBoardPost } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import Modal from '../Modal';

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-ZA') : '';
const cls = 'w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm';
const label = 'block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1';
const STATUS_STYLE: Record<string, string> = {
    Pending: 'bg-amber-500/15 text-amber-300',
    Approved: 'bg-emerald-500/15 text-emerald-300',
    Filled: 'bg-blue-500/15 text-blue-300',
    Withdrawn: 'bg-gray-500/20 text-gray-400',
    Declined: 'bg-red-500/15 text-red-300',
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
            <h2 className="text-2xl font-bold mb-1 text-white">Post a load to the network</h2>
            <p className="text-gray-400 mb-6 text-sm">Other approved FBN carriers can pick it up. FBN authorises each post before it appears.</p>
            <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Origin *</label><input value={f.origin} onChange={e => set('origin', e.target.value)} className={cls} /></div>
                <div><label className={label}>Destination *</label><input value={f.destination} onChange={e => set('destination', e.target.value)} className={cls} /></div>
                <div><label className={label}>Collection date</label><input type="date" value={f.collectionDate} onChange={e => set('collectionDate', e.target.value)} className={cls} /></div>
                <div><label className={label}>Vehicle type needed</label><input value={f.vehicleTypeNeeded} onChange={e => set('vehicleTypeNeeded', e.target.value)} placeholder="e.g. Tri-axle" className={cls} /></div>
                <div><label className={label}>Load type</label><input value={f.loadType} onChange={e => set('loadType', e.target.value)} placeholder="Full / Part / Pallets" className={cls} /></div>
                <div className="col-span-2"><label className={label}>Cargo description</label><input value={f.cargoDescription} onChange={e => set('cargoDescription', e.target.value)} className={cls} /></div>
                <div><label className={label}>Contact name</label><input value={f.contactName} onChange={e => set('contactName', e.target.value)} className={cls} /></div>
                <div><label className={label}>Contact phone</label><input value={f.contactPhone} onChange={e => set('contactPhone', e.target.value)} className={cls} /></div>
                <div className="col-span-2"><label className={label}>Contact email</label><input value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} className={cls} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <button onClick={onClose} className="bg-gray-600 py-2 px-4 rounded-lg text-white text-sm">Cancel</button>
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
                <h2 className="text-3xl font-black text-white tracking-tight">Load Board</h2>
                <button onClick={() => setPosting(true)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded-lg">＋ Post a load</button>
            </div>
            <p className="text-gray-400 mb-6">Post a load you need help covering, or pick up a load another FBN carrier has posted.</p>

            {/* Network board */}
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3">Available from the network · {networkPosts.length}</h3>
            <div className="space-y-3 mb-8">
                {networkPosts.map(p => (
                    <div key={p.id} className="bg-[#111827] border border-white/5 rounded-2xl p-5">
                        <h4 className="text-lg font-black text-white">{p.origin} → {p.destination}</h4>
                        <p className="text-xs text-gray-400 mt-1">{spec(p)}</p>
                        <div className="mt-3 pt-3 border-t border-white/5 text-[12px] text-gray-300">
                            <span className="text-gray-500">Enquiries: </span>
                            {[p.contactName, p.contactPhone, p.contactEmail].filter(Boolean).join(' · ') || 'see FBN'}
                        </div>
                    </div>
                ))}
                {networkPosts.length === 0 && <p className="text-sm text-gray-500 py-6 text-center bg-white/5 rounded-xl">No network loads available right now.</p>}
            </div>

            {/* My posts */}
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">My posts · {myPosts.length}</h3>
            <div className="space-y-3">
                {myPosts.map(p => (
                    <div key={p.id} className="bg-[#111827] border border-white/5 rounded-2xl p-5">
                        <div className="flex justify-between items-start gap-3">
                            <div>
                                <h4 className="text-base font-black text-white">{p.origin} → {p.destination}</h4>
                                <p className="text-xs text-gray-400 mt-1">{spec(p)}</p>
                            </div>
                            <span className={`shrink-0 text-[11px] font-black px-2.5 py-1 rounded-lg ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                        </div>
                        {p.status === 'Declined' && p.declineNote && <p className="mt-2 text-[11px] text-red-300">Declined: {p.declineNote}</p>}
                        {(p.status === 'Approved' || p.status === 'Pending') && (
                            <div className="flex justify-end gap-2 mt-3">
                                {p.status === 'Approved' && <button onClick={() => setStatus(p, 'Filled')} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white py-1.5 px-3 rounded-lg">Mark filled</button>}
                                <button onClick={() => setStatus(p, 'Withdrawn')} className="text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:text-white py-1.5 px-3 rounded-lg">Withdraw</button>
                            </div>
                        )}
                    </div>
                ))}
                {myPosts.length === 0 && <p className="text-sm text-gray-500 py-6 text-center bg-white/5 rounded-xl">You haven't posted any loads yet.</p>}
            </div>

            {posting && <Modal isOpen={posting} onClose={() => setPosting(false)}><PostModal supplier={supplier} onClose={() => setPosting(false)} /></Modal>}
        </div>
    );
};

export default SupplierLoadBoard;
