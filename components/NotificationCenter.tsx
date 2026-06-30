import React, { useState } from 'react';
import { useNotifications, useUIState, useOperations } from '../contexts/AppContexts';
import { Notification, NotificationType } from '../types';
import { useLiveAlerts } from '../hooks/useLiveAlerts';
import { formatDistanceToNow } from 'date-fns';
import { WrenchIcon } from './icons/WrenchIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { ArchiveBoxIcon } from './icons/ArchiveBoxIcon';
import { CurrencyDollarIcon } from './icons/CurrencyDollarIcon';
import { UsersIcon } from './icons/UsersIcon';
import { XIcon } from './icons/XIcon';

interface NotificationCenterProps { onClose: () => void; }

// Live alerts are derived from current state (off-road vehicle, expiring docs…),
// so they can't be "deleted" — instead the user can mute them for this browser
// session. Kept module-level so it survives the panel closing/reopening.
const mutedLive = new Set<string>();

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
    const { notifications, handleDismissNotification, handleDismissAllNotifications } = useNotifications();
    const { handleViewChange, showModal } = useUIState();
    const { loadConfirmations = [] } = useOperations() as any;
    const liveAlertsRaw = useLiveAlerts();
    const [, force] = useState(0);

    const liveAlerts = liveAlertsRaw.filter(a => !mutedLive.has(a.id));
    const liveIds = new Set(liveAlerts.map(a => a.id));
    const combined = [...liveAlerts, ...notifications];

    // Navigate to the thing the notification is about. Loads open their detail
    // modal directly; everything else jumps to the right section.
    const handleAct = (n: Notification) => {
        const id = n.id || '';
        const loadId = id.startsWith('noncomp-') ? id.slice('noncomp-'.length)
            : id.startsWith('load-') ? id.slice('load-'.length) : (n as any).loadId;
        const load = loadId && (loadConfirmations as any[]).find((l: any) => l.id === loadId);
        if (load) { showModal('loadDetail', { loadCon: load }); }
        else if (n.link?.view) { handleViewChange(n.link.view); }
        if (!liveIds.has(n.id)) handleDismissNotification(n.id); else mutedLive.add(n.id);
        onClose();
    };

    const dismissOne = (n: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (liveIds.has(n.id)) { mutedLive.add(n.id); force(x => x + 1); }
        else handleDismissNotification(n.id);
    };

    const clearAll = () => {
        liveAlerts.forEach(a => mutedLive.add(a.id));
        handleDismissAllNotifications();
        force(x => x + 1);
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'JOB_CARD': return <ClipboardIcon className="h-5 w-5 text-amber-400" />;
            case 'SERVICE': return <WrenchIcon className="h-5 w-5 text-red-400" />;
            case 'INVENTORY': return <ArchiveBoxIcon className="h-5 w-5 text-orange-400" />;
            case 'PURCHASE': return <CurrencyDollarIcon className="h-5 w-5 text-purple-400" />;
            case 'ONBOARDING': return <UsersIcon className="h-5 w-5 text-green-400" />;
            case 'RFQ': return <CurrencyDollarIcon className="h-5 w-5 text-blue-400" />;
            default: return <ClipboardIcon className="h-5 w-5 text-blue-400" />;
        }
    };

    return (
        <div className="absolute top-14 right-0 w-[92vw] max-w-sm bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 flex justify-between items-center border-b border-gray-700 bg-gray-900/60">
                <h3 className="font-bold text-white text-sm">Notifications <span className="text-gray-500 font-normal">{combined.length}</span></h3>
                <div className="flex items-center gap-3">
                    {combined.length > 0 && <button onClick={clearAll} className="text-xs font-semibold text-blue-400 hover:text-blue-300">Clear all</button>}
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><XIcon className="h-4 w-4" /></button>
                </div>
            </div>
            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto divide-y divide-gray-700/50">
                {combined.length > 0 ? combined.map(n => (
                    <div key={n.id} onClick={() => handleAct(n)} className="p-3 hover:bg-gray-700/60 cursor-pointer flex items-start gap-3 group">
                        <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
                        <div className="flex-grow min-w-0">
                            <p className="text-sm text-gray-100 leading-snug">{n.message}</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                                {liveIds.has(n.id) && <span className="mr-2 px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 uppercase tracking-wider text-[9px]">live</span>}
                                {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })} · tap to open
                            </p>
                        </div>
                        <button onClick={(e) => dismissOne(n, e)} title="Dismiss" className="text-gray-600 hover:text-white flex-shrink-0 opacity-60 group-hover:opacity-100">
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                )) : (
                    <p className="text-center text-gray-500 py-10 text-sm">You're all caught up </p>
                )}
            </div>
        </div>
    );
};

export default NotificationCenter;
