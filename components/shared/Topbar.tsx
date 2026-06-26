import React, { useState } from 'react';
import { useUIState, useAuth, useNotifications } from '../../contexts/AppContexts';
import { BellIcon } from '../icons/BellIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import NotificationCenter from '../NotificationCenter';
import GlobalSearch from './GlobalSearch';
import TestModeToggle from './TestModeToggle';
import WhatsAppToggle from './WhatsAppToggle';
import ClientTrackToggle from './ClientTrackToggle';
import { VIEW_TITLES } from './navConfig';
import { useLiveAlerts } from '../../hooks/useLiveAlerts';
import { enablePush, isPushSupported, pushAlreadyEnabled } from '../../lib/push';

const OnlineStatus: React.FC<{ isOnline: boolean }> = React.memo(({ isOnline }) => (
    <div className="hidden sm:flex items-center space-x-2 text-[10px] font-bold tracking-tight bg-gray-800/50 px-2.5 py-1 rounded-full border border-gray-700/50">
        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`}></span>
        <span className={isOnline ? 'text-gray-300' : 'text-red-400'}>{isOnline ? 'LIVE' : 'OFFLINE'}</span>
    </div>
));

const Topbar: React.FC = () => {
    const { currentUser } = useAuth();
    const [pushOn, setPushOn] = useState(pushAlreadyEnabled());
    const turnOnPush = async () => {
        const r = await enablePush(currentUser?.id);
        if (r.ok) { setPushOn(true); alert('Notifications enabled on this device. 🔔'); }
        else alert(r.error || 'Could not enable notifications.');
    };
    const { currentView, isOnline, setSidebarOpen } = useUIState();
    const { notifications = [] } = useNotifications();
    const liveAlerts = useLiveAlerts();
    const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

    if (!currentUser) return null;

    const title = VIEW_TITLES[currentView] || 'Dashboard';
    const alertCount = notifications.length + liveAlerts.length;

    return (
        <header className="bg-gray-900/95 backdrop-blur-2xl border-b border-gray-800/60 sticky top-0 z-30 ring-1 ring-white/5">
            <div className="flex items-center justify-between h-20 px-4 sm:px-6 lg:px-8 gap-4 max-w-[1600px] mx-auto w-full">
                {/* Mobile menu (hamburger) — opens the sidebar drawer */}
                <button onClick={() => setSidebarOpen(true)} title="Menu"
                    className="md:hidden shrink-0 p-2 -ml-1 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800/60">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                </button>

                {/* Page title */}
                <div className="min-w-0 shrink-0">
                    <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">{title}</h2>
                    <p className="hidden sm:block text-[11px] font-bold text-gray-500 tracking-wide mt-0.5">Welcome back, {currentUser.name.split(' ')[0]}</p>
                </div>

                {/* Search */}
                <div className="flex-1 flex justify-center px-2">
                    <GlobalSearch />
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
                    <TestModeToggle />
                    <WhatsAppToggle />
                    <ClientTrackToggle />
                    <OnlineStatus isOnline={isOnline} />
                    {isPushSupported() && !pushOn && (
                        <button onClick={turnOnPush} title="Get push notifications on this device"
                            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-blue-300 hover:text-white bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 px-2.5 py-1.5 rounded-lg">
                            🔔 Enable alerts
                        </button>
                    )}
                    <div className="relative">
                        <button
                            onClick={() => setIsNotificationCenterOpen(prev => !prev)}
                            className={`relative p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:scale-90 ${isNotificationCenterOpen ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
                            title="Notifications"
                        >
                            <BellIcon className="h-6 w-6" />
                            {alertCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-gray-900 shadow-sm">{alertCount}</span>
                            )}
                        </button>
                        {isNotificationCenterOpen && <NotificationCenter onClose={() => setIsNotificationCenterOpen(false)} />}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default React.memo(Topbar);
