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

const UserManagement: React.FC = () => {
    const { users, handleAddUser } = useCommonData();
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [tab, setTab] = useState<'team' | 'portal'>('team');
    const staffUsers = (users || []).filter((u: User) => !EXTERNAL_ROLES.includes(u.role as string));

    const handleSubmitNewUser = async (user: Omit<User, 'permissions' | 'assignedVehicleIds'>) => {
        const res = await handleAddUser(user);
        if (!res.ok) { alert(`Could not add the user: ${res.error || 'unknown error'}`); return; }
        setIsAddUserModalOpen(false);
        alert(`User created.\n\nEmail: ${user.email}\nTemporary password: ${res.tempPassword}\n\nShare these with them — they can change the password after logging in.`);
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
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-4 text-gray-300">Name</th>
                            <th className="p-4 text-gray-300">Email</th>
                            <th className="p-4 text-gray-300">Role</th>
                            <th className="p-4 text-gray-300">Assigned Branches</th>
                            <th className="p-4 text-gray-300">Status</th>
                            <th className="p-4 text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffUsers.map((user: User) => (
                            <tr key={user.email} className="border-b border-gray-700">
                                <td className="p-4 font-medium text-white">{user.name}</td>
                                <td className="p-4 text-gray-300">{user.email}</td>
                                <td className="p-4"><span className="px-2 py-1 text-xs font-semibold bg-blue-900/50 text-blue-300 rounded-full">{user.role}</span></td>
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