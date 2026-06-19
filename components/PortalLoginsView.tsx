import React, { useMemo, useState } from 'react';
import { useCommonData, useOperations } from '../contexts/AppContexts';
import { User } from '../types';

// Client & supplier PORTAL logins — kept separate from internal staff users so
// the owner can monitor them in one place: create access, reset a password,
// deactivate, or delete. These are profiles with role Client or Supplier.
const PortalLoginsView: React.FC = () => {
    const { users = [], handleAddUser, handleUpdateUser, handleDeleteUser } = useCommonData() as any;
    const { clients = [], suppliers = [] } = (useOperations() as any) || {};

    const [filter, setFilter] = useState<'all' | 'Client' | 'Supplier'>('all');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const [showAdd, setShowAdd] = useState(false);
    const [aName, setAName] = useState('');
    const [aEmail, setAEmail] = useState('');
    const [aType, setAType] = useState<'Client' | 'Supplier'>('Supplier');
    const [aLink, setALink] = useState('');

    const portalUsers: User[] = useMemo(() => (users || []).filter((u: User) => u.role === 'Client' || u.role === 'Supplier'), [users]);
    const rows = useMemo(() => {
        let r = portalUsers;
        if (filter !== 'all') r = r.filter(u => u.role === filter);
        const q = search.trim().toLowerCase();
        if (q) r = r.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
        return [...r].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [portalUsers, filter, search]);

    const reset = async (u: User) => {
        if (busy) return;
        if (!confirm(`Reset the password for ${u.email}?`)) return;
        setBusy(u.id);
        const res = await handleUpdateUser(u, {}, { resetPassword: true });
        setBusy(null);
        if (!res.ok) { alert(`Could not reset: ${res.error || 'unknown error'}`); return; }
        if (res.tempPassword) alert(`New password for ${u.email}:\n\n${res.tempPassword}\n\nShare it with them — they can change it after logging in.`);
    };
    const toggleActive = async (u: User) => {
        if (busy) return;
        const active = (u as any).isActive !== false;
        setBusy(u.id);
        const res = await handleUpdateUser(u, { isActive: !active });
        setBusy(null);
        if (!res.ok) alert(`Could not update: ${res.error || 'unknown error'}`);
    };
    const del = async (u: User) => {
        if (busy) return;
        if (!confirm(`Delete the login for ${u.email}?\n\nThis permanently removes their access. (Use Deactivate if you only want to pause it.)`)) return;
        setBusy(u.id);
        const res = await handleDeleteUser(u);
        setBusy(null);
        if (!res.ok) alert(`Could not delete: ${res.error || 'unknown error'}`);
    };

    const submitAdd = async () => {
        if (!aName.trim() || !aEmail.trim()) { alert('Name and email are required.'); return; }
        setBusy('add');
        const link = aType === 'Client' ? { clientId: aLink || undefined } : { supplierId: aLink || undefined };
        const res = await handleAddUser({ name: aName.trim(), email: aEmail.trim(), role: aType, assignedBranches: [], ...link });
        setBusy(null);
        if (!res.ok) { alert(`Could not create the login: ${res.error || 'unknown error'}`); return; }
        alert(`Login created.\n\nEmail: ${aEmail.trim()}\nTemporary password: ${res.tempPassword}\n\nShare these with them.`);
        setShowAdd(false); setAName(''); setAEmail(''); setALink('');
    };

    const inputCls = 'w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const linkOptions = aType === 'Client' ? clients : suppliers;

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <h3 className="text-xl font-bold text-white">Client &amp; Supplier Logins</h3>
                    <p className="text-sm text-gray-400">Portal access for outside parties — separate from your team. Reset, deactivate or delete here.</p>
                </div>
                <button onClick={() => setShowAdd(s => !s)} className="font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white text-sm">{showAdd ? 'Close' : '+ Add login'}</button>
            </div>

            {showAdd && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Type</label>
                        <select value={aType} onChange={e => { setAType(e.target.value as any); setALink(''); }} className={inputCls}>
                            <option value="Supplier">Supplier / Subcontractor</option>
                            <option value="Client">Client</option>
                        </select></div>
                    <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Link to {aType.toLowerCase()} (optional)</label>
                        <select value={aLink} onChange={e => setALink(e.target.value)} className={inputCls}>
                            <option value="">— none —</option>
                            {(linkOptions as any[]).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select></div>
                    <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Contact name</label><input value={aName} onChange={e => setAName(e.target.value)} className={inputCls} placeholder="Person's name" /></div>
                    <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Login email</label><input value={aEmail} onChange={e => setAEmail(e.target.value)} className={inputCls} placeholder="name@company.co.za" /></div>
                    <div className="md:col-span-2 flex justify-end"><button onClick={submitAdd} disabled={busy === 'add'} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm">{busy === 'add' ? 'Creating…' : 'Create login'}</button></div>
                </div>
            )}

            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {(['all', 'Client', 'Supplier'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{f === 'all' ? 'All' : f + 's'}</button>
                ))}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / email…" className="flex-1 min-w-[180px] bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600" />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-3 text-gray-300">Name</th>
                            <th className="p-3 text-gray-300">Email</th>
                            <th className="p-3 text-gray-300">Type</th>
                            <th className="p-3 text-gray-300">Status</th>
                            <th className="p-3 text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(u => {
                            const active = (u as any).isActive !== false;
                            return (
                                <tr key={u.email} className="border-b border-gray-700/70">
                                    <td className="p-3 font-medium text-white">{u.name}</td>
                                    <td className="p-3 text-gray-300">{u.email}</td>
                                    <td className="p-3"><span className={`px-2 py-0.5 text-xs font-bold rounded-full ${u.role === 'Client' ? 'bg-blue-900/50 text-blue-300' : 'bg-amber-900/40 text-amber-300'}`}>{u.role}</span></td>
                                    <td className="p-3">{active ? <span className="text-xs font-semibold text-emerald-400">Active</span> : <span className="text-xs font-semibold text-gray-500">Inactive</span>}</td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                        <button onClick={() => reset(u)} disabled={busy === u.id} className="text-xs font-semibold text-blue-400 hover:text-white mr-3 disabled:opacity-50">Reset password</button>
                                        <button onClick={() => toggleActive(u)} disabled={busy === u.id} className={`text-xs font-semibold mr-3 disabled:opacity-50 ${active ? 'text-amber-400 hover:text-white' : 'text-emerald-400 hover:text-white'}`}>{active ? 'Deactivate' : 'Activate'}</button>
                                        <button onClick={() => del(u)} disabled={busy === u.id} className="text-xs font-semibold text-red-400 hover:text-white disabled:opacity-50">Delete</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500 italic">No client or supplier logins{filter !== 'all' ? ` of type ${filter}` : ''} yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PortalLoginsView;
