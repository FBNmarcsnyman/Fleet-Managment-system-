import React, { useState } from 'react';
import { useCommonData } from '../contexts/AppContexts';
import Modal from './Modal';
import AddUserForm from './AddUserForm';
import EditUserForm from './EditUserForm';
import RoleAccessMatrix from './RoleAccessMatrix';
import PortalLoginsView from './PortalLoginsView';
import { PlusIcon } from './icons/PlusIcon';
import { User } from '../types';

// External portal logins live under their own tab; the staff table only shows
// internal team members.
const EXTERNAL_ROLES = ['Client', 'Supplier'];

// One-click access presets for the bulk "Apply access" action — set the same
// role + permissions on several team members at once.
const PRESETS: { key: string; label: string; role: string; permissions: string[] }[] = [
    { key: 'loadcons', label: 'LoadCons operator — Load Board / LoadCons / Deliveries + Ops (Dashboard/Day/Shipments/Daily)', role: 'Ops', permissions: ['access_loadcons'] },
    { key: 'ops', label: 'Full Operations — Broking / Clients / Quotes + all Ops', role: 'Ops', permissions: ['access_operations'] },
    { key: 'accounts', label: 'Accounts / Finance', role: 'Accounts', permissions: ['access_finance'] },
    { key: 'workshop', label: 'Workshop', role: 'Workshop Manager', permissions: ['access_workshop'] },
    { key: 'fleet', label: 'Fleet', role: 'Staff', permissions: ['access_fleet'] },
    { key: 'admin', label: 'Admin — full access', role: 'Admin', permissions: [] },
];

const UserManagement: React.FC = () => {
    const { users, handleAddUser, handleUpdateUser } = useCommonData() as any;
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [tab, setTab] = useState<'team' | 'portal'>('team');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [preset, setPreset] = useState('loadcons');
    const [applying, setApplying] = useState(false);
    const staffUsers = (users || []).filter((u: User) => !EXTERNAL_ROLES.includes(u.role as string));

    const handleSubmitNewUser = async (user: Omit<User, 'permissions' | 'assignedVehicleIds'>) => {
        const res = await handleAddUser(user);
        if (!res.ok) { alert(`Could not add the user: ${res.error || 'unknown error'}`); return; }
        setIsAddUserModalOpen(false);
        alert(`User created.\n\nEmail: ${user.email}\nTemporary password: ${res.tempPassword}\n\nShare these with them — they can change the password after logging in.`);
    };

    const toggle = (email: string) => setSelected(p => { const n = new Set(p); n.has(email) ? n.delete(email) : n.add(email); return n; });
    const allOnPage = staffUsers.map((u: User) => u.email);
    const allSelected = staffUsers.length > 0 && allOnPage.every((e: string) => selected.has(e));
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allOnPage));

    const applyBulk = async () => {
        const p = PRESETS.find(x => x.key === preset)!;
        const targets = staffUsers.filter((u: User) => selected.has(u.email));
        if (!targets.length) { alert('Select at least one person first.'); return; }
        if (!confirm(`Set ${targets.length} user(s) to:\n\n${p.label}\n\nThey'll need to log out and back in for it to take effect. Continue?`)) return;
        setApplying(true);
        let ok = 0; const failed: string[] = [];
        for (const u of targets) {
            const r = await handleUpdateUser(u, { role: p.role, permissions: p.permissions });
            r?.ok === false ? failed.push(u.name) : ok++;
        }
        setApplying(false);
        setSelected(new Set());
        alert(`Updated ${ok} user(s)${failed.length ? `, ${failed.length} failed (${failed.join(', ')})` : ''}.\n\nThey must log out and back in for the new access to load.`);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
                <h2 className="text-3xl font-bold text-white">User Management</h2>
                {tab === 'team' && (
                    <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                        <PlusIcon className="h-5 w-5 mr-2" /> Add User
                    </button>
                )}
            </div>

            <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-xl w-fit mb-5">
                <button onClick={() => setTab('team')} className={`px-4 py-2 text-sm font-bold rounded-lg ${tab === 'team' ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white'}`}>Team ({staffUsers.length})</button>
                <button onClick={() => setTab('portal')} className={`px-4 py-2 text-sm font-bold rounded-lg ${tab === 'portal' ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white'}`}>Client &amp; Supplier Logins</button>
            </div>

            {tab === 'portal' ? <PortalLoginsView /> : (
            <>
            {/* Bulk apply-access toolbar — appears when people are ticked */}
            {selected.size > 0 && (
                <div className="bg-[#13294b] border border-blue-900 rounded-xl p-3 mb-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-black text-white">{selected.size} selected</span>
                    <span className="text-xs text-blue-200">Apply access:</span>
                    <select value={preset} onChange={e => setPreset(e.target.value)} className="bg-white text-slate-800 p-2 rounded-md text-sm flex-1 min-w-[260px]">
                        {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <button onClick={applyBulk} disabled={applying} className="font-bold py-2 px-4 rounded-lg bg-[#f5b700] hover:brightness-95 text-[#13294b] text-sm disabled:opacity-50">{applying ? 'Applying…' : `Apply to ${selected.size}`}</button>
                    <button onClick={() => setSelected(new Set())} className="text-xs text-blue-200 hover:text-white font-bold">Clear</button>
                </div>
            )}

            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-4 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-brand-secondary" title="Select all" /></th>
                            <th className="p-4 text-gray-300">Name</th>
                            <th className="p-4 text-gray-300">Email</th>
                            <th className="p-4 text-gray-300">Role</th>
                            <th className="p-4 text-gray-300">Access</th>
                            <th className="p-4 text-gray-300">Assigned Branches</th>
                            <th className="p-4 text-gray-300">Status</th>
                            <th className="p-4 text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffUsers.map((user: User) => (
                            <tr key={user.email} className={`border-b border-gray-700 ${selected.has(user.email) ? 'bg-blue-900/20' : ''}`}>
                                <td className="p-4"><input type="checkbox" checked={selected.has(user.email)} onChange={() => toggle(user.email)} className="h-4 w-4 accent-brand-secondary" /></td>
                                <td className="p-4 font-medium text-white">{user.name}</td>
                                <td className="p-4 text-gray-300">{user.email}</td>
                                <td className="p-4"><span className="px-2 py-1 text-xs font-semibold bg-blue-900/50 text-blue-300 rounded-full">{user.role}</span></td>
                                <td className="p-4 text-gray-400 text-xs">{(user.permissions || []).includes('access_loadcons') ? 'LoadCons operator' : (user.permissions || []).length ? (user.permissions || []).join(', ') : 'Role default'}</td>
                                <td className="p-4 text-gray-400">{user.assignedBranches.join(', ')}</td>
                                <td className="p-4">
                                    {(user as any).isActive === false
                                        ? <span className="text-xs font-semibold text-gray-500">Inactive</span>
                                        : <span className="text-xs font-semibold text-emerald-400">Active</span>}
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => setEditingUser(user)} className="px-3 py-1 rounded bg-gray-700 hover:bg-brand-secondary text-white text-xs font-bold">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <RoleAccessMatrix />

            <Modal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)}>
                <AddUserForm onSubmit={handleSubmitNewUser} onCancel={() => setIsAddUserModalOpen(false)} />
            </Modal>

            <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)}>
                {editingUser && <EditUserForm user={editingUser} onClose={() => setEditingUser(null)} />}
            </Modal>
            </>
            )}
        </>
    );
};

export default UserManagement;
