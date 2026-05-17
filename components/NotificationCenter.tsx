import React from 'react';
import { useNotifications, useUIState } from '../contexts/AppContexts';
import { Notification, NotificationType } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { WrenchIcon } from './icons/WrenchIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { ArchiveBoxIcon } from './icons/ArchiveBoxIcon';
import { CurrencyDollarIcon } from './icons/CurrencyDollarIcon';
import { XIcon } from './icons/XIcon';

interface NotificationCenterProps {
    onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
    const { notifications, handleDismissNotification, handleDismissAllNotifications } = useNotifications();
    const { handleViewChange } = useUIState();

    const handleAct = (notification: Notification) => {
        handleViewChange(notification.link.view);
        handleDismissNotification(notification.id);
        onClose();
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'JOB_CARD': return <ClipboardIcon className="h-5 w-5 text-yellow-400" />;
            case 'SERVICE': return <WrenchIcon className="h-5 w-5 text-red-400" />;
            case 'INVENTORY': return <ArchiveBoxIcon className="h-5 w-5 text-orange-400" />;
            case 'PURCHASE': return <CurrencyDollarIcon className="h-5 w-5 text-purple-400" />;
            default: return null;
        }
    };

    return (
        <div className="absolute top-14 right-0 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50">
            <div className="p-3 flex justify-between items-center border-b border-gray-700">
                <h3 className="font-semibold text-white">Notifications</h3>
                <button onClick={handleDismissAllNotifications} className="text-xs text-blue-400 hover:text-white">Dismiss All</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                    notifications.map(notification => (
                        <div key={notification.id} className="p-3 border-b border-gray-700/50 hover:bg-gray-700">
                            <div onClick={() => handleAct(notification)} className="cursor-pointer">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
                                    <div className="flex-grow">
                                        <p className="text-sm text-gray-200">{notification.message}</p>
                                        <p className="text-xs text-gray-500 mt-1">{formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDismissNotification(notification.id); }} className="text-gray-500 hover:text-white flex-shrink-0">
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 py-8">No new notifications.</p>
                )}
            </div>
        </div>
    );
};

export default NotificationCenter;