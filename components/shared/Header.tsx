import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Permission, ViewType, Vehicle, LoadConfirmation, JobCard, User } from '../../types';
import { FuelIcon } from '../icons/FuelIcon';
import { CarIcon } from '../icons/CarIcon';
import { DashboardIcon } from '../icons/DashboardIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { WorkshopIcon } from '../icons/WorkshopIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { CurrencyDollarIcon } from '../icons/CurrencyDollarIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { useUIState, useAuth, useOperations, useNotifications, useVehicles, useWorkshop } from '../../contexts/AppContexts';
import { BellIcon } from '../icons/BellIcon';
import { SearchIcon } from '../icons/SearchIcon';
import NotificationCenter from '../NotificationCenter';
import { useLiveAlerts } from '../../hooks/useLiveAlerts';

export const ALL_NAV_ITEMS: { view: ViewType, label: string, icon: React.ElementType, permission: Permission }[] = [
    { view: 'management', label: 'Management', icon: DashboardIcon, permission: 'access_management' },
    { view: 'fleet', label: 'Fleet', icon: CarIcon, permission: 'access_fleet' },
    { view: 'operations', label: 'Operations', icon: DocumentTextIcon, permission: 'access_operations' },
    { view: 'workshop', label: 'Workshop', icon: WorkshopIcon, permission: 'access_workshop' },
    { view: 'finance', label: 'Finance', icon: CurrencyDollarIcon, permission: 'access_finance' },
    { view: 'incidentManagement', label: 'Incidents', icon: ExclamationTriangleIcon, permission: 'access_incidents' },
    { view: 'hr', label: 'HR', icon: BriefcaseIcon, permission: 'access_hr' },
];

const NavButton: React.FC<{ view: ViewType; label: string; icon: React.ElementType; isActive: boolean; onClick: (view: ViewType) => void; isIconOnly?: boolean; }> = React.memo(({ view, label, icon: Icon, isActive, onClick, isIconOnly = false }) => {
    const activeClasses = "bg-blue-600 text-white shadow-lg shadow-blue-900/30 ring-1 ring-white/10";
    const inactiveClasses = "text-gray-400 hover:text-white hover:bg-gray-800/60";

    if (isIconOnly) {
        return (
            <button onClick={() => onClick(view)} className={`p-2.5 rounded-xl transition-all duration-200 ${isActive ? activeClasses : inactiveClasses}`} title={label}>
                <Icon className="h-5 w-5" />
            </button>
        );
    }
    return (
        <button onClick={() => onClick(view)} className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group whitespace-nowrap ${isActive ? activeClasses : inactiveClasses}`}>
            <Icon className={`h-5 w-5 mr-2.5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
            {label}
        </button>
    );
});

const OnlineStatus: React.FC<{ isOnline: boolean; pendingSyncCount: number }> = React.memo(({ isOnline, pendingSyncCount }) => {
    const statusColor = isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500';
    return (
        <div className="flex items-center space-x-2 text-[10px] font-bold tracking-tight bg-gray-800/50 px-2.5 py-1 rounded-full border border-gray-700/50">
            <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
            <span className={isOnline ? 'text-gray-300' : 'text-red-400'}>{isOnline ? 'LIVE' : 'OFFLINE'}</span>
            {pendingSyncCount > 0 && (
                <div className="flex items-center text-yellow-400 border-l border-gray-600/50 pl-2 ml-1" title={`${pendingSyncCount} item(s) waiting to sync`}>
                    <RefreshIcon className="h-3 w-3 mr-1" />
                    <span>{pendingSyncCount}</span>
                </div>
            )}
        </div>
    );
});

