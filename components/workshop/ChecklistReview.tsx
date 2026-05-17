import React, { useState, useMemo } from 'react';
import { ChecklistSubmission, ChecklistItemResult, Vehicle, User, JobCard, Branch } from '../../types';
import { format, formatDistanceToNow } from 'date-fns';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { PaperClipIcon } from '../icons/PaperClipIcon';
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

const ChecklistReview: React.FC<ChecklistReviewProps> = ({ 
    currentUser, 
    submissions = [], 
    jobCards = [], 
    vehicles = [], 
    onUpdateSubmission, 
    onCreateJobCard 
}) => {
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'Submitted' | 'Reviewed'>('Submitted');
    const [jobCardModalItem, setJobCardModalItem] = useState<{ item: ChecklistItemResult, vehicleId: string } | null>(null);

    const vehicleMap = useMemo(() => new Map((vehicles || []).map(v => [v.id, v])), [vehicles]);
    
    const filteredSubmissions = useMemo(() => {
        const sorted = (submissions || [])
            .filter(s => s.status === filter)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (!currentUser) return [];

        const userBranches = currentUser.assignedBranches || [];
        if (currentUser.role === 'Super Admin' || userBranches.length === 0) {
            return sorted;
        }

        const canSeeLoadmaster = userBranches.includes('FBN JHB') || userBranches.includes('FBN DBN');

        return sorted.filter(sub => {
            const vehicle = vehicleMap.get(sub.vehicleId);
            if (!vehicle) return false;
            
            if (userBranches.includes(vehicle.branch as Branch)) {
                return true;
            }
            if (vehicle.branch === 'LOADMASTER' && canSeeLoadmaster) {
                return true;
            }
            return false;
        });
    }, [submissions, filter, currentUser, vehicleMap]);

    const selectedSubmission = useMemo(() => {
        return (submissions || []).find(s => s.id === selectedSubmissionId);
    }, [selectedSubmissionId, submissions]);

    const handleApprove = () => {
        if (!selectedSubmission) return;
        onUpdateSubmission({
            ...selectedSubmission,
            status: 'Reviewed',
            reviewedBy: currentUser.email,
            reviewedAt: new Date().toISOString(),
        });
        setSelectedSubmissionId(null); // Move to the next one
    };

    const handleCreateJobCardSubmit = (jobCardData: Omit<JobCard, 'id'>) => {
        onCreateJobCard(jobCardData);
        setJobCardModalItem(null);
    };

    const renderStatusIcon = (status: 'Pass' | 'Needs Attention' | 'Fail') => ({
        'Pass': <CheckCircleIcon className="h-5 w-5 text-green-400 mr-3 flex-shrink-0"/>,
        'Needs Attention': <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3 flex-shrink-0"/>,
        'Fail': <XCircleIcon className="h-5 w-5 text-red-400 mr-3 flex-shrink-0"/>
    })[status];

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-gray-900/50 p-4 rounded-lg flex flex-col h-[calc(100vh-23rem)]">
                    <h3 className="text-xl font-bold text-white mb-4">Review Queue</h3>
                    <div className="flex border-b border-gray-700 mb-2">
                        {(['Submitted', 'Reviewed'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`flex-1 text-center py-2 font-semibold transition-colors border-b-4 ${filter === f ? 'text-white border-brand-secondary' : 'text-gray-400 border-transparent'}`}>{f}</button>
                        ))}
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-3">
                        {filteredSubmissions.map(sub => (
                             <div key={sub.id} onClick={() => setSelectedSubmissionId(sub.id)} className={`p-3 rounded-lg cursor-pointer border-l-4 transition-colors ${selectedSubmissionId === sub.id ? 'bg-brand-primary/20 border-brand-secondary' : 'bg-gray-700/50 hover:bg-gray-700 border-gray-600'}`}>
                                <p className="font-bold text-white">{vehicleMap.get(sub.vehicleId)?.registration || 'N/A'}</p>
                                <p className="text-sm text-gray-400">{sub.userName}</p>
                                <p className="text-xs text-gray-500 mt-1">{formatDistanceToNow(new Date(sub.date), { addSuffix: true })}</p>
                            </div>
                        ))}
                         {filteredSubmissions.length === 0 && <p className="text-center text-gray-500 pt-10">No checklists to review.</p>}
                    </div>
                </div>
                <div className="lg:col-span-2 bg-gray-900/50 p-6 rounded-lg h-[calc(100vh-23rem)] overflow-y-auto">
                    {selectedSubmission ? (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-white">{selectedSubmission.templateName}</h2>
                            <p className="text-gray-400">Submitted by {selectedSubmission.userName} on {format(new Date(selectedSubmission.date), 'dd MMM yyyy, HH:mm')}</p>
                            {(selectedSubmission.results || []).map(result => {
                                const jobCardExists = (jobCards || []).some(jc => jc.submissionId === selectedSubmission.id && jc.checklistItemId === result.itemId);
                                return (
                                    <div key={result.itemId} className="bg-gray-700/50 p-3 rounded-md">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">{renderStatusIcon(result.status)}<span className="font-medium text-white">{result.item}</span></div>
                                            {result.attachment && <a href={result.attachment.data} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white"><PaperClipIcon className="h-5 w-5"/></a>}
                                        </div>
                                        {result.status !== 'Pass' && (
                                            <div className="pl-8 mt-2 space-y-2">
                                                {result.notes && <p className="text-sm text-gray-300 italic">"{result.notes}"</p>}
                                                {jobCardExists ? (
                                                    <p className="text-xs font-semibold text-green-400 bg-green-900/50 py-1 px-2 rounded-full inline-block">Job Card Created</p>
                                                ) : (
                                                    <button onClick={() => setJobCardModalItem({ item: result, vehicleId: selectedSubmission.vehicleId })} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-lg">Create Job Card</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {selectedSubmission.status === 'Submitted' && (
                                <button onClick={handleApprove} className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">Mark as Reviewed</button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-gray-500"><p>Select a submission to review.</p></div>
                    )}
                </div>
            </div>
            {jobCardModalItem && (
                 <Modal isOpen={!!jobCardModalItem} onClose={() => setJobCardModalItem(null)}>
                    <CreateJobCardFromChecklistModal
                        item={jobCardModalItem.item}
                        vehicle={vehicleMap.get(jobCardModalItem.vehicleId)!}
                        submissionId={selectedSubmission!.id}
                        onSubmit={handleCreateJobCardSubmit}
                        onClose={() => setJobCardModalItem(null)}
                    />
                </Modal>
            )}
        </>
    );
};

export default ChecklistReview;