import React, { useState } from 'react';
import { useAuth, useOperations } from '../contexts/AppContexts';
import { User, LoadConfirmation } from '../types';
import { HomeIcon } from './icons/HomeIcon';
import { PlusIcon } from './icons/PlusIcon';
import { ExitIcon } from './icons/ExitIcon';
import ClientDashboardView from './ClientDashboardView';
import ClientBookingForm from './ClientBookingForm';

type ClientView = 'dashboard' | 'new_booking';

const ClientPortal: React.FC = () => {
    const { currentUser, handleLogout, viewingClientAsAdmin, setViewClientAsAdmin } = useAuth();
    const { loadConfirmations, handleCreateQuote } = useOperations();
    const [activeView, setActiveView] = useState<ClientView>('dashboard');

    const user = viewingClientAsAdmin || currentUser;
    if (!user) return null;

    const userLoadConfirmations = loadConfirmations.filter(lc => lc.clientId === user.clientId);

    const NavButton: React.FC<{ view: ClientView, label: string, icon: React.ElementType }> = ({ view, label, icon: Icon }) => (
        <button
            onClick={() => setActiveView(view)}
            className={`flex items-center space-x-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors w-full ${activeView === view ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
        >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
        </button>
    );

    const renderContent = () => {
        switch (activeView) {
            case 'new_booking':
                return <ClientBookingForm currentUser={user} onCreateQuote={handleCreateQuote} />;
            case 'dashboard':
            default:
                return <ClientDashboardView loadConfirmations={userLoadConfirmations} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex">
            <aside className="w-64 bg-gray-800 p-4 flex flex-col">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white">Client Portal</h2>
                    <p className="text-sm text-gray-400">{user.name}</p>
                </div>
                <nav className="space-y-2">
                    <NavButton view="dashboard" label="My Shipments" icon={HomeIcon} />
                    <NavButton view="new_booking" label="New Booking" icon={PlusIcon} />
                </nav>
                <div className="mt-auto">
                    {viewingClientAsAdmin && (
                        <button onClick={() => setViewClientAsAdmin(null)} className="flex items-center w-full text-left p-2 rounded-md text-sm font-semibold text-yellow-300 bg-yellow-900/50 hover:bg-yellow-800/50 mb-2">
                            <ExitIcon className="h-5 w-5 mr-2" /> Return to Admin View
                        </button>
                    )}
                    <button onClick={handleLogout} className="w-full text-left p-2 rounded-md text-sm text-gray-400 hover:bg-red-900/50 hover:text-red-300">
                        Logout
                    </button>
                </div>
            </aside>
            <main className="flex-1 p-8">
                {renderContent()}
            </main>
        </div>
    );
};

export default ClientPortal;