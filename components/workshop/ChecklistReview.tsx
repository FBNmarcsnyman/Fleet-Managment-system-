import React, { useState, useMemo } from 'react';
import { ChecklistSubmission, ChecklistItemResult, Vehicle, User, JobCard, Branch } from '../../types';
import { format, formatDistanceToNow } from 'date-fns';
import { invokeFn } from '../../lib/supabase';
import CreateJobCardFromChecklistModal from './CreateJobCardFromChecklistModal';
import Modal from '../Modal';

interface ChecklistReviewProps {
    currentUser: User;
    submissions: ChecklistSubmission[];
    jobCards: JobCard[];
    vehicles: Vehicle[];
    onUpdateSubmission: (submission: ChecklistSubmission) => void;
    onCreateJobCard: (jobCard: Omit<JobCard, 'id'>) => void;
}

// Lazy signed-URL thumbnail for a private inspection photo (path = "inspections/...").
const InspectionPhoto: React.FC<{ path: string; label?: string }> = ({ path, label }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const load = async () => {
        if (url || loading) return;
        setLoading(true);
        try { const { data, error } = await invokeFn('inspection-doc-url', { body: { path } }); if (error || !data?.url) setFailed(true); else setUrl(data.url); }
        catch { setFailed(true); } finally { setLoading(false); }
    };
    if (failed) return <span className="text-xs text-slate-400">photo unavailable</span>;
    if (url) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label || 'photo'} className="h-20 w-20 object-cover rounded-lg border border-slate-200" /></a>;
    return <button onClick={load} className="h-20 w-20 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:bg-slate-50">{loading ? '…' : `📷 ${label || 'View'}`}</button>;
};

const resultBadge = (r?: string) => r === 'Roadworthy' ? 'bg-emerald-100 text-emerald-700' : r === 'Grounded' ? 'bg-red-100 text-red-700' : r === 'Requires Attention' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
const statusChip = (s?: string) => s === 'Pass' ? 'bg-emerald-100 text-emerald-700' : s === 'Fail' ? 'bg-red-100 text-red-700' : s === 'Needs Attention' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';

