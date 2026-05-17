import React, { useState } from 'react';
import { IncidentReport, IncidentReportType, AtFaultParty, Attachment } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { XIcon } from './icons/XIcon';
import { PlusIcon } from './icons/PlusIcon';

interface AddIncidentFormProps {
    vehicleId: string;
    userId: string;
    onSubmit: (incident: Omit<IncidentReport, 'id' | 'status' | 'quotes' | 'notes'>) => void;
    onCancel: () => void;
}

const DEFAULT_INCIDENT_TYPES: IncidentReportType[] = ['Accident', 'Near-miss', 'Traffic Violation', 'Fine', 'Other'];

const AddIncidentForm: React.FC<AddIncidentFormProps> = ({ vehicleId, userId, onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [incidentTypes, setIncidentTypes] = useState<IncidentReportType[]>(DEFAULT_INCIDENT_TYPES);
    const [incidentType, setIncidentType] = useState<IncidentReportType>('Accident');
    const [description, setDescription] = useState('');
    const [thirdPartyInvolved, setThirdPartyInvolved] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [atFaultParty, setAtFaultParty] = useState<AtFaultParty | ''>('');
    const [insuranceClaimNumber, setInsuranceClaimNumber] = useState('');
    const [sapsCaseNumber, setSapsCaseNumber] = useState('');
    const [finalRepairer, setFinalRepairer] = useState('');
    const [finalRepairCost, setFinalRepairCost] = useState('');
    
    // State for new conditional fields
    const [fineNumber, setFineNumber] = useState('');
    const [fineAmount, setFineAmount] = useState('');
    const [violationCode, setViolationCode] = useState('');

    // State for custom incident type
    const [isAddingType, setIsAddingType] = useState(false);
    const [newIncidentType, setNewIncidentType] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const filePromises = Array.from(files).map((file: File) => {
                return new Promise<Attachment>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        resolve({
                            name: file.name,
                            type: file.type,
                            data: event.target?.result as string,
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(filePromises).then(newAttachments => {
                setAttachments(prev => [...prev, ...newAttachments]);
            });
        }
    };

    const removeAttachment = (indexToRemove: number) => {
        setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
    };
    
    const handleAddNewType = () => {
        if (newIncidentType.trim() && !incidentTypes.includes(newIncidentType.trim())) {
            const newType = newIncidentType.trim();
            setIncidentTypes(prev => [...prev, newType]);
            setIncidentType(newType);
            setNewIncidentType('');
            setIsAddingType(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            vehicleId,
            userId,
            date,
            incidentType,
            description,
            thirdPartyInvolved,
            attachments,
            atFaultParty: atFaultParty || undefined,
            insuranceClaimNumber: insuranceClaimNumber || undefined,
            sapsCaseNumber: sapsCaseNumber || undefined,
            finalRepairer: finalRepairer || undefined,
            finalRepairCost: finalRepairCost ? parseFloat(finalRepairCost) : undefined,
            fineNumber: fineNumber || undefined,
            fineAmount: fineAmount ? parseFloat(fineAmount) : undefined,
            violationCode: violationCode || undefined,
        });
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-6 text-white">Report New Incident</h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClasses} />
                     <div>
                        {!isAddingType ? (
                            <div className="flex items-center space-x-2">
                                <select value={incidentType} onChange={e => setIncidentType(e.target.value as IncidentReportType)} className={inputClasses + " flex-grow"}>
                                    {incidentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                                <button type="button" onClick={() => setIsAddingType(true)} className="p-3 bg-gray-600 rounded-md hover:bg-gray-500" title="Add new type">
                                    <PlusIcon className="h-5 w-5"/>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="text" 
                                    value={newIncidentType} 
                                    onChange={e => setNewIncidentType(e.target.value)} 
                                    placeholder="Enter new incident type"
                                    className={inputClasses + " flex-grow"}
                                />
                                <button type="button" onClick={handleAddNewType} className="bg-green-600 text-white px-4 py-3 rounded-md text-sm font-semibold">Add</button>
                                <button type="button" onClick={() => setIsAddingType(false)} className="bg-gray-600 text-white p-3 rounded-md"><XIcon className="h-5 w-5"/></button>
                            </div>
                        )}
                    </div>
                </div>

                <textarea placeholder="Detailed description of the incident" value={description} onChange={e => setDescription(e.target.value)} rows={5} className={inputClasses} required />
                
                {/* Conditional Fields */}
                {incidentType === 'Fine' && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-900/50 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Fine Number</label>
                            <input type="text" placeholder="Fine Reference Number" value={fineNumber} onChange={e => setFineNumber(e.target.value)} className={inputClasses} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Fine Amount (R)</label>
                            <input type="number" placeholder="e.g., 500.00" value={fineAmount} onChange={e => setFineAmount(e.target.value)} step="0.01" className={inputClasses} required />
                        </div>
                    </div>
                )}
                {incidentType === 'Traffic Violation' && (
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Violation Code/Description</label>
                        <input type="text" placeholder="e.g., Exceeded speed limit" value={violationCode} onChange={e => setViolationCode(e.target.value)} className={inputClasses} required />
                    </div>
                )}
                {incidentType === 'Accident' && (
                     <div className="grid grid-cols-2 gap-4 p-4 bg-gray-900/50 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Insurance Claim #</label>
                            <input type="text" placeholder="Claim Number" value={insuranceClaimNumber} onChange={e => setInsuranceClaimNumber(e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">SAPS Case #</label>
                            <input type="text" placeholder="Case Number" value={sapsCaseNumber} onChange={e => setSapsCaseNumber(e.target.value)} className={inputClasses} />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Attach Photos</label>
                    <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-700 rounded-md border-2 border-dashed border-gray-500 cursor-pointer hover:border-brand-secondary">
                        <UploadIcon className="h-6 w-6 text-gray-400 mr-2" />
                        <span className="text-gray-400">Click to upload photos</span>
                        <input type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*" />
                    </label>
                    {attachments.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {attachments.map((att, index) => (
                                <div key={index} className="relative">
                                    <img src={att.data} alt={att.name} className="w-full h-24 object-cover rounded-md" />
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(index)}
                                        className="absolute top-1 right-1 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-75"
                                    >
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={thirdPartyInvolved} onChange={e => setThirdPartyInvolved(e.target.checked)} className="form-checkbox h-5 w-5 text-brand-primary" />
                    <span>Third Party Involved</span>
                </label>

                {thirdPartyInvolved && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Party at Fault</label>
                        <select value={atFaultParty} onChange={e => setAtFaultParty(e.target.value as AtFaultParty | '')} className={inputClasses}>
                            <option value="">-- Undetermined --</option>
                            <option value="Driver">Driver</option>
                            <option value="Third Party">Third Party</option>
                        </select>
                    </div>
                )}

                <div className="pt-4 border-t border-gray-700">
                    <h4 className="text-lg font-semibold text-gray-300 mb-2">Repair &amp; Cost Details (Optional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Final Repairer</label>
                            <input type="text" placeholder="Repairer Name" value={finalRepairer} onChange={e => setFinalRepairer(e.target.value)} className={inputClasses} />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Final Repair Cost (R)</label>
                            <input type="number" placeholder="e.g., 15000.00" value={finalRepairCost} onChange={e => setFinalRepairCost(e.target.value)} step="0.01" className={inputClasses} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg">Report Incident</button>
            </div>
        </form>
    );
};

export default AddIncidentForm;