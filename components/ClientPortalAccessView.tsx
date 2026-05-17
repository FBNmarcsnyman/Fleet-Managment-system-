import React from 'react';
import { User } from '../types';
import { EyeIcon } from './icons/EyeIcon';

interface ClientPortalAccessViewProps {
    users: User[];
    onViewPortal: (clientUser: User) => void;
}

const ClientPortalAccessView: React.FC<ClientPortalAccessViewProps> = ({ users = [], onViewPortal }) => {
    const clientUsers = (users || []).filter(u => u.role === 'Client');

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Client Portal Access</h3>
            <p className="text-gray-400 mb-6 text-sm">Select a client to view their portal as if you were logged in as them. This allows you to provide support, create bookings on their behalf, and see what they see.</p>
            <div className="space-y-3">
                {clientUsers.map(client => (
                    <div key={client.email} className="bg-gray-700/50 p-3 rounded-md flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-white">{client.name}</p>
                            <p className="text-xs text-gray-400">{client.email}</p>
                        </div>
                        <button 
                            onClick={() => onViewPortal(client)}
                            className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white text-sm"
                        >
                            <EyeIcon className="h-4 w-4 mr-2" />
                            View Portal
                        </button>
                    </div>
                ))}
                {clientUsers.length === 0 && <p className="text-gray-500 py-10 text-center italic">No client users registered in the system.</p>}
            </div>
        </div>
    );
};

export default ClientPortalAccessView;