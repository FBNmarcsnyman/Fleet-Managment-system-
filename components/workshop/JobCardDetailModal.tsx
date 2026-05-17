import React, { useState, useMemo } from 'react';
import { JobCard, JobCardStatus, User, Vehicle, Part } from '../../types';
import { useWorkshop, useVehicles, useAuth, useUIState } from '../../contexts/AppContexts';
import { format } from 'date-fns';
import { ClockIcon } from '../icons/ClockIcon';
import { UserIcon } from '../icons/UserIcon';
import { WrenchIcon } from '../icons/WrenchIcon';
import { ChatBubbleIcon } from '../icons/ChatBubbleIcon';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';
import { PlusIcon } from '../icons/PlusIcon';

interface JobCardDetailModalProps {
    jobCardId: string;
}

const JobCardDetailModal: React.FC<JobCardDetailModalProps> = ({ jobCardId }) => {
    const { jobCards = [], users = [], parts = [], handleUpdateJobCard } = useWorkshop();
    const { vehicles = [] } = useVehicles();
    const { currentUser } = useAuth();
    const { hideModal, showToast } = useUIState();

    const originalJobCard = (jobCards || []).find((jc: JobCard) => jc.id === jobCardId);

    if (!originalJobCard) {
        return <div className="p-8 text-center text-gray-400">Job card not found.</div>;
    }

    const vehicle = (vehicles || []).find((v: Vehicle) => v.id === originalJobCard.vehicleId);
    const techUsers = (users || []).filter((u: User) => u.role === 'Workshop Manager' || u.role === 'Staff');

    // Local form state
    const [status, setStatus] = useState<JobCardStatus>(originalJobCard.status);
    const [priority, setPriority] = useState(originalJobCard.priority);
    const [assigneeId, setAssigneeId] = useState(originalJobCard.assignedToUserId || '');
    const [startDate, setStartDate] = useState(originalJobCard.proposedStartDate || '');
    const [endDate, setEndDate] = useState(originalJobCard.proposedEndDate || '');
    const [laborHours, setLaborHours] = useState(originalJobCard.laborHours?.toString() || '');
    const [newNote, setNewNote] = useState('');
    const [usedParts, setUsedParts] = useState(originalJobCard.partsUsed || []);
    
    // Inventory state
    const [selectedPartId, setSelectedPartId] = useState('');
    const [partQty, setPartQty] = useState('1');

    const handleAddPart = () => {
        const part = (parts || []).find((p: Part) => p.id === selectedPartId);
        if (!part) return;
        if (part.quantityInStock < parseInt(partQty)) {
            alert("Insufficient stock in inventory.");
            return;
        }
        setUsedParts(prev => [...prev, { partId: selectedPartId, quantity: parseInt(partQty), unitCost: part.cost }]);
        setSelectedPartId('');
        setPartQty('1');
    };

    const handleSave = () => {
        const updates: Partial<JobCard> = {
            status,
            priority,
            assignedToUserId: assigneeId || undefined,
            proposedStartDate: startDate || undefined,
            proposedEndDate: endDate || undefined,
            laborHours: laborHours ? parseFloat(laborHours) : undefined,
            partsUsed: usedParts,
        };

        if (newNote.trim() && currentUser) {
            const noteObj = {
                userId: currentUser.email,
                userName: currentUser.name,
                text: newNote.trim(),
                timestamp: new Date().toISOString()
            };
            updates.notes = [...(originalJobCard.notes || []), noteObj as any];
        }

        handleUpdateJobCard(jobCardId, updates);
        showToast('Job card updated successfully.');
        hideModal();
    };

    const inputClasses = "w-full bg-gray-700 text-white p-2.5 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm";
    const labelClasses = "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5";

    const JOB_STATUSES: JobCardStatus[] = [
        'Reported', 'Awaiting Inspection', 'Awaiting Parts', 'Pending Scheduling', 
        'Scheduled', 'In Progress', 'Awaiting Sign-off', 'Resolved'
    ];

    return (
        <div className="flex flex-col h-full max-h-[85vh]">
            <div className="flex justify-between items-start mb-6 border-b border-gray-700 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-white leading-tight">
                        JC-{originalJobCard.id.slice(-6).toUpperCase()}
                    </h2>
                    <p className="text-gray-400 text-sm font-medium">{originalJobCard.itemDescription}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Linked Asset</p>
                    <p className="text-blue-400 font-bold">{vehicle?.registration || 'N/A'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto pr-2 custom-scrollbar">
                {/* Left Column: Management */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Job Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value as JobCardStatus)} className={inputClasses}>
                                {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value as any)} className={inputClasses}>
                                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>Lead Technician</label>
                        <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={inputClasses}>
                            <option value="">-- Unassigned --</option>
                            {techUsers.map(u => <option key={u.email} value={u.email}>{u.name}</option>)}
                        </select>
                    </div>

                    {/* Workshop Inventory Section */}
                    <div className="bg-gray-900/50 p-4 rounded-xl space-y-4">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center">
                            <ArchiveBoxIcon className="h-4 w-4 mr-2" />
                            Inventory Consumption
                        </h4>
                        <div className="space-y-2">
                            {usedParts.map((up, i) => (
                                <div key={i} className="flex justify-between text-xs bg-gray-800 p-2 rounded">
                                    <span className="text-white font-bold">{(parts || []).find(p => p.id === up.partId)?.name}</span>
                                    <span className="text-gray-400">Qty: {up.quantity} • R{(up.quantity * up.unitCost).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <select value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)} className={`${inputClasses} flex-grow`}>
                                <option value="">-- Pick a Part --</option>
                                {(parts || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantityInStock} available)</option>)}
                            </select>
                            <input type="number" value={partQty} onChange={e => setPartQty(e.target.value)} className={`${inputClasses} w-16`} />
                            <button onClick={handleAddPart} className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg"><PlusIcon className="h-5 w-5" /></button>
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>Labor Hours</label>
                        <div className="relative">
                            <ClockIcon className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                            <input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} className={`${inputClasses} pl-10`} step="0.5" placeholder="0.0" />
                        </div>
                    </div>
                </div>

                {/* Right Column: Communication */}
                <div className="flex flex-col h-full">
                    <label className={labelClasses}>Technician Logs</label>
                    <div className="bg-gray-900/40 rounded-xl p-4 space-y-4 h-64 overflow-y-auto mb-4 border border-gray-700/50">
                        {originalJobCard.notes?.map((note: any, idx: number) => (
                            <div key={idx} className="flex items-start space-x-3">
                                <div className="h-8 w-8 rounded-lg bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">{note.userName?.charAt(0)}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between"><span className="text-xs font-bold text-gray-300">{note.userName}</span><span className="text-[10px] text-gray-500">{format(new Date(note.timestamp), 'dd MMM, HH:mm')}</span></div>
                                    <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{note.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <textarea 
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Log work progress or identify further required parts..."
                        className={`${inputClasses} h-24 resize-none`}
                    />
                </div>
            </div>

            <div className="flex justify-end items-center space-x-3 mt-8 pt-6 border-t border-gray-700">
                <button type="button" onClick={hideModal} className="px-6 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={handleSave} className="flex items-center bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-8 rounded-xl shadow-lg transition-all active:scale-95">
                    <WrenchIcon className="h-4 w-4 mr-2" />
                    Complete Updates
                </button>
            </div>
        </div>
    );
};

export default JobCardDetailModal;