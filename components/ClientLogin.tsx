import React, { useState } from 'react';
import { User } from '../types';
import { FuelIcon } from './icons/FuelIcon';
import { useAuth } from '../contexts/AppContexts';

interface ClientLoginProps {
    clientUsers: User[];
}

const ClientLogin: React.FC<ClientLoginProps> = ({ clientUsers }) => {
    const { handleLogin } = useAuth();
    const [selectedUser, setSelectedUser] = useState(clientUsers[0]?.email || '');

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
                        Client Portal
                    </h1>
                    <p className="mt-2 text-gray-400">Please sign in to track your shipments.</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                     <div>
                        <label htmlFor="user-select" className="block text-sm font-medium text-gray-300 mb-1">
                           Select your company to login:
                        </label>
                        <select
                            id="user-select"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                        >
                            {clientUsers.map(user => (
                                <option key={user.email} value={user.email}>
                                    {user.name}
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
            </div>
        </div>
    );
};

export default ClientLogin;