
import React, { useState } from 'react';
import { useAuth, useWorkshop } from '../contexts/AppContexts';
import { FuelIcon } from './icons/FuelIcon';

const Login: React.FC = () => {
    const { handleLogin } = useAuth();
    const { users } = useWorkshop();
    const [selectedUser, setSelectedUser] = useState(users[0]?.email || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedUser) {
            handleLogin(selectedUser);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-sm p-8 space-y-8 bg-gray-800 rounded-lg shadow-2xl">
                <div className="text-center">
                    <FuelIcon className="w-16 h-16 mx-auto text-brand-secondary" />
                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
                        Fleet Management
                    </h1>
                    <p className="mt-2 text-gray-400">Please sign in to continue</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                     <div>
                        <label htmlFor="user-select" className="block text-sm font-medium text-gray-300 mb-1">
                            Select a user to login:
                        </label>
                        <select
                            id="user-select"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                        >
                            {users.filter(u => u.role !== 'Client' && u.role !== 'Supplier').map(user => (
                                <option key={user.email} value={user.email}>
                                    {user.name} ({user.role})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                        >
                            Sign In
                        </button>
                    </div>
                </form>
                <div className="text-center text-sm">
                    <a href="/?portal=become-supplier" className="font-medium text-brand-secondary hover:text-blue-400">
                        Become a Supplier
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Login;
