import React, { useEffect } from 'react';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XIcon } from './icons/XIcon';

interface ToastProps {
    message: string | null;
    onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onDismiss();
            }, 5000); // Auto-dismiss after 5 seconds
            return () => clearTimeout(timer);
        }
    }, [message, onDismiss]);

    if (!message) {
        return null;
    }

    return (
        <div className="fixed top-5 right-5 z-[100] w-full max-w-sm">
            <div className="bg-gray-700 border border-gray-600 rounded-lg shadow-lg p-4 flex items-start space-x-4 animate-fade-in-right">
                <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-green-400" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-white">Notification</p>
                    <p className="mt-1 text-sm text-gray-300">{message}</p>
                </div>
                <div className="flex-shrink-0">
                    <button onClick={onDismiss} className="text-gray-400 hover:text-white">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Toast;