const ChecklistReview: React.FC<ChecklistReviewProps> = ({ currentUser, submissions = [], jobCards = [], vehicles = [], onUpdateSubmission, onCreateJobCard }) => {
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'Submitted' | 'Reviewed'>('Submitted');
    const [jobCardModalItem, setJobCardModalItem] = useState<{ item: ChecklistItemResult, vehicleId: string } | null>(null);

    const vehicleMap = useMemo(() => new Map((vehicles || []).map(v => [v.id, v])), [vehicles]);
    const regOf = (id?: string) => vehicleMap.get(id || '')?.registration || '';

    const filteredSubmissions = useMemo(() => {
        const sorted = (submissions || []).filter(s => s.status === filter)
            .sort((a, b) => new Date(b.submittedAt || b.date).getTime() - new Date(a.submittedAt || a.date).getTime());
        if (!currentUser) return [];
        const userBranches = currentUser.assignedBranches || [];
        if (currentUser.role === 'Super Admin' || userBranches.length === 0) return sorted;
        const canSeeLoadmaster = userBranches.includes('FBN JHB') || userBranches.includes('FBN DBN');
        return sorted.filter(sub => {
            const vehicle = vehicleMap.get(sub.vehicleId);
            if (!vehicle) return false;
            if (userBranches.includes(vehicle.branch as Branch)) return true;
            if (vehicle.branch === 'LOADMASTER' && canSeeLoadmaster) return true;
            return false;
        });
    }, [submissions, filter, currentUser, vehicleMap]);

    const sub = useMemo(() => (submissions || []).find(s => s.id === selectedSubmissionId), [selectedSubmissionId, submissions]);

    // Group the selected submission's results by section (preserving order).
    const grouped = useMemo(() => {
        if (!sub) return [] as { section: string; items: ChecklistItemResult[] }[];
        const order: string[] = []; const map: Record<string, ChecklistItemResult[]> = {};
        for (const r of (sub.results || [])) { const sec = (r as any).section || 'General'; if (!map[sec]) { map[sec] = []; order.push(sec); } map[sec].push(r); }
        return order.map(section => ({ section, items: map[section] }));
    }, [sub]);

    const handleApprove = () => { if (!sub) return; onUpdateSubmission({ ...sub, status: 'Reviewed', reviewedBy: currentUser.email, reviewedAt: new Date().toISOString() }); setSelectedSubmissionId(null); };
    const handleCreateJobCardSubmit = (jobCardData: Omit<JobCard, 'id'>) => { onCreateJobCard(jobCardData); setJobCardModalItem(null); };

    const isFail = (r: ChecklistItemResult) => r.status === 'Fail' || r.status === 'Needs Attention';
    const labelOf = (r: ChecklistItemResult) => (r as any).label || r.item || 'Item';

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Queue */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-[calc(100vh-15rem)]">
                    <h3 className="text-lg font-black text-[#13294b] mb-3">Review Queue</h3>
                    <div className="flex bg-slate-100 rounded-lg p-1 mb-3">
                        {(['Submitted', 'Reviewed'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`flex-1 text-center py-2 text-sm font-bold rounded-md transition-colors ${filter === f ? 'bg-white text-[#13294b] shadow-sm' : 'text-slate-500'}`}>{f}</button>
                        ))}
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2">
                        {filteredSubmissions.map(s => (
                            <button key={s.id} onClick={() => setSelectedSubmissionId(s.id)} className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedSubmissionId === s.id ? 'border-[#f5b700] bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                <div className="flex items-center justify-between">
                                    <p className="font-black text-slate-900">{regOf(s.vehicleId) || s.userName || 'N/A'}</p>
                                    {s.result && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${resultBadge(s.result)}`}>{s.result}</span>}
                                </div>
                                <p className="text-sm text-slate-500">{s.userName}{s.depot ? ` · ${s.depot}` : ''}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{formatDistanceToNow(new Date(s.submittedAt || s.date), { addSuffix: true })}</p>
                            </button>
                        ))}
                        {filteredSubmissions.length === 0 && <p className="text-center text-slate-400 pt-10 text-sm">No checklists to review.</p>}
                    </div>
                </div>

                {/* Detail */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 h-[calc(100vh-15rem)] overflow-y-auto">
                    {sub ? (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-black text-[#13294b]">{regOf(sub.vehicleId) || sub.templateName}</h2>
                                    <p className="text-sm text-slate-500">{sub.templateName}</p>
                                    <p className="text-sm text-slate-600 mt-1">{sub.userName}{sub.substituting ? ' (substituting)' : ''}{sub.licenceCode ? ` · code ${sub.licenceCode}` : ''}{sub.depot ? ` · ${sub.depot}` : ''}</p>
                                    <p className="text-[12px] text-slate-400">{format(new Date(sub.submittedAt || sub.date), 'dd MMM yyyy, HH:mm')}{sub.reference ? ` · ${sub.reference}` : ''}</p>
                                    {sub.trailerIds && sub.trailerIds.length > 0 && <p className="text-[12px] text-slate-500 mt-0.5">Trailers: {sub.trailerIds.map(regOf).filter(Boolean).join(', ') || '—'}</p>}
                                </div>
                                {sub.result && <span className={`shrink-0 text-sm font-black px-3 py-1 rounded-lg ${resultBadge(sub.result)}`}>{sub.result}</span>}
                            </div>

                            {(sub.failedCritical || sub.failedUrgent || sub.failedMinor) ? (
                                <div className="flex gap-2 text-xs font-bold">
                                    {!!sub.failedCritical && <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700">{sub.failedCritical} critical</span>}
                                    {!!sub.failedUrgent && <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700">{sub.failedUrgent} urgent</span>}
                                    {!!sub.failedMinor && <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{sub.failedMinor} minor</span>}
                                </div>
                            ) : null}

                            {grouped.map(g => (
                                <div key={g.section}>
                                    <h4 className="text-xs font-black text-[#13294b] uppercase tracking-widest mt-3 mb-1">{g.section}</h4>
                                    <div className="space-y-2">
                                        {g.items.map((r, i) => {
                                            const jobCardExists = (jobCards || []).some(jc => jc.submissionId === sub.id && jc.checklistItemId === r.itemId);
                                            const units = (r as any).units as { expiry?: string; gaugePath?: string; labelPath?: string }[] | undefined;
                                            return (
                                                <div key={`${r.itemId}-${i}`} className={`rounded-xl border p-3 ${isFail(r) ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-bold text-slate-800 text-sm">{labelOf(r)}{(r as any).position ? <span className="text-slate-500 font-normal"> — {(r as any).position}</span> : ''}</p>
                                                        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${statusChip(r.status)}`}>{r.status === 'NA' ? 'N/A' : r.status}{(r as any).value ? `: ${(r as any).value}` : ''}</span>
                                                    </div>
                                                    {(r as any).count != null && <p className="text-xs text-slate-500 mt-0.5">Quantity: {(r as any).count}</p>}
                                                    {(r as any).treadMm && <p className="text-xs text-slate-500 mt-0.5">Tread: {(r as any).treadMm} mm</p>}
                                                    {((r as any).remarks || r.notes) && <p className="text-sm text-slate-600 italic mt-1">"{(r as any).remarks || r.notes}"</p>}
                                                    {(r as any).ai && <div className="text-[12px] text-slate-600 mt-1">AI: {(r as any).ai.overall_assessment} · tread {(r as any).ai.tread_estimate}{(r as any).ai.retread_detected ? ' · RETREAD' : ''}</div>}
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {(r as any).photoPath && <InspectionPhoto path={(r as any).photoPath} />}
                                                        {units?.map((u, x) => (
                                                            <React.Fragment key={x}>
                                                                {u.gaugePath && <InspectionPhoto path={u.gaugePath} label={`U${x + 1} gauge`} />}
                                                                {u.labelPath && <InspectionPhoto path={u.labelPath} label={`U${x + 1} ${u.expiry || 'exp'}`} />}
                                                            </React.Fragment>
                                                        ))}
                                                        {r.attachment?.data && <a href={r.attachment.data} target="_blank" rel="noreferrer"><img src={r.attachment.data} alt="photo" className="h-20 w-20 object-cover rounded-lg border border-slate-200" /></a>}
                                                    </div>
                                                    {isFail(r) && (
                                                        <div className="mt-2">
                                                            {jobCardExists ? <span className="text-xs font-bold text-emerald-700 bg-emerald-100 py-1 px-2 rounded-full">Job card created</span>
                                                                : <button onClick={() => setJobCardModalItem({ item: { ...r, item: labelOf(r) }, vehicleId: sub.vehicleId })} className="text-xs font-bold bg-[#13294b] hover:bg-[#1d3a66] text-white py-1.5 px-3 rounded-lg">Create job card</button>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {sub.status === 'Submitted' && (
                                <button onClick={handleApprove} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl">Mark as Reviewed</button>
                            )}
                            {sub.status === 'Reviewed' && <p className="text-center text-sm text-slate-500 mt-2">Reviewed{sub.reviewedAt ? ` ${format(new Date(sub.reviewedAt), 'dd MMM HH:mm')}` : ''}{sub.reviewedBy ? ` by ${sub.reviewedBy}` : ''}.</p>}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-slate-400"><p>Select a submission to review.</p></div>
                    )}
                </div>
            </div>

            {jobCardModalItem && (
                <Modal isOpen={!!jobCardModalItem} onClose={() => setJobCardModalItem(null)}>
                    <CreateJobCardFromChecklistModal item={jobCardModalItem.item} vehicle={vehicleMap.get(jobCardModalItem.vehicleId)!} submissionId={sub!.id} onSubmit={handleCreateJobCardSubmit} onClose={() => setJobCardModalItem(null)} />
                </Modal>
            )}
        </>
    );
};

export default ChecklistReview;
