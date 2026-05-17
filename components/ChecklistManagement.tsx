import React, { useState, useEffect } from 'react';
import { ChecklistTemplate, ChecklistSubmission, User, Vehicle, ChecklistItemTemplate } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { XIcon } from './icons/XIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import AIChecklistGeneratorModal from './AIChecklistGeneratorModal';
import { SearchIcon } from './icons/SearchIcon';
import ChecklistSubmissionsModal from './ChecklistSubmissionsModal';
import { EyeIcon } from './icons/EyeIcon';
import { CameraIcon } from './icons/CameraIcon';

interface ChecklistManagementProps {
    templates: ChecklistTemplate[];
    usedTemplateIds: Set<string>;
    checklistSubmissions: ChecklistSubmission[];
    users: User[];
    vehicles: Vehicle[];
    onAddTemplate: (template: Omit<ChecklistTemplate, 'id'>) => void;
    onUpdateTemplate: (template: ChecklistTemplate) => void;
    onDeleteTemplate: (templateId: string) => void;
    onPreviewTemplate: (template: ChecklistTemplate) => void;
}

type FormItem = {
    label: string;
    requiresPhoto: boolean;
    userOverridden: boolean;
};

const photoRequiredRegex = /condition|tire|mirror|light|window|panel|body|tape|windscreen|crack|dent|leak/i;

const ChecklistManagement: React.FC<ChecklistManagementProps> = ({ templates, usedTemplateIds, checklistSubmissions, users, vehicles, onAddTemplate, onUpdateTemplate, onDeleteTemplate, onPreviewTemplate }) => {
    const [isEditing, setIsEditing] = useState<ChecklistTemplate | null>(null);
    const [name, setName] = useState('');
    const [items, setItems] = useState<FormItem[]>([{ label: '', requiresPhoto: false, userOverridden: false }]);
    const [showAIModal, setShowAIModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingSubmissionsOf, setViewingSubmissionsOf] = useState<ChecklistTemplate | null>(null);

    useEffect(() => {
        if (isEditing) {
            setName(isEditing.name);
            const newItems = isEditing.items.map(item => ({
                label: item.label,
                requiresPhoto: item.requiresPhotoOnFail,
                userOverridden: true, // Assume existing items from a saved template have been intentionally set.
            }));
            setItems(newItems.length > 0 ? newItems : [{ label: '', requiresPhoto: false, userOverridden: false }]);
        } else {
            setName('');
            setItems([{ label: '', requiresPhoto: false, userOverridden: false }]);
        }
    }, [isEditing]);

    const handleItemChange = (index: number, value: string) => {
        const newItems = [...items];
        const item = newItems[index];
        if (item) {
            item.label = value;
            if (!item.userOverridden) {
                item.requiresPhoto = photoRequiredRegex.test(value);
            }
            setItems(newItems);
        }
    };

    const handleCheckboxChange = (index: number, checked: boolean) => {
        const newItems = [...items];
        const item = newItems[index];
        if (item) {
            item.requiresPhoto = checked;
            item.userOverridden = true;
            setItems(newItems);
        }
    };

    const handleAddItem = () => {
        setItems([...items, { label: '', requiresPhoto: false, userOverridden: false }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalItems = items.map(item => ({ label: item.label.trim(), requiresPhoto: item.requiresPhoto })).filter(item => item.label);

        if (!name || finalItems.length === 0) {
            alert('Please provide a template name and at least one checklist item.');
            return;
        }

        const finalItemTemplates: ChecklistItemTemplate[] = finalItems.map((item, index) => {
            const existingItem = isEditing?.items.find(i => i.label === item.label);
            return {
                id: existingItem?.id || `${item.label.replace(/\s+/g, '-')}-${Date.now()}-${index}`,
                label: item.label,
                requiresPhotoOnFail: item.requiresPhoto,
            };
        });

        if (isEditing) {
            onUpdateTemplate({ ...isEditing, name, items: finalItemTemplates });
        } else {
            onAddTemplate({ name, items: finalItemTemplates });
        }
        setIsEditing(null); // This will trigger useEffect to reset the form
    };

    const handleAIGenerate = (data: { name: string; items: string[] }) => {
        setIsEditing(null);
        setName(data.name);
        const newItems = data.items.map(label => ({
            label,
            requiresPhoto: photoRequiredRegex.test(label),
            userOverridden: false,
        }));
        setItems(newItems.length > 0 ? newItems : [{ label: '', requiresPhoto: false, userOverridden: false }]);
        setShowAIModal(false);
    };

    const filteredTemplates = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg sticky top-24">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-white">{isEditing ? 'Edit' : 'Create'} Template</h2>
                            <button
                                onClick={() => setShowAIModal(true)}
                                className="flex items-center text-sm font-semibold py-1 px-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                                title="Generate with AI"
                            >
                                <SparklesIcon className="h-4 w-4 mr-2" />
                                Generate
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Template Name</label>
                                <input
                                    id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                                    className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                                    placeholder="e.g., Daily Pre-Trip Inspection"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Checklist Items</label>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex items-center space-x-2">
                                            <input
                                                type="text" value={item.label} onChange={e => handleItemChange(index, e.target.value)}
                                                className="flex-grow bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-secondary"
                                                placeholder={`Item #${index + 1}`}
                                            />
                                             <label className="flex items-center space-x-1.5 cursor-pointer" title="Require photo on fail">
                                                <input
                                                    type="checkbox"
                                                    checked={item.requiresPhoto}
                                                    onChange={(e) => handleCheckboxChange(index, e.target.checked)}
                                                    className="form-checkbox h-4 w-4 text-brand-primary bg-gray-600 border-gray-500 rounded focus:ring-brand-secondary"
                                                />
                                                <CameraIcon className="h-5 w-5 text-gray-400" />
                                            </label>
                                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-gray-400 hover:text-red-400 disabled:text-gray-600" disabled={items.length <= 1}>
                                                <XIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={handleAddItem} className="text-sm mt-2 text-brand-secondary hover:text-blue-400 font-semibold">
                                    + Add another item
                                </button>
                            </div>
                            <div className="pt-2 flex space-x-3">
                                <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                                    {isEditing ? 'Save Changes' : 'Create Template'}
                                </button>
                                {isEditing && (
                                    <button type="button" onClick={() => setIsEditing(null)} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold text-white mb-4">Existing Templates</h2>
                        <div className="relative mb-4">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-700 text-white p-3 pl-10 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                            />
                        </div>

                        <div className="space-y-4">
                            {filteredTemplates.map(template => (
                                <div key={template.id} className="bg-gray-700/50 p-4 rounded-md">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                                            <p className="text-xs text-gray-400">{template.items.length} items</p>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <button onClick={() => setViewingSubmissionsOf(template)} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-lg">View Submissions</button>
                                            <button onClick={() => onPreviewTemplate(template)} className="text-gray-400 hover:text-white" title="Preview">
                                                <EyeIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => setIsEditing(template)} className="text-gray-400 hover:text-white" title="Edit">
                                                <EditIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteTemplate(template.id)}
                                                disabled={usedTemplateIds.has(template.id)}
                                                className="text-gray-400 hover:text-red-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                                                title={usedTemplateIds.has(template.id) ? "Cannot delete template in use" : "Delete"}
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-gray-300 text-sm pl-2">
                                        {template.items.slice(0, 5).map(item => <li key={item.id} className="truncate">{item.label}</li>)}
                                        {template.items.length > 5 && <li className="text-gray-400 italic">...and {template.items.length - 5} more</li>}
                                    </ul>
                                </div>
                            ))}
                             {filteredTemplates.length === 0 && (
                                <p className="text-center text-gray-500 py-8">
                                    {templates.length > 0 ? "No templates match your search." : "No checklist templates created yet."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {viewingSubmissionsOf && (
                <ChecklistSubmissionsModal
                    isOpen={!!viewingSubmissionsOf}
                    onClose={() => setViewingSubmissionsOf(null)}
                    template={viewingSubmissionsOf}
                    submissions={checklistSubmissions.filter(s => s.templateId === viewingSubmissionsOf.id)}
                    users={users}
                    vehicles={vehicles}
                />
            )}
            <AIChecklistGeneratorModal
                isOpen={showAIModal}
                onClose={() => setShowAIModal(false)}
                onGenerate={handleAIGenerate}
            />
        </>
    );
};

export default ChecklistManagement;
