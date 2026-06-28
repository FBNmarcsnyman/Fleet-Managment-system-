import React, { useState } from 'react';
import { ChecklistItemResult, Vehicle, JobCard } from '../../types';

interface CreateJobCardFromChecklistModalProps {
    item: ChecklistItemResult;
    vehicle: Vehicle;
    submissionId: string;
    onSubmit: (jobCard: Omit<JobCard, 'id'>) => void;
    onClose: () => void;
}

const CreateJobCardFromChecklistModal: React.FC<CreateJobCardFromChecklistModalProps> = ({ item, vehicle, submissionId, onSubmit, onClose }) => {
    // The QR inspection uses Critical/Urgent/Minor; map to the job-card priority scale.
    const toJcLevel = (s?: string): JobCard['severity'] => s === 'Critical' ? 'Critical' : s === 'Urgent' || s === 'High' ? 'High' : s === 'Minor' || s === 'Low' ? 'Low' : 'Medium';
    const [priority, setPriority] = useState<JobCard['priority']>(item.priority ? toJcLevel(item.priority) : (item.status === 'Fail' ? 'High' : 'Medium'));
    const [severity, setSeverity] = useState<JobCard['severity']>(item.severity ? toJcLevel(item.severity) : (item.status === 'Fail' ? 'High' : 'Medium'));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            vehicleId: vehicle.id,
            submissionId: submissionId,
            checklistItemId: item.itemId,
            itemDescription: item.item,
            reporterNotes: item.notes || 'No notes provided by driver.',
            reporterAttachment: item.attachment,
            status: 'Reported',
            priority,
            severity,
            reportedDate: new Date().toISOString(),
            type: 'Repair',
        });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Create Job Card</h2>
            <div className="space-y-4">
                <p><strong className="text-gray-400">Vehicle:</strong> {vehicle.registration}</p>
                <p><strong className="text-gray-400">Item:</strong> {item.item}</p>
                <p><strong className="text-gray-400">Driver Notes:</strong> <em className="text-gray-300">"{item.notes || 'N/A'}"</em></p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                        <select value={priority} onChange={e => setPriority(e.target.value as any)} className={inputClasses}>
                            <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Severity</label>
                        <select value={severity} onChange={e => setSeverity(e.target.value as any)} className={inputClasses}>
                            <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Create Job Card</button>
            </div>
        </form>
    );
};

export default CreateJobCardFromChecklistModal;