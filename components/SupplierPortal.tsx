
import React, { useState } from 'react';
import { useAuth, useOperations } from '../contexts/AppContexts';
import { HomeIcon } from './icons/HomeIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { UsersIcon } from './icons/UsersIcon';
import { TruckIcon } from './icons/TruckIcon';
import { CurrencyDollarIcon } from './icons/CurrencyDollarIcon';
import SupplierLoadList from './supplier/SupplierLoadList';
import SupplierDocuments from './supplier/SupplierDocuments';
import SupplierProfile from './supplier/SupplierProfile';
import SupplierFleetRates from './supplier/SupplierFleetRates';
import SupplierRfqList from './supplier/SupplierRfqList';
import SupplierDashboard from './supplier/SupplierDashboard';
import { MailIcon } from './icons/MailIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import { RfqRequest } from '../types';

type SupplierView = 'dashboard' | 'loads' | 'rfqs' | 'compliance' | 'profile' | 'fleet_rates';

const SupplierPortal: React.FC = () => {
    const { currentUser, handleLogout, viewingSupplierAsAdmin, setViewSupplierAsAdmin } = useAuth();
    const { loadConfirmations, suppliers, rfqRequests = [] } = useOperations() as any;
    const [activeView, setActiveView] = useState<SupplierView>('dashboard');

    const user = viewingSupplierAsAdmin || currentUser;
    if (!user || !user.supplierId) return null;

    const supplier = suppliers.find((s: any) => s.id === user.supplierId);
    if (!supplier) return <p className="text-white p-20 text-center">Supplier data not found. Please contact support.</p>;

    const supplierLoads = loadConfirmations.filter((lc: any) => lc.supplierId === user.supplierId);
    const openRfqs = (rfqRequests as RfqRequest[]).filter(r => r.status === 'Open'
        && r.recipients.some(rec => rec.supplierId === user.supplierId)
        && !r.quotes.some(q => q.supplierId === user.supplierId)).length;

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, badge: 0 },
        { id: 'loads', label: 'My Loads', icon: DocumentTextIcon, badge: 0 },
        { id: 'rfqs', label: 'Quote Requests', icon: MailIcon, badge: openRfqs },
        { id: 'compliance', label: 'Compliance Vault', icon: UsersIcon, badge: 0 },
        { id: 'fleet_rates', label: 'Fleet & Rates', icon: TruckIcon, badge: 0 },
        { id: 'profile', label: 'Company Profile', icon: HomeIcon, badge: 0 },
    ];

    const renderContent = () => {
        switch (activeView) {
            case 'dashboard': return <SupplierDashboard supplier={supplier} onNavigate={(v) => setActiveView(v as SupplierView)} />;
            case 'rfqs': return <SupplierRfqList supplier={supplier} />;
            case 'compliance': return <SupplierDocuments supplier={supplier} />;
            case 'fleet_rates': return <SupplierFleetRates supplier={supplier} />;
            case 'profile': return <SupplierProfile supplier={supplier} />;
            case 'loads': return <SupplierLoadList loadConfirmations={supplierLoads} />;
            default: return <SupplierDashboard supplier={supplier} onNavigate={(v) => setActiveView(v as SupplierView)} />;
        }
    };
    
    return (
        <div className="min-h-screen bg-[#0a0f1a] text-gray-100 flex overflow-hidden">
            {/* Modern Sidebar */}
            <aside className="w-72 bg-[#111827] border-r border-white/5 flex flex-col shadow-2xl">
                 <div className="p-8 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                             <TruckIcon className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-xl font-black text-white tracking-tighter">CarrierPortal</h2>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Carrier</p>
                        <p className="text-sm font-bold text-white truncate">{supplier.name}</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                    {navItems.map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveView(item.id as SupplierView)} 
                            className={`flex items-center w-full p-3.5 rounded-xl text-sm font-bold transition-all ${activeView === item.id ? 'bg-brand-primary text-white shadow-lg shadow-blue-900/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <item.icon className="h-5 w-5 mr-3" />
                            <span className="flex-grow text-left">{item.label}</span>
                            {item.badge > 0 && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">{item.badge}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-6 border-t border-white/5 space-y-4">
                    <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Compliance Status</p>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                        </div>
                        <p className="text-sm font-bold text-emerald-200">Fully Compliant</p>
                    </div>
                    {viewingSupplierAsAdmin ? (
                        <button onClick={() => setViewSupplierAsAdmin(null)} className="w-full flex items-center justify-center p-3 rounded-xl text-sm font-bold text-yellow-300 bg-yellow-900/30 hover:bg-yellow-800/40 transition-all border border-yellow-500/20">
                            ← Return to Admin View
                        </button>
                    ) : (
                        <button onClick={handleLogout} className="w-full flex items-center justify-center p-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all border border-red-500/10">
                            Logout Session
                        </button>
                    )}
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto bg-[#0a0f1a] relative">
                <div className="p-10 max-w-6xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default SupplierPortal;
