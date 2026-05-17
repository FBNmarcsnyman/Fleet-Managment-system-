import React, { useRef } from 'react';
import { XIcon } from '../icons/XIcon';
import { GripVerticalIcon } from '../icons/GripVerticalIcon';

interface WidgetWrapperProps {
    title: string;
    children: React.ReactNode;
    isCustomizeMode: boolean;
    onRemove: () => void;
    className?: string; // This is the size class e.g., 'col-span-6'
    onSizeChange: (newSize: string) => void;
    index: number;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
    onDragEnter: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ title, children, isCustomizeMode, onRemove, className, onSizeChange, index, onDragStart, onDragEnter, onDragEnd }) => {
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const wrapperElement = wrapperRef.current;
        if (!wrapperElement) return;

        const parentGrid = wrapperElement.parentElement;
        if (!parentGrid) return;

        const gridWidth = parentGrid.offsetWidth;
        const columnWidth = gridWidth / 12;
        
        const match = (className || '').match(/md:col-span-(\d+)/);
        const currentSpan = match ? parseInt(match[1], 10) : 12;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const spanChange = Math.round(dx / columnWidth);
            let newSpan = currentSpan + spanChange;
            
            newSpan = Math.max(3, Math.min(12, newSpan));
            
            const newSizeClass = `col-span-12 md:col-span-${newSpan}`;
            onSizeChange(newSizeClass);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div 
            ref={wrapperRef}
            className={`relative bg-gray-800 p-6 rounded-lg shadow-lg transition-all duration-200 ${className}`}
            draggable={isCustomizeMode}
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnter={(e) => onDragEnter(e, index)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
        >
            {isCustomizeMode && (
                <>
                    <div className="absolute top-2 right-2 flex items-center space-x-1 bg-gray-900/50 p-1 rounded-md z-10">
                        <div className="cursor-move p-1 text-gray-400 hover:text-white" title="Drag to reorder">
                            <GripVerticalIcon className="h-5 w-5" />
                        </div>
                        <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-300" title="Remove widget">
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                    <div
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center text-gray-500 hover:text-white"
                        onMouseDown={handleResizeStart}
                        title="Resize"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 20L20 4M14 20l6-6" />
                        </svg>
                    </div>
                </>
            )}
             <h3 className="text-xl font-semibold text-gray-300 mb-4">{title}</h3>
            {children}
        </div>
    );
};

export default WidgetWrapper;