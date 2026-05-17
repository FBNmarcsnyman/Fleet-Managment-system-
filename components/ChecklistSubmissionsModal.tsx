import React, { useState, useMemo } from 'react';
import { ChecklistTemplate, ChecklistSubmission, User, Vehicle } from '../types';
import { XIcon } from './icons/XIcon';
import { format, formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

interface ChecklistSubmissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: ChecklistTemplate;
    submissions: ChecklistSubmission[];
    users: User[];
    vehicles: Vehicle[];
    initialSelectedSubmissionId?: string;
    highlightItemId?: string;
}

const ChecklistSubmissionsModal: React.FC<ChecklistSubmissionsModalProps> = ({ isOpen, onClose, template, submissions, users, vehicles, initialSelectedSubmissionId, highlightItemId }) => {
    
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const sortedSubmissions = useMemo(() => submissions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [submissions]);
    
    const [selectedSubmission, setSelectedSubmission] = useState<ChecklistSubmission | null>(() => {
        if (initialSelectedSubmissionId) {
            return sortedSubmissions.find(s => s.id === initialSelectedSubmissionId) || (sortedSubmissions.length > 0 ? sortedSubmissions[0] : null);
        }
        return sortedSubmissions.length > 0 ? sortedSubmissions[0] : null;
    });

    if (!isOpen) return null;

    const hasIssues = (submission: ChecklistSubmission) => submission.results.some(r => r.status !== 'Pass');

    const renderStatusIcon = (status: 'Pass' | 'Needs Attention' | 'Fail') => {
        switch (status) {
            case 'Pass':
                return <CheckCircleIcon className="h-5 w-5 text-green-400 mr-3"/>;
            case 'Needs Attention':
                return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3"/>;
            case 'Fail':
                return <XCircleIcon className="h-5 w-5 text-red-400 mr-3"/>;
            default:
                return null;
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl m-4 relative transform transition-all duration-300 scale-95 h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Checklist Submissions</h2>
                        <p className="text-gray-400">Template: {template.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex-grow flex overflow-hidden">
                    {/* Submission List */}
                    <div className="w-1/3 border-r border-gray-700 overflow-y-auto">
                        {sortedSubmissions.map(sub => {
                            const vehicle = vehicleMap.get(sub.vehicleId);
                            return (
                                <div 
                                    key={sub.id} 
                                    onClick={() => setSelectedSubmission(sub)}
                                    className={`p-4 cursor-pointer border-l-4 ${selectedSubmission?.id === sub.id ? 'bg-brand-primary/20 border-brand-secondary' : 'border-transparent hover:bg-gray-700/50'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-white">{vehicle?.registration || 'Unknown Vehicle'}</p>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${hasIssues(sub) ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                                            {hasIssues(sub) ? 'Issues' : 'Passed'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400">{sub.userName}</p>
                                    <p className="text-xs text-gray-500 mt-1" title={format(new Date(sub.date), 'dd MMM yyyy, HH:mm')}>
                                        {formatDistanceToNow(new Date(sub.date), { addSuffix: true })}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                    {/* Submission Details */}
                    <div className="w-2/3 overflow-y-auto p-6">
                        {selectedSubmission ? (
                            <div className="space-y-4">
                                {selectedSubmission.results.map(result => {
                                    const isHighlighted = highlightItemId && selectedSubmission.id === initialSelectedSubmissionId && highlightItemId === result.itemId;
                                    return (
                                        <div key={result.itemId} className={`p-3 rounded-md transition-all ${isHighlighted ? 'bg-yellow-900/50 ring-2 ring-yellow-500' : 'bg-gray-700/50'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    {renderStatusIcon(result.status)}
                                                    <span className="font-medium text-white">{result.item}</span>
                                                </div>
                                                {result.attachment && (
                                                    <a href={result.attachment.data} target="_blank" rel="noopener noreferrer" title={`View: ${result.attachment.name}`} className="text-gray-400 hover:text-white">
                                                        <PaperClipIcon className="h-5 w-5"/>
                                                    </a>
                                                )}
                                            </div>
                                            {result.status !== 'Pass' && result.notes && (
                                                <p className="text-sm text-gray-300 mt-1 pl-8 italic">"{result.notes}"</p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500">Select a submission to view details.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChecklistSubmissionsModal;