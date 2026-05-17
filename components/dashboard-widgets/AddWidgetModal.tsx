import React from 'react';
import { WidgetType } from '../../types';
import Modal from '../Modal';
import { PlusIcon } from '../icons/PlusIcon';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableWidgets: WidgetType[];
    onAddWidget: (widgetType: WidgetType) => void;
    widgetConfig: Record<WidgetType, { name: string; component: React.FC<any> }>;
}

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, availableWidgets, onAddWidget, widgetConfig }) => {

    const handleAdd = (widgetType: WidgetType) => {
        onAddWidget(widgetType);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div>
                <h2 className="text-2xl font-bold text-white mb-4">Add Widget to Dashboard</h2>
                <div className="space-y-3">
                    {availableWidgets.length > 0 ? (
                        availableWidgets.map(widgetType => (
                            <button
                                key={widgetType}
                                onClick={() => handleAdd(widgetType)}
                                className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left"
                            >
                                <span className="font-semibold text-white">{widgetConfig[widgetType].name}</span>
                                <PlusIcon className="h-5 w-5 text-green-400" />
                            </button>
                        ))
                    ) : (
                        <p className="text-gray-400 text-center py-4">All available widgets are already on your dashboard.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default AddWidgetModal;
