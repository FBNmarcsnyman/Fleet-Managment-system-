import React, { useState, useEffect } from 'react';
import { ChecklistTemplate, ChecklistSubmission, User, Vehicle, ChecklistItemTemplate } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { XIcon } from './icons/XIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import AIChecklistGeneratorModal from './AIChecklistGeneratorModal';
import { SearchIcon } from './icons/SearchIcon';
import ChecklistSubmissionsModal from './ChecklistSubmissionsModal';
import { EyeIcon } from './icons/EyeIcon';

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

const VEHICLE_TYPES = ['Horse', 'Loadmaster', 'Rigid', 'Trailer', 'Forklift', 'Light'];
const SEVERITIES: ChecklistItemTemplate['severity'][] = ['Critical', 'Urgent', 'Minor'];
const PHOTO_OPTS: { v: 'none' | 'onFail' | 'always'; label: string }[] = [
    { v: 'none', label: 'No photo' }, { v: 'onFail', label: 'Photo if failed' }, { v: 'always', label: 'Photo always' },
];

// The editor's working shape for one item (flattened for form inputs).
type FormItem = {
    id?: string; label: string; section: string;
    photo: 'none' | 'onFail' | 'always'; severity: 'Critical' | 'Urgent' | 'Minor';
    valueOptions: string;  // comma-separated
    failValues: string;    // comma-separated
    loadmasterOnly: boolean; treadDepth: boolean; perWheel: boolean;
    wheelPositions?: string[]; criticalUnderMm?: number; regulation?: string; crossBorder?: boolean;
};

const blank = (): FormItem => ({ label: '', section: '', photo: 'none', severity: 'Minor', valueOptions: '', failValues: '', loadmasterOnly: false, treadDepth: false, perWheel: false });

const toForm = (it: ChecklistItemTemplate): FormItem => ({
    id: it.id, label: it.label, section: it.section || '',
    photo: it.photo || (it.requiresPhotoOnFail ? 'onFail' : 'none'),
    severity: it.severity || 'Minor',
    valueOptions: (it.value || []).join(', '), failValues: (it.failValues || []).join(', '),
    loadmasterOnly: !!it.loadmasterOnly, treadDepth: !!it.treadDepth, perWheel: !!it.perWheel,
    wheelPositions: it.wheelPositions, criticalUnderMm: it.criticalUnderMm, regulation: it.regulation, crossBorder: it.crossBorder,
});

const csv = (s: string): string[] => s.split(',').map(x => x.trim()).filter(Boolean);

const inp = 'w-full bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const sevChip: Record<string, string> = { Critical: 'bg-red-100 text-red-700', Urgent: 'bg-amber-100 text-amber-700', Minor: 'bg-slate-200 text-slate-600' };

