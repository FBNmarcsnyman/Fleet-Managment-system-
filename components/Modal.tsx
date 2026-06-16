
import React from 'react';
import { XIcon } from './icons/XIcon';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    size?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    // Clicking the dark backdrop used to close the modal — which silently wiped a
    // half-filled form if you clicked just outside the box. Off by default now; the
    // X button and Cancel are the way out. (Opt back in per-modal if ever needed.)
    dismissOnBackdrop?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, size = 'md', dismissOnBackdrop = false }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300"
            onClick={dismissOnBackdrop ? onClose : undefined}
        >
            <div
                className={`bg-gray-800 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-[95vw] ${sizeClasses[size]} m-4 relative transform transition-all duration-300 scale-95 max-h-[95vh] overflow-y-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
                >
                    <XIcon className="h-6 w-6" />
                </button>
                {children}
            </div>
        </div>
    );
};

export default Modal;