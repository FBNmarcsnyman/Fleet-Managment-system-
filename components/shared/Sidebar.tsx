import React, { useMemo } from 'react';
import { ViewType } from '../../types';
import { FuelIcon } from '../icons/FuelIcon';
import { useUIState, useAuth, useOperations } from '../../contexts/AppContexts';
import { ALL_NAV_ITEMS, SETTINGS_NAV_ITEMS, NavItem } from './navConfig';

const NavLink: React.FC<{
    item: NavItem;
    isActive: boolean;
    onClick: (view: ViewType) => void;
    badge?: number;
}> = ({ item, isActive, onClick, badge }) => {
    const Icon = item.icon;
    return (
        <button
            onClick={() => onClick(item.view)}
            title={item.label}
            className={`relative w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group
                ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 ring-1 ring-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
        >
            <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
            <span className="ml-3 hidden lg:inline truncate">{item.label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="absolute lg:static lg:ml-auto -top-0.5 -right-0.5 lg:top-auto lg:right-auto flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-red-500 ring-2 ring-gray-900 lg:ring-0 text-[10px] font-black text-white shadow-lg shadow-red-900/60 animate-pulse">
                    {badge}
                </span>
            )}
        </button>
    );
};

const Sidebar: React.FC = () => {
    const { currentUser, hasPermission, handleLogout } = useAuth();
    const { currentView, handleViewChange } = useUIState();
    const { unassignedJobCount = 0 } = useOperations();

    if (!currentUser) return null;

    // Respect the user's saved order + hidden preferences (same as before).
    const navItems = useMemo(() => {
        const prefs = currentUser.navigationPreferences;
        const allowedBase = ALL_NAV_ITEMS.filter(item => hasPermission(item.permission));
        if (!prefs) return allowedBase;
        const sorted = [...allowedBase].sort((a, b) => {
            const indexA = prefs.order.indexOf(a.view);
            const indexB = prefs.order.indexOf(b.view);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
        return sorted.filter(item => !prefs.hidden.includes(item.view));
    }, [currentUser, hasPermission]);

    const settingsItems = SETTINGS_NAV_ITEMS.filter(item => hasPermission(item.permission));

    return (
        <aside className="shrink-0 w-[76px] lg:w-64 bg-gray-900/95 border-r border-gray-800/60 sticky top-0 h-screen flex flex-col z-40 ring-1 ring-white/5">
            {/* Brand */}
            <div className="flex items-center gap-3 px-3 h-20 shrink-0 border-b border-slate-200 overflow-hidden">
                <img src="/fbn-logo.jpg" alt="FBN Transport" onClick={() => handleViewChange('management')}
                    onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith('.svg')) t.src = '/fbn-logo.svg'; }}
                    className="h-9 w-auto object-contain cursor-pointer shrink-0" />
                <div className="hidden lg:block min-w-0">
                    <p className="text-[11px] font-black text-[#13294b] tracking-[0.18em] uppercase leading-none">Control Centre</p>
                    <p className="text-[9px] font-bold text-slate-500 tracking-[0.12em] uppercase mt-1 truncate">Commercial Freight Specialists</p>
                </div>
            </div>

            {/* Primary navigation */}
            <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-1.5">
                <p className="hidden lg:block px-3 pb-1 text-[10px] font-black tracking-widest text-gray-600 uppercase">Menu</p>
                {navItems.map(item => (
                    <NavLink
                        key={item.view}
                        item={item}
                        isActive={currentView === item.view}
                        onClick={handleViewChange}
                        badge={item.view === 'operations' ? unassignedJobCount : undefined}
                    />
                ))}
            </nav>

            {/* Admin / settings */}
            {settingsItems.length > 0 && (
                <div className="px-3 py-3 border-t border-gray-800/60 space-y-1.5">
                    {settingsItems.map(item => (
                        <NavLink key={item.view} item={item} isActive={currentView === item.view} onClick={handleViewChange} />
                    ))}
                </div>
            )}

            {/* User + logout */}
            <div className="px-3 py-3 border-t border-gray-800/60 flex items-center">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 ring-2 ring-gray-600/40 flex items-center justify-center text-blue-400 font-black text-sm cursor-pointer hover:ring-blue-500/60 transition-all" onClick={() => handleViewChange('settings')}>
                    {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3 hidden lg:block min-w-0 flex-1">
                    <p className="text-sm font-bold text-white leading-none truncate">{currentUser.name}</p>
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">{currentUser.role}</p>
                </div>
                <button onClick={handleLogout} title="Logout" className="ml-1 p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 group shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-0.5 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                </button>
            </div>
        </aside>
    );
};

export default React.memo(Sidebar);
