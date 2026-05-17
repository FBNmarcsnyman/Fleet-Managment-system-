import React, { useState } from 'react';
import { useWorkshop } from '../contexts/AppContexts';
import Modal from './Modal';
import AddUserForm from './AddUserForm';
import { PlusIcon } from './icons/PlusIcon';
import { User } from '../types';

const UserManagement: React.FC = () => {
    const { users, handleAddUser } = useWorkshop();
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

    const handleSubmitNewUser = (user: Omit<User, 'permissions' | 'assignedVehicleIds'>) => {
        handleAddUser(user);
        setIsAddUserModalOpen(false);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">User Management</h2>
                <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Add User
                </button>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-4 text-gray-300">Name</th>
                            <th className="p-4 text-gray-300">Email</th>
                            <th className="p-4 text-gray-300">Role</th>
                            <th className="p-4 text-gray-300">Assigned Branches</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user: User) => (
                            <tr key={user.email} className="border-b border-gray-700">
                                <td className="p-4 font-medium text-white">{user.name}</td>
                                <td className="p-4 text-gray-300">{user.email}</td>
                                <td className="p-4"><span className="px-2 py-1 text-xs font-semibold bg-blue-900/50 text-blue-300 rounded-full">{user.role}</span></td>
                                <td className="p-4 text-gray-400">{user.assignedBranches.join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)}>
                <AddUserForm onSubmit={handleSubmitNewUser} onCancel={() => setIsAddUserModalOpen(false)} />
            </Modal>
        </>
    );
};

export default UserManagement;