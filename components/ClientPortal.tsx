import React, { useState } from 'react';
import { useAuth, useOperations } from '../contexts/AppContexts';
import { DashboardIcon } from './icons/DashboardIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TruckIcon } from './icons/TruckIcon';
import { MailIcon } from './icons/MailIcon';
import { CurrencyDollarIcon } from './icons/CurrencyDollarIcon';
import ClientDashboard from './client/ClientDashboard';
import ClientQuoteRequestForm from './client/ClientQuoteRequestForm';
import ClientQuotesView from './client/ClientQuotesView';
import ClientFinancials from './client/ClientFinancials';
import ClientDashboardView from './ClientDashboardView';

type ClientView = 'dashboard' | 'request' | 'quotes' | 'loads' | 'financial';

const ClientPortal: React.FC = () => {
    const { currentUser, handleLogout, viewingClientAsAdmin, setViewClientAsAdmin } = useAuth();
    const { loadConfirmations = [], clients = [] } = useOperations() as any;
    const [activeView, setActiveView] = useState<ClientView>('dashboard');

    const user = viewingClientAsAdmin || currentUser;
    if (!user) return null;
    const client = (clients as any[]).find(c => c.id === user.clientId);
    const clientName = client?.name || user.name;
    const userLoads = (loadConfirmations as any[]).filter(lc => lc.clientId === user.clientId);

    const nav: { id: ClientView; label: string; icon: React.ElementType }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
        { id: 'request', label: 'Request a Quote', icon: PlusIcon },
        { id: 'quotes', label: 'My Quotes', icon: MailIcon },
        { id: 'loads', label: 'My Loads', icon: TruckIcon },
        { id: 'financial', label: 'Financial Documents', icon: CurrencyDollarIcon },
    ];

    const renderContent = () => {
        switch (activeView) {
            case 'request': return <ClientQuoteRequestForm clientId={user.clientId} onDone={() => setActiveView('quotes')} />;
            case 'quotes': return <ClientQuotesView clientId={user.clientId} onRequest={() => setActiveView('request')} />;
            case 'loads': return <ClientDashboardView loadConfirmations={userLoads} />;
            case 'financial': return <ClientFinancials clientId={user.clientId} />;
            case 'dashboard':
            default: return <ClientDashboard clientId={user.clientId} clientName={clientName} onNavigate={(v) => setActiveView(v as ClientView)} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex overflow-hidden">
            <aside className="w-72 bg-[#13294b] border-r border-[#1d3a66] flex flex-col shadow-2xl">
                <div className="p-8 border-b border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: '#f5b700' }}><TruckIcon className="h-6 w-6 text-[#13294b]" /></div>
                        <h2 className="text-xl font-black text-white tracking-tighter">Client Portal</h2>
                    </div>
                    <div className="bg-white/10 p-3 rounded-xl">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Account</p>
                        <p className="text-sm font-bold text-white truncate">{clientName}</p>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                    {nav.map(item => (
                        <button key={item.id} onClick={() => setActiveView(item.id)}
                            className={`flex items-center w-full p-3.5 rounded-xl text-sm font-bold transition-all ${activeView === item.id ? 'bg-[#f5b700] text-[#13294b] shadow-lg' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                            <item.icon className="h-5 w-5 mr-3" />
                            <span className="flex-grow text-left">{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-6 border-t border-white/10">
                    {viewingClientAsAdmin ? (
                        <button onClick={() => setViewClientAsAdmin(null)} className="w-full flex items-center justify-center p-3 rounded-xl text-sm font-bold text-yellow-300 bg-yellow-900/30 hover:bg-yellow-800/40 transition-all border border-yellow-500/20">← Return to Admin View</button>
                    ) : (
                        <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 rounded-xl text-sm font-bold text-red-300 hover:bg-red-500/20 transition-all border border-red-400/20">Logout Session</button>
                    )}
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto bg-slate-100 relative">
                <div className="p-10 max-w-6xl mx-auto">{renderContent()}</div>
            </main>
        </div>
    );
};

export default ClientPortal;
