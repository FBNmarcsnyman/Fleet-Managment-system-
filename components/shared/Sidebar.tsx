import React, { useMemo, useState } from 'react';
import { ViewType } from '../../types';
import { useUIState, useAuth, useOperations } from '../../contexts/AppContexts';
import { ALL_NAV_ENTRIES, SETTINGS_NAV_ITEMS, NavItem, NavGroup, isGroup } from './navConfig';

const NavLink: React.FC<{
    item: NavItem;
    isActive: boolean;
    onClick: (item: NavItem) => void;
    badge?: number;
    nested?: boolean;
}> = ({ item, isActive, onClick, badge, nested }) => {
    const Icon = item.icon;
    return (
        <button
            onClick={() => onClick(item)}
            title={item.label}
            className={`relative w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${nested ? 'lg:pl-9' : ''}
                ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 ring-1 ring-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
        >
            <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
            <span className="ml-3 inline md:hidden lg:inline truncate">{item.label}</span>
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
    const { currentView, partnersSubView, handleViewChange, handlePartnersSubViewChange, sidebarOpen, setSidebarOpen } = useUIState();
    const { unassignedJobCount = 0 } = useOperations();
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    if (!currentUser) return null;

    // On mobile the sidebar is an off-canvas drawer; tapping a nav item navigates
    // AND closes it. On desktop it's always docked (the close is a no-op there).
    const navTo = (item: NavItem) => {
        if (item.subView) handlePartnersSubViewChange(item.subView);
        handleViewChange(item.view);
        setSidebarOpen(false);
    };

    // A destination is active when its view matches — and, for sub-view links
    // (Accounts > Clients / Transporters share the 'partners' view), when the
    // active sub-tab matches too, so only the right child highlights.
    const isItemActive = (item: NavItem) =>
        currentView === item.view && (!item.subView || partnersSubView === item.subView);

    const canSee = (item: NavItem) => hasPermission(item.permission) || (!!item.altPermission && hasPermission(item.altPermission));
    const hidden = currentUser.navigationPreferences?.hidden || [];
    const notHidden = (item: NavItem) => !hidden.includes(item.view);

    // Build the visible tree: keep permitted, non-hidden leaves; for groups keep
    // their visible children and drop any group left empty.
    const entries = useMemo(() => {
        const out: ({ kind: 'leaf'; item: NavItem } | { kind: 'group'; group: NavGroup; children: NavItem[] })[] = [];
        for (const e of ALL_NAV_ENTRIES) {
            if (isGroup(e)) {
                const children = e.children.filter(c => canSee(c) && notHidden(c));
                if (children.length) out.push({ kind: 'group', group: e, children });
            } else if (canSee(e) && notHidden(e)) {
                out.push({ kind: 'leaf', item: e });
            }
        }
        return out;
    }, [currentUser, hasPermission]);

    const badgeFor = (item: NavItem) => item.badgeKey === 'broking' ? unassignedJobCount : undefined;
    const settingsItems = SETTINGS_NAV_ITEMS.filter(item => hasPermission(item.permission));

    return (
        <>
        {/* Mobile backdrop — tap to close the drawer */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
        <aside className={`fixed md:sticky inset-y-0 left-0 top-0 h-screen z-50 w-64 md:w-[76px] lg:w-64 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 bg-white border-r border-slate-200 flex flex-col shadow-sm shrink-0`}>
            {/* Brand */}
            <div className="flex items-center gap-3 px-3 h-20 shrink-0 border-b border-slate-200 overflow-hidden">
                <img src="/fbn-logo.jpg" alt="FBN Transport" onClick={() => handleViewChange('management')}
                    onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith('.svg')) t.src = '/fbn-logo.svg'; }}
                    className="h-9 w-auto object-contain cursor-pointer shrink-0" />
                <div className="block md:hidden lg:block min-w-0">
                    <p className="text-[11px] font-black text-[#13294b] tracking-[0.12em] uppercase leading-none">Control Centre</p>
                    <p className="text-[8px] font-bold text-slate-500 tracking-[0.03em] uppercase mt-1 leading-tight">Commercial Freight Specialists</p>
                </div>
            </div>

            {/* Primary navigation */}
            <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-1.5">
                <p className="block md:hidden lg:block px-3 pb-1 text-[10px] font-black tracking-widest text-gray-600 uppercase">Menu</p>
                {entries.map(entry => {
                    if (entry.kind === 'leaf') {
                        return <NavLink key={entry.item.view} item={entry.item} isActive={isItemActive(entry.item)} onClick={navTo} badge={badgeFor(entry.item)} />;
                    }
                    const { group, children } = entry;
                    const Icon = group.icon;
                    const open = !collapsedGroups[group.key];
                    const childActive = children.some(isItemActive);
                    const childBadge = children.reduce((n, c) => n + (badgeFor(c) || 0), 0);
                    return (
                        <div key={group.key}>
                            <button
                                onClick={() => setCollapsedGroups(p => ({ ...p, [group.key]: !p[group.key] }))}
                                title={group.label}
                                className={`relative w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group
                                    ${childActive && !open ? 'text-blue-700 bg-blue-50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                            >
                                <Icon className="h-5 w-5 shrink-0 text-gray-500" />
                                <span className="ml-3 inline md:hidden lg:inline truncate uppercase tracking-wide text-[12px]">{group.label}</span>
                                {!open && childBadge > 0 && (
                                    <span className="absolute lg:static lg:ml-auto -top-0.5 -right-0.5 lg:top-auto lg:right-auto flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-red-500 lg:ring-0 ring-2 ring-gray-900 text-[10px] font-black text-white">{childBadge}</span>
                                )}
                                <svg className={`hidden lg:block ml-auto h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 5l6 5-6 5V5z" clipRule="evenodd" /></svg>
                            </button>
                            {open && (
                                <div className="mt-1 space-y-1 lg:border-l lg:border-slate-200 lg:ml-4">
                                    {children.map(c => (
                                        <NavLink key={`${c.view}:${c.subView || ''}`} item={c} isActive={isItemActive(c)} onClick={navTo} badge={badgeFor(c)} nested />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Admin / settings */}
            {settingsItems.length > 0 && (
                <div className="px-3 py-3 border-t border-gray-800/60 space-y-1.5">
                    {settingsItems.map(item => (
                        <NavLink key={item.view} item={item} isActive={currentView === item.view} onClick={navTo} />
                    ))}
                </div>
            )}

            {/* User + logout */}
            <div className="px-3 py-3 border-t border-gray-800/60 flex items-center">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 ring-2 ring-gray-600/40 flex items-center justify-center text-blue-400 font-black text-sm cursor-pointer hover:ring-blue-500/60 transition-all" onClick={() => handleViewChange('settings')}>
                    {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3 block md:hidden lg:block min-w-0 flex-1">
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
        </>
    );
};

export default React.memo(Sidebar);
