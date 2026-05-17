import React from 'react';
import { JobCard, JobCardStatus } from '../types';
import { useWorkshop, useVehicles, useUIState } from '../contexts/AppContexts';
import { SparklesIcon } from './icons/SparklesIcon';

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

const JobCardItem: React.FC<{ jobCard: JobCard, onDragStart: (e: React.DragEvent, id: string) => void, onClick: () => void }> = ({ jobCard, onDragStart, onClick }) => {
    const { vehicles = [] } = useVehicles();
    const vehicle = (vehicles || []).find(v => v.id === jobCard.vehicleId);

    const priorityColor = {
        'Critical': 'border-l-red-500',
        'High': 'border-l-orange-500',
        'Medium': 'border-l-yellow-500',
        'Low': 'border-l-blue-500',
    }[jobCard.priority];

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, jobCard.id)}
            onClick={onClick}
            className={`bg-gray-700 p-3 rounded-md shadow-md cursor-pointer hover:bg-gray-600 border-l-4 ${priorityColor}`}
        >
            <p className="font-bold text-white text-sm">{jobCard.itemDescription}</p>
            <p className="text-xs text-gray-400">{vehicle?.registration || 'Unknown Vehicle'}</p>
        </div>
    );
};

const KanbanColumn: React.FC<{
    status: JobCardStatus,
    jobCards: JobCard[],
    onDragStart: (e: React.DragEvent, id: string) => void,
    onDrop: (e: React.DragEvent, status: JobCardStatus) => void,
    onCardClick: (jobCard: JobCard) => void,
}> = ({ status, jobCards, onDragStart, onDrop, onCardClick }) => {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <div
            onDrop={(e) => onDrop(e, status)}
            onDragOver={handleDragOver}
            className="bg-gray-900/50 rounded-lg w-64 flex-shrink-0"
        >
            <h3 className="text-md font-semibold text-white p-3 border-b border-gray-700 capitalize">{status.toLowerCase()} ({jobCards.length})</h3>
            <div className="p-2 space-y-2 h-[calc(100vh-28rem)] overflow-y-auto">
                {jobCards.map(jc => (
                    <JobCardItem key={jc.id} jobCard={jc} onDragStart={onDragStart} onClick={() => onCardClick(jc)} />
                ))}
            </div>
        </div>
    );
};

const JobCardPortal: React.FC<any> = () => {
    const { showModal, showToast } = useUIState();
    const { jobCards = [], handleUpdateJobCardStatus } = useWorkshop();

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData("jobCardId", id);
    };

    const handleDrop = (e: React.DragEvent, newStatus: JobCardStatus) => {
        const id = e.dataTransfer.getData("jobCardId");
        const jobCard = (jobCards || []).find((j: JobCard) => j.id === id);
        if (jobCard && jobCard.status !== newStatus) {
            handleUpdateJobCardStatus(id, newStatus);
            showToast(`Job card moved to "${newStatus}"`);
        }
    };

    const handleOpenDetail = (jobCard: JobCard) => {
        showModal('jobCardDetail', { jobCardId: jobCard.id });
    };

    const openAITriageModal = () => {
        showModal('aiTriage');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Job Card Portal</h2>
                <button onClick={openAITriageModal} className="flex items-center font-bold py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white">
                    <SparklesIcon className="h-5 w-5 mr-2" /> AI Triage Assistant
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