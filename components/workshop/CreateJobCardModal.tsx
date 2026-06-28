import React, { useState } from 'react';
import { JobCard, JobCardType } from '../../types';
import { useVehicles, useWorkshop, useUIState } from '../../contexts/AppContexts';
import { UploadIcon } from '../icons/UploadIcon';
import DateField from '../operations/DateField';

interface CreateJobCardModalProps {
    vehicleId?: string; // Optional pre-selected vehicle
    onSubmit: (jobCard: Omit<JobCard, 'id'>) => void;
    onCancel: () => void;
}

const CreateJobCardModal: React.FC<CreateJobCardModalProps> = ({ vehicleId: preselectedVehicleId, onSubmit, onCancel }) => {
    const { vehicles } = useVehicles();

    const [vehicleId, setVehicleId] = useState(preselectedVehicleId || '');
    const [itemDescription, setItemDescription] = useState('');
    const [reporterNotes, setReporterNotes] = useState('');
    const [type, setType] = useState<JobCardType>('Repair');
    const [priority, setPriority] = useState<JobCard['priority']>('Medium');
    const [severity, setSeverity] = useState<JobCard['severity']>('Medium');
    const [attachment, setAttachment] = useState<{ name: string; type: string; data: string; } | undefined>();
    const [proposedStartDate, setProposedStartDate] = useState('');
    const [proposedEndDate, setProposedEndDate] = useState('');


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setAttachment({
                    name: file.name,
                    type: file.type,
                    data: event.target?.result as string,
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId || !itemDescription) {
            alert('Please select a vehicle and provide a description.');
            return;
        }
        onSubmit({
            vehicleId,
            itemDescription,
            reporterNotes,
            type,
            priority,
            severity,
            reporterAttachment: attachment,
            reportedDate: new Date().toISOString(),
            status: 'Reported',
            proposedStartDate: proposedStartDate || undefined,
            proposedEndDate: proposedEndDate || undefined,
        });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Create New Job Card</h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle / Asset</label>
                    <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className={inputClasses} disabled={!!preselectedVehicleId}>
                        <option value="" disabled>-- Select an asset --</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Job Description</label>
                    <input type="text" value={itemDescription} onChange={e => setItemDescription(e.target.value)} required placeholder="e.g., Replace front brake pads" className={inputClasses} />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Job Type</label>
                    <select value={type} onChange={e => setType(e.target.value as JobCardType)} className={inputClasses}>
                        <option value="Repair">Repair</option>
                        <option value="Service">Service</option>
                        <option value="Inspection">Inspection</option>
                        <option value="Tyre Change">Tyre Change</option>
                        <option value="Spot Check">Spot Check</option>
                    </select>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Proposed Start Date (Optional)</label>
                        <DateField value={proposedStartDate} onChange={setProposedStartDate} className={inputClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Proposed End Date (Optional)</label>
                        <DateField value={proposedEndDate} onChange={setProposedEndDate} className={inputClasses} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                    <textarea value={reporterNotes} onChange={e => setReporterNotes(e.target.value)} rows={3} placeholder="Add any extra details..." className={inputClasses} />
                </div>
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
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Attach Photo (Optional)</label>
                    <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-700 rounded-md border-2 border-dashed border-gray-500 cursor-pointer hover:border-brand-secondary">
                        <UploadIcon className="h-6 w-6 text-gray-400 mr-2" />
                        <span className="text-gray-400">{attachment ? attachment.name : 'Click to upload'}</span>
                        <input type="file" onChange={handleFileChange} className="hidden" accept="image/*"/>
                    </label>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Create Job</button>
            </div>
        </form>
    );
};

export default CreateJobCardModal;