const ChecklistManagement: React.FC<ChecklistManagementProps> = ({ templates, usedTemplateIds, checklistSubmissions, users, vehicles, onAddTemplate, onUpdateTemplate, onDeleteTemplate, onPreviewTemplate }) => {
    const [isEditing, setIsEditing] = useState<ChecklistTemplate | null>(null);
    const [name, setName] = useState('');
    const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
    const [items, setItems] = useState<FormItem[]>([blank()]);
    const [showAIModal, setShowAIModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingSubmissionsOf, setViewingSubmissionsOf] = useState<ChecklistTemplate | null>(null);

    useEffect(() => {
        if (isEditing) {
            setName(isEditing.name);
            setVehicleTypes(isEditing.vehicleTypes || []);
            const mapped = (isEditing.items || []).map(toForm);
            setItems(mapped.length ? mapped : [blank()]);
        } else {
            setName(''); setVehicleTypes([]); setItems([blank()]);
        }
    }, [isEditing]);

    const setItem = (i: number, patch: Partial<FormItem>) => setItems(prev => prev.map((it, x) => x === i ? { ...it, ...patch } : it));
    const addItem = () => setItems(prev => [...prev, blank()]);
    const removeItem = (i: number) => setItems(prev => prev.length <= 1 ? prev : prev.filter((_, x) => x !== i));
    const toggleType = (t: string) => setVehicleTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalItems: ChecklistItemTemplate[] = items
            .filter(it => it.label.trim())
            .map((it, index) => {
                const value = csv(it.valueOptions);
                const out: ChecklistItemTemplate = {
                    id: it.id || `${it.label.replace(/\s+/g, '-').toLowerCase().slice(0, 24)}-${Date.now()}-${index}`,
                    label: it.label.trim(),
                    section: it.section.trim() || undefined,
                    photo: it.photo === 'none' ? null : it.photo,
                    requiresPhotoOnFail: it.photo === 'onFail',
                    severity: it.severity,
                    value: value.length ? value : undefined,
                    failValues: csv(it.failValues).length ? csv(it.failValues) : undefined,
                    loadmasterOnly: it.loadmasterOnly || undefined,
                    treadDepth: it.treadDepth || undefined,
                    perWheel: it.perWheel || undefined,
                    wheelPositions: it.wheelPositions,
                    criticalUnderMm: it.criticalUnderMm,
                    regulation: it.regulation,
                    crossBorder: it.crossBorder,
                };
                return out;
            });
        if (!name.trim() || finalItems.length === 0) { alert('Please provide a template name and at least one item.'); return; }
        if (isEditing) onUpdateTemplate({ ...isEditing, name: name.trim(), items: finalItems, vehicleTypes });
        else onAddTemplate({ name: name.trim(), items: finalItems, vehicleTypes } as Omit<ChecklistTemplate, 'id'>);
        setIsEditing(null);
    };

    const handleAIGenerate = (data: { name: string; items: string[] }) => {
        setIsEditing(null); setName(data.name); setVehicleTypes([]);
        setItems((data.items.length ? data.items : ['']).map(label => ({ ...blank(), label })));
        setShowAIModal(false);
    };

    const filtered = templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor */}
                <div className="lg:col-span-1">
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm sticky top-24">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-black text-slate-900">{isEditing ? 'Edit' : 'Create'} Template</h2>
                            <button onClick={() => setShowAIModal(true)} className="flex items-center text-sm font-bold py-1.5 px-3 rounded-lg bg-[#13294b] hover:bg-[#1d3a66] text-white" title="Generate with AI">
                                <SparklesIcon className="h-4 w-4 mr-2" /> Generate
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Template name</label>
                                <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="e.g. Heavy Duty Truck-Tractor (Horse) Checklist" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Applies to vehicle types</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {VEHICLE_TYPES.map(t => (
                                        <button key={t} type="button" onClick={() => toggleType(t)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${vehicleTypes.includes(t) ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#13294b]'}`}>{t}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Checklist items</label>
                                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                                    {items.map((it, index) => (
                                        <div key={index} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
                                            <div className="flex items-center gap-2 mb-2">
                                                <input value={it.label} onChange={e => setItem(index, { label: e.target.value })} className={inp} placeholder={`Item #${index + 1} — description`} />
                                                <button type="button" onClick={() => removeItem(index)} disabled={items.length <= 1} className="text-slate-400 hover:text-red-500 disabled:opacity-30"><XIcon className="h-5 w-5" /></button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input value={it.section} onChange={e => setItem(index, { section: e.target.value })} className={inp} placeholder="Section (e.g. Brakes)" />
                                                <select value={it.severity} onChange={e => setItem(index, { severity: e.target.value as any })} className={inp}>{SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                                <select value={it.photo} onChange={e => setItem(index, { photo: e.target.value as any })} className={inp}>{PHOTO_OPTS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}</select>
                                                <input value={it.valueOptions} onChange={e => setItem(index, { valueOptions: e.target.value })} className={inp} placeholder="Values e.g. Low,OK" />
                                            </div>
                                            {it.valueOptions.trim() && (
                                                <input value={it.failValues} onChange={e => setItem(index, { failValues: e.target.value })} className={inp + ' mt-2'} placeholder="Which value(s) = fail? e.g. Low" />
                                            )}
                                            <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-600">
                                                <label className="flex items-center gap-1"><input type="checkbox" checked={it.perWheel} onChange={e => setItem(index, { perWheel: e.target.checked })} /> Per wheel</label>
                                                <label className="flex items-center gap-1"><input type="checkbox" checked={it.treadDepth} onChange={e => setItem(index, { treadDepth: e.target.checked })} /> Tread depth</label>
                                                <label className="flex items-center gap-1"><input type="checkbox" checked={it.loadmasterOnly} onChange={e => setItem(index, { loadmasterOnly: e.target.checked })} /> Loadmaster only</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addItem} className="text-sm mt-2 text-blue-600 hover:text-blue-800 font-bold">+ Add another item</button>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="submit" className="w-full bg-[#13294b] hover:bg-[#1d3a66] text-white font-bold py-2.5 px-4 rounded-lg">{isEditing ? 'Save Changes' : 'Create Template'}</button>
                                {isEditing && <button type="button" onClick={() => setIsEditing(null)} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-lg">Cancel</button>}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Existing templates */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                        <h2 className="text-2xl font-black text-slate-900 mb-4">Existing Templates</h2>
                        <div className="relative mb-4">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="h-5 w-5 text-slate-400" /></div>
                            <input type="text" placeholder="Search templates..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={inp + ' pl-10'} />
                        </div>
                        <div className="space-y-4">
                            {filtered.map(template => {
                                const crit = (template.items || []).filter(i => i.severity === 'Critical').length;
                                return (
                                    <div key={template.id} className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">{template.name}</h3>
                                                <p className="text-xs text-slate-500">{template.items.length} items{crit ? ` · ${crit} critical` : ''}{template.vehicleTypes?.length ? ` · ${template.vehicleTypes.join(', ')}` : ' · not linked to a vehicle type'}</p>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <button onClick={() => setViewingSubmissionsOf(template)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white py-1 px-3 rounded-lg">View Submissions</button>
                                                <button onClick={() => onPreviewTemplate(template)} className="text-slate-400 hover:text-slate-700" title="Preview"><EyeIcon className="h-5 w-5" /></button>
                                                <button onClick={() => setIsEditing(template)} className="text-slate-400 hover:text-slate-700" title="Edit"><EditIcon className="h-5 w-5" /></button>
                                                <button onClick={() => onDeleteTemplate(template.id)} disabled={usedTemplateIds.has(template.id)} className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed" title={usedTemplateIds.has(template.id) ? 'Cannot delete template in use' : 'Delete'}><TrashIcon className="h-5 w-5" /></button>
                                            </div>
                                        </div>
                                        <ul className="text-slate-600 text-sm pl-1 space-y-0.5">
                                            {template.items.slice(0, 5).map(item => (
                                                <li key={item.id} className="truncate flex items-center gap-2">
                                                    {item.severity && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevChip[item.severity]}`}>{item.severity[0]}</span>}
                                                    <span className="truncate">{item.label}</span>
                                                </li>
                                            ))}
                                            {template.items.length > 5 && <li className="text-slate-400 italic">…and {template.items.length - 5} more</li>}
                                        </ul>
                                    </div>
                                );
                            })}
                            {filtered.length === 0 && <p className="text-center text-slate-400 py-8">{templates.length > 0 ? 'No templates match your search.' : 'No checklist templates yet.'}</p>}
                        </div>
                    </div>
                </div>
            </div>
            {viewingSubmissionsOf && (
                <ChecklistSubmissionsModal isOpen={!!viewingSubmissionsOf} onClose={() => setViewingSubmissionsOf(null)} template={viewingSubmissionsOf} submissions={checklistSubmissions.filter(s => s.templateId === viewingSubmissionsOf.id)} users={users} vehicles={vehicles} />
            )}
            <AIChecklistGeneratorModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} onGenerate={handleAIGenerate} />
        </>
    );
};

export default ChecklistManagement;
