import React, { useState } from 'react';
import { JobCard, JobCardStatus, JobCardDefect, User, Vehicle, Part } from '../../types';
import { useWorkshop, useVehicles, useAuth, useUIState } from '../../contexts/AppContexts';
import { format } from 'date-fns';
import { ClockIcon } from '../icons/ClockIcon';
import { ArchiveBoxIcon } from '../icons/ArchiveBoxIcon';
import { PlusIcon } from '../icons/PlusIcon';
import InspectionPhoto from './InspectionPhoto';

interface JobCardDetailModalProps { jobCardId: string; }

const sevChip: Record<string, string> = { Critical: 'bg-red-100 text-red-700', Urgent: 'bg-amber-100 text-amber-700', High: 'bg-orange-100 text-orange-700', Minor: 'bg-slate-100 text-slate-600', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-slate-100 text-slate-600' };

const JobCardDetailModal: React.FC<JobCardDetailModalProps> = ({ jobCardId }) => {
    const { jobCards = [], users = [], parts = [], handleUpdateJobCard } = useWorkshop();
    const { vehicles = [] } = useVehicles();
    const { currentUser } = useAuth();
    const { hideModal, showToast } = useUIState();

    const jc = (jobCards || []).find((j: JobCard) => j.id === jobCardId);
    if (!jc) return <div className="p-8 text-center text-slate-400">Job card not found.</div>;

    const vehicle = (vehicles || []).find((v: Vehicle) => v.id === jc.vehicleId);
    const techUsers = (users || []).filter((u: User) => u.role === 'Workshop Manager' || u.role === 'Staff');

    const [status, setStatus] = useState<JobCardStatus>(jc.status);
    const [priority, setPriority] = useState(jc.priority);
    const [assigneeId, setAssigneeId] = useState(jc.assignedToUserId || '');
    const [laborHours, setLaborHours] = useState(jc.laborHours?.toString() || '');
    const [newNote, setNewNote] = useState('');
    const [usedParts, setUsedParts] = useState(jc.partsUsed || []);
    const [defects, setDefects] = useState<JobCardDefect[]>(jc.defects || []);
    const [selectedPartId, setSelectedPartId] = useState('');
    const [partQty, setPartQty] = useState('1');

    const openCount = defects.filter(d => !d.resolved).length;
    const allResolved = defects.length > 0 && openCount === 0;

    const toggleDefect = (i: number) => setDefects(prev => prev.map((d, x) => x === i ? { ...d, resolved: !d.resolved } : d));

    const addPart = () => {
        const part = (parts || []).find((p: Part) => p.id === selectedPartId);
        if (!part) return;
        if (part.quantityInStock < parseInt(partQty)) { alert('Insufficient stock in inventory.'); return; }
        setUsedParts(prev => [...prev, { partId: selectedPartId, quantity: parseInt(partQty), unitCost: part.cost }]);
        setSelectedPartId(''); setPartQty('1');
    };

    const buildUpdates = (newStatus: JobCardStatus): Partial<JobCard> => {
        const updates: Partial<JobCard> = { status: newStatus, priority, assignedToUserId: assigneeId || undefined, laborHours: laborHours ? parseFloat(laborHours) : undefined, partsUsed: usedParts, defects };
        if (newStatus === 'Resolved') updates.completionDate = new Date().toISOString();
        if (newNote.trim() && currentUser) updates.notes = [...(jc.notes || []), { userId: currentUser.email, userName: currentUser.name, text: newNote.trim(), timestamp: new Date().toISOString() } as any];
        return updates;
    };
    const save = (newStatus: JobCardStatus, closing = false) => { handleUpdateJobCard(jobCardId, buildUpdates(newStatus)); showToast(closing ? 'Job card completed.' : 'Job card updated.'); hideModal(); };

    const inputC = 'w-full bg-white text-slate-800 p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#f5b700] text-sm';
    const labelC = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5';
    const JOB_STATUSES: JobCardStatus[] = ['Reported', 'Awaiting Inspection', 'Awaiting Parts', 'Pending Scheduling', 'Scheduled', 'In Progress', 'Awaiting Sign-off', 'Resolved'];

    return (
        <div className="flex flex-col h-full max-h-[85vh]">
            <div className="flex justify-between items-start mb-4 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-[#13294b] leading-tight">JC-{jc.id.slice(-6).toUpperCase()}</h2>
                    <p className="text-slate-500 text-sm">{jc.itemDescription}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vehicle</p>
                    <p className="text-[#13294b] font-black">{vehicle?.registration || 'N/A'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-2">
                {/* Defects checklist */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Defects ({openCount} open / {defects.length})</h4>
                    </div>
                    {defects.length === 0 && <p className="text-sm text-slate-400">No itemised defects on this card.</p>}
                    <div className="space-y-2">
                        {defects.map((d, i) => (
                            <div key={i} className={`rounded-xl border p-3 ${d.resolved ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className={`font-bold text-sm ${d.resolved ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{d.label}{d.position ? ` — ${d.position}` : ''}{d.trailerName ? ` [${d.trailerName}]` : ''}</p>
                                        {d.severity && <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sevChip[d.severity] || 'bg-slate-100 text-slate-600'}`}>{d.severity}</span>}
                                        {d.remarks && <p className="text-xs text-slate-600 italic mt-1">"{d.remarks}"</p>}
                                    </div>
                                    <button onClick={() => toggleDefect(i)} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg ${d.resolved ? 'bg-slate-100 text-slate-600' : 'bg-emerald-600 text-white'}`}>{d.resolved ? 'Undo' : 'Resolve'}</button>
                                </div>
                                {d.photoPath && <div className="mt-2"><InspectionPhoto path={d.photoPath} /></div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Management */}
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelC}>Status</label><select value={status} onChange={e => setStatus(e.target.value as JobCardStatus)} className={inputC}>{JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div><label className={labelC}>Priority</label><select value={priority} onChange={e => setPriority(e.target.value as any)} className={inputC}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
                    </div>
                    <div><label className={labelC}>Lead Technician</label><select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={inputC}><option value="">-- Unassigned --</option>{techUsers.map(u => <option key={u.email} value={u.email}>{u.name}</option>)}</select></div>

                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center"><ArchiveBoxIcon className="h-4 w-4 mr-2" />Parts used</h4>
                        {usedParts.map((up, i) => (
                            <div key={i} className="flex justify-between text-xs bg-white border border-slate-200 p-2 rounded"><span className="text-slate-800 font-bold">{(parts || []).find(p => p.id === up.partId)?.name}</span><span className="text-slate-500">Qty {up.quantity} · R{(up.quantity * up.unitCost).toLocaleString()}</span></div>
                        ))}
                        <div className="flex gap-2">
                            <select value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)} className={`${inputC} flex-grow`}><option value="">-- Pick a part --</option>{(parts || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantityInStock})</option>)}</select>
                            <input type="number" value={partQty} onChange={e => setPartQty(e.target.value)} className={`${inputC} w-16`} />
                            <button onClick={addPart} className="bg-[#13294b] text-white p-2 rounded-lg"><PlusIcon className="h-5 w-5" /></button>
                        </div>
                    </div>

                    <div><label className={labelC}>Labour hours</label><div className="relative"><ClockIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} className={`${inputC} pl-10`} step="0.5" placeholder="0.0" /></div></div>

                    <div>
                        <label className={labelC}>Add note</label>
                        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Log work progress…" className={`${inputC} h-20 resize-none`} style={{ textTransform: 'none' }} />
                        {jc.notes && jc.notes.length > 0 && <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">{jc.notes.map((n: any, i: number) => <p key={i} className="text-xs text-slate-500"><strong>{n.userName}:</strong> {n.text}</p>)}</div>}
                    </div>
                </div>
            </div>

            <div className="flex justify-end items-center gap-3 mt-6 pt-4 border-t border-slate-200">
                <button type="button" onClick={hideModal} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                <button onClick={() => save(status)} className="bg-white border border-slate-300 text-slate-700 font-bold py-2.5 px-6 rounded-xl hover:bg-slate-50">Save updates</button>
                <button onClick={() => save('Resolved', true)} disabled={defects.length > 0 && !allResolved} className="bg-emerald-600 disabled:opacity-40 text-white font-black py-2.5 px-6 rounded-xl">{defects.length > 0 && !allResolved ? `${openCount} defect(s) open` : 'Complete & close'}</button>
            </div>
        </div>
    );
};

export default JobCardDetailModal;