const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    
    const { vehicles = [], handleSelectVehicle } = useVehicles();
    const { loadConfirmations = [] } = useOperations();
    const { jobCards = [], users = [] } = useWorkshop();
    const { handleViewChange, showModal } = useUIState();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const results = useMemo(() => {
        if (!query || query.length < 2) return { vehicles: [], loads: [], jobs: [], users: [] };
        const q = query.toLowerCase();

        return {
            vehicles: (vehicles || []).filter((v: Vehicle) => v.name.toLowerCase().includes(q) || v.registration.toLowerCase().includes(q)).slice(0, 3),
            loads: (loadConfirmations || []).filter((l: LoadConfirmation) => l.loadConNumber.toLowerCase().includes(q) || l.collectionPoint.toLowerCase().includes(q) || l.deliveryPoint.toLowerCase().includes(q)).slice(0, 3),
            jobs: (jobCards || []).filter((j: JobCard) => j.itemDescription.toLowerCase().includes(q) || j.id.toLowerCase().includes(q)).slice(0, 3),
            users: (users || []).filter((u: User) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 3),
        };
    }, [query, vehicles, loadConfirmations, jobCards, users]);

    const hasResults = results.vehicles.length > 0 || results.loads.length > 0 || results.jobs.length > 0 || results.users.length > 0;

    const handleNavigate = (type: 'vehicle' | 'load' | 'job' | 'user', id: string) => {
        setIsOpen(false);
        setQuery('');
        
        switch(type) {
            case 'vehicle':
                handleViewChange('fleet');
                handleSelectVehicle(id);
                break;
            case 'load':
                handleViewChange('operations');
                break;
            case 'job':
                handleViewChange('workshop');
                showModal('jobCardDetail', { jobCardId: id });
                break;
            case 'user':
                handleViewChange('userManagement');
                break;
        }
    };

    return (
        <div className="relative hidden lg:block w-64 xl:w-72 2xl:w-80 transition-all duration-300 focus-within:w-96" ref={searchRef}>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <SearchIcon className="h-4.5 w-4.5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                    type="text"
                    className="bg-gray-800/40 text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-800 block w-full pl-11 p-2.5 border border-gray-700/50 focus:border-blue-500/50 placeholder-gray-500 transition-all duration-200"
                    placeholder="Search anything..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                {query && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => {setQuery(''); setIsOpen(false);}}>
                        <span className="text-[10px] font-bold bg-gray-700/50 px-1.5 py-0.5 rounded text-gray-400 hover:text-white transition-colors uppercase">Clear</span>
                    </div>
                )}
            </div>

            {isOpen && query && (
                <div className="absolute top-full mt-3 w-full bg-gray-800/98 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-700/60 overflow-hidden z-50 max-h-[32rem] overflow-y-auto ring-1 ring-black/40 animate-fade-in-down">
                    {!hasResults && <div className="p-6 text-gray-400 text-sm text-center italic">No matching records found.</div>}
                    
                    {results.vehicles.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Vehicles</div>
                            {results.vehicles.map(v => (
                                <div key={v.id} onClick={() => handleNavigate('vehicle', v.id)} className="px-4 py-3 hover:bg-blue-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-blue-900/20 rounded-lg mr-3.5 group-hover:bg-blue-600/20 transition-colors">
                                        <CarIcon className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-blue-400 transition-colors">{v.registration}</p>
                                        <p className="text-xs text-gray-500 group-hover:text-gray-400">{v.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {results.loads.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Loads</div>
                            {results.loads.map(l => (
                                <div key={l.id} onClick={() => handleNavigate('load', l.id)} className="px-4 py-3 hover:bg-emerald-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-emerald-900/20 rounded-lg mr-3.5 group-hover:bg-emerald-600/20 transition-colors">
                                        <DocumentTextIcon className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <div className="truncate min-w-0">
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-emerald-400 transition-colors">{l.loadConNumber}</p>
                                        <p className="text-xs text-gray-500 truncate">{l.collectionPoint} &rarr; {l.deliveryPoint}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {results.jobs.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Work Orders</div>
                            {results.jobs.map(j => (
                                <div key={j.id} onClick={() => handleNavigate('job', j.id)} className="px-4 py-3 hover:bg-orange-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-orange-900/20 rounded-lg mr-3.5 group-hover:bg-orange-600/20 transition-colors">
                                        <WorkshopIcon className="h-4 w-4 text-orange-400" />
                                    </div>
                                    <div className="truncate min-w-0">
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-orange-400 transition-colors truncate">{j.itemDescription}</p>
                                        <p className="text-xs text-gray-500">{j.status} • {j.priority} Priority</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                     {results.users.length > 0 && (
                        <div className="border-b border-gray-700/50 last:border-0">
                            <div className="px-4 py-2.5 text-[10px] font-black tracking-widest text-gray-500 uppercase bg-gray-900/40">Personnel</div>
                            {results.users.map(u => (
                                <div key={u.email} onClick={() => handleNavigate('user', u.email)} className="px-4 py-3 hover:bg-purple-600/10 cursor-pointer flex items-center group transition-all">
                                    <div className="p-2 bg-purple-900/20 rounded-lg mr-3.5 group-hover:bg-purple-600/20 transition-colors">
                                        <UsersIcon className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-100 group-hover:text-purple-400 transition-colors">{u.name}</p>
                                        <p className="text-xs text-gray-500">{u.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const Header: React.FC = () => {
    const { currentUser, handleLogout, hasPermission } = useAuth();
    const { currentView, isOnline, handleViewChange } = useUIState();
    const { unassignedJobCount = 0 } = useOperations();
    const { notifications = [] } = useNotifications();
    const liveAlerts = useLiveAlerts();
    const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
    const pendingSyncCount = 0;

    if (!currentUser) return null;

    // --- Computed Navigation Based on Custom Preferences ---
    const navItems = useMemo(() => {
        const prefs = currentUser.navigationPreferences;
        
        // 1. Get base allowed items
        const allowedBase = ALL_NAV_ITEMS.filter(item => hasPermission(item.permission));
        
        if (!prefs) return allowedBase;

        // 2. Sort according to custom order
        const sorted = [...allowedBase].sort((a, b) => {
            const indexA = prefs.order.indexOf(a.view);
            const indexB = prefs.order.indexOf(b.view);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        // 3. Filter out hidden ones
        return sorted.filter(item => !prefs.hidden.includes(item.view));
    }, [currentUser, hasPermission]);
    
    const settingsNavItems: { view: ViewType, label: string, icon: React.ElementType, permission: Permission }[] = [
         { view: 'userManagement', label: 'Users', icon: UsersIcon, permission: 'access_user_management' },
         { view: 'settings', label: 'Settings', icon: SettingsIcon, permission: 'access_settings' },
    ];
    
    return (
        <header className="bg-gray-900/95 backdrop-blur-2xl border-b border-gray-800/60 sticky top-0 z-40 shadow-xl ring-1 ring-white/5">
            <div className="w-full max-w-8xl mx-auto px-4 sm:px-6 lg:px-10">
                <div className="flex items-center justify-between h-20">
                    
                    {/* Left: Brand */}
                    <div className="flex-shrink-0 flex items-center pr-10">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-2xl shadow-2xl shadow-blue-900/40 ring-1 ring-white/20 transform transition-transform hover:scale-110 active:scale-95 cursor-pointer" onClick={() => handleViewChange('management')}>
                             <FuelIcon className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-4 hidden xl:block">
                             <h1 className="text-xl font-black text-white tracking-tighter leading-none">
                                FBN<span className="text-blue-500">Fleet</span>
                            </h1>
                            <p className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mt-0.5">Control Center</p>
                        </div>
                    </div>

                    {/* Center: Navigation */}
                    <nav className="flex-1 flex items-center space-x-1.5 overflow-x-auto scrollbar-hide py-3 no-scrollbar">
                        {navItems.map(item => (
                            <div key={item.view} className="relative flex-shrink-0">
                                <NavButton view={item.view} label={item.label} icon={item.icon} isActive={currentView === item.view} onClick={handleViewChange} isIconOnly={window.innerWidth < 1350} />
                                {item.view === 'operations' && unassignedJobCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-gray-900 text-[10px] font-black text-white shadow-lg shadow-red-900/60 animate-pulse">{unassignedJobCount}</span>
                                )}
                            </div>
                        ))}
                    </nav>

                    {/* Right: Actions & Profile */}
                    <div className="flex items-center space-x-4 sm:space-x-6 pl-8 border-l border-gray-800/80 h-11">
                        <GlobalSearch />
                        
                        <div className="flex items-center space-x-1">
                            <button 
                                onClick={() => setIsNotificationCenterOpen(prev => !prev)} 
                                className={`relative p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:scale-90 ${isNotificationCenterOpen ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
                                title="Notifications"
                            >
                                <BellIcon className="h-6 w-6" />
                                {(notifications.length + liveAlerts.length) > 0 && (
                                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-gray-900 shadow-sm">{notifications.length + liveAlerts.length}</span>
                                )}
                            </button>
                            {isNotificationCenterOpen && <NotificationCenter onClose={() => setIsNotificationCenterOpen(false)} />}
                             
                            <div className="hidden lg:flex items-center space-x-1">
                                {settingsNavItems.map(item => hasPermission(item.permission) && (
                                    <NavButton key={item.view} view={item.view} label={item.label} icon={item.icon} isActive={currentView === item.view} onClick={handleViewChange} isIconOnly={true}/>
                                ))}
                            </div>
                        </div>

                        <div className="hidden sm:flex items-center pl-6 border-l border-gray-800/80 h-full">
                            <div className="text-right mr-4 hidden md:block">
                                <p className="text-sm font-bold text-white leading-none truncate max-w-[120px]">{currentUser.name}</p>
                                <div className="flex items-center justify-end mt-1.5 gap-2.5">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none">{currentUser.role}</p>
                                    <OnlineStatus isOnline={isOnline} pendingSyncCount={pendingSyncCount} />
                                </div>
                            </div>
                            <div className="relative group cursor-pointer" onClick={() => handleViewChange('settings')}>
                                <div className="h-10.5 w-10.5 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 ring-2 ring-gray-600/40 flex items-center justify-center text-blue-400 font-black text-sm shadow-2xl group-hover:ring-blue-500/60 transition-all duration-300 transform group-hover:rotate-6">
                                    {currentUser.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-gray-900 shadow-sm"></div>
                            </div>
                             <button onClick={handleLogout} className="ml-5 p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 group" title="Logout Session">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-0.5 transition-transform">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                </svg>
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default React.memo(Header);