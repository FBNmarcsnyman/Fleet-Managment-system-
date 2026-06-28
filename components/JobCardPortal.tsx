import React from 'react';
import { JobCard, JobCardStatus } from '../types';
import { useWorkshop, useVehicles, useUIState } from '../contexts/AppContexts';
import { SparklesIcon } from './icons/SparklesIcon';
import { formatDistanceToNow } from 'date-fns';

const JOB_STATUS_COLUMNS: JobCardStatus[] = [
    'Reported',
    'Awaiting Inspection',
    'Awaiting Parts',
    'Pending Scheduling',
    'Scheduled',
    'In Progress',
    'Awaiting Sign-off',
    'Resolved',
];

const priorityChip: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-slate-100 text-slate-600',
};

const JobCardItem: React.FC<{ jobCard: JobCard, onDragStart: (e: React.DragEvent, id: string) => void, onClick: () => void }> = ({ jobCard, onDragStart, onClick }) => {
    const { vehicles = [] } = useVehicles();
    const vehicle = (vehicles || []).find(v => v.id === jobCard.vehicleId);
    const priorityBorder = { Critical: 'border-l-red-500', High: 'border-l-orange-500', Medium: 'border-l-amber-400', Low: 'border-l-slate-300' }[jobCard.priority] || 'border-l-slate-300';
    const reported = (jobCard as any).reportedDate || (jobCard as any).reported_date;
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, jobCard.id)}
            onClick={onClick}
            className={`bg-white p-3 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 border-l-4 ${priorityBorder}`}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-800 text-sm leading-snug">{jobCard.itemDescription}</p>
                {jobCard.priority && <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityChip[jobCard.priority] || 'bg-slate-100 text-slate-600'}`}>{jobCard.priority}</span>}
            </div>
            <p className="text-xs text-slate-500 mt-1">{vehicle?.registration || 'Unknown vehicle'}{(jobCard as any).type ? ` · ${(jobCard as any).type}` : ''}</p>
            {reported && <p className="text-[10px] text-slate-400 mt-0.5">{formatDistanceToNow(new Date(reported), { addSuffix: true })}</p>}
        </div>
    );
};

const KanbanColumn: React.FC<{
    status: JobCardStatus,
    jobCards: JobCard[],
    onDragStart: (e: React.DragEvent, id: string) => void,
    onDrop: (e: React.DragEvent, status: JobCardStatus) => void,
    onCardClick: (jobCard: JobCard) => void,
}> = ({ status, jobCards, onDragStart, onDrop, onCardClick }) => (
    <div
        onDrop={(e) => onDrop(e, status)}
        onDragOver={(e) => e.preventDefault()}
        className="bg-slate-100 rounded-xl w-64 flex-shrink-0"
    >
        <h3 className="text-sm font-black text-[#13294b] p-3 border-b border-slate-200">{status} <span className="text-slate-400">({jobCards.length})</span></h3>
        <div className="p-2 space-y-2 h-[calc(100vh-28rem)] overflow-y-auto">
            {jobCards.map(jc => (
                <JobCardItem key={jc.id} jobCard={jc} onDragStart={onDragStart} onClick={() => onCardClick(jc)} />
            ))}
            {jobCards.length === 0 && <p className="text-center text-[11px] text-slate-400 py-6">—</p>}
        </div>
    </div>
);

const JobCardPortal: React.FC<any> = () => {
    const { showModal, showToast } = useUIState();
    const { jobCards = [], handleUpdateJobCardStatus } = useWorkshop();

    const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData("jobCardId", id); };
    const handleDrop = (e: React.DragEvent, newStatus: JobCardStatus) => {
        const id = e.dataTransfer.getData("jobCardId");
        const jobCard = (jobCards || []).find((j: JobCard) => j.id === id);
        if (jobCard && jobCard.status !== newStatus) { handleUpdateJobCardStatus(id, newStatus); showToast(`Job card moved to "${newStatus}"`); }
    };
    const handleOpenDetail = (jobCard: JobCard) => showModal('jobCardDetail', { jobCardId: jobCard.id });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black text-[#13294b]">Job Card Portal</h2>
                <button onClick={() => showModal('aiTriage')} className="flex items-center font-bold py-2 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
                    <SparklesIcon className="h-5 w-5 mr-2 text-[#f5b700]" /> AI Triage Assistant
                </button>
            </div>
            <div className="flex space-x-4 overflow-x-auto pb-4">
                {JOB_STATUS_COLUMNS.map(status => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        jobCards={(jobCards || []).filter((j: JobCard) => j.status === status)}
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                        onCardClick={handleOpenDetail}
                    />
                ))}
            </div>
        </div>
    );
};

export default JobCardPortal;
