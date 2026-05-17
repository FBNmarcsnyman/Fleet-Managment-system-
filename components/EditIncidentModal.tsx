import React, { useState } from 'react';
import { IncidentReport, User, IncidentStatus, AtFaultParty, IncidentQuote, Attachment } from '../types';
import { PaperClipIcon } from './icons/PaperClipIcon';

interface EditIncidentModalProps {
    incident: IncidentReport;
    users: User[];
    onUpdate: (updatedIncident: IncidentReport) => void;
    onAddQuote: (quote: Omit<IncidentQuote, 'attachment'>, file: File) => void;
    onCancel: () => void;
}

const EditIncidentModal: React.FC<EditIncidentModalProps> = ({ incident, users, onUpdate, onAddQuote, onCancel }) => {
    const [status, setStatus] = useState<IncidentStatus>(incident.status);
    const [atFaultParty, setAtFaultParty] = useState<AtFaultParty | undefined>(incident.atFaultParty);
    const [insuranceClaimNumber, setInsuranceClaimNumber] = useState(incident.insuranceClaimNumber || '');
    const [sapsCaseNumber, setSapsCaseNumber] = useState(incident.sapsCaseNumber || '');
    const [finalRepairer, setFinalRepairer] = useState(incident.finalRepairer || '');
    const [finalRepairCost, setFinalRepairCost] = useState(incident.finalRepairCost?.toString() || '');
    const [notes, setNotes] = useState(incident.notes || '');

    // --- Quote Sub-component ---
    const [quoteVendor, setQuoteVendor] = useState('');
    const [quoteAmount, setQuoteAmount] = useState('');
    const [quoteFile, setQuoteFile] = useState<File | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updatedIncident: IncidentReport = {
            ...incident,
            status,
            atFaultParty,
            insuranceClaimNumber,
            sapsCaseNumber,
            finalRepairer,
            finalRepairCost: finalRepairCost ? parseFloat(finalRepairCost) : undefined,
            notes,
        };
        onUpdate(updatedIncident);
    };

    const handleAddQuote = () => {
        if (!quoteVendor || !quoteAmount || !quoteFile) {
            alert("Please fill all quote fields and select a file.");
            return;
        }
        onAddQuote({ vendor: quoteVendor, amount: parseFloat(quoteAmount) }, quoteFile);
        setQuoteVendor('');
        setQuoteAmount('');
        setQuoteFile(null);
        // Also clear the file input visually
        const fileInput = document.getElementById('quote-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const inputClasses = "w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";
    
    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Manage Incident #{incident.id.slice(-6).toUpperCase()}</h2>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value as IncidentStatus)} className={inputClasses}>
                            {(['Reported', 'Claim Submitted', 'Awaiting Quotes', 'Awaiting Repair', 'Repairs Complete', 'Closed'] as IncidentStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Party at Fault</label>
                        <select value={atFaultParty || ''} onChange={e => setAtFaultParty(e.target.value as AtFaultParty)} className={inputClasses}>
                            <option value="">-- Undetermined --</option>
                            <option value="Driver">Driver</option>
                            <option value="Third Party">Third Party</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Insurance Claim #" value={insuranceClaimNumber} onChange={e => setInsuranceClaimNumber(e.target.value)} className={inputClasses} />
                    <input type="text" placeholder="SAPS Case #" value={sapsCaseNumber} onChange={e => setSapsCaseNumber(e.target.value)} className={inputClasses} />
                </div>
                
                <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold text-white">Repair Quotes</h4>
                     {incident.quotes.length > 0 && (
                        <div className="space-y-2">
                            {incident.quotes.map((q, index) => (
                                <div key={index} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-md">
                                    <div>
                                        <p className="font-semibold">{q.vendor}</p>
                                        <p className="text-sm font-mono text-gray-300">R {q.amount.toFixed(2)}</p>
                                    </div>
                                    <a href={q.attachment.data} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-400 hover:text-white">
                                        <PaperClipIcon className="h-4 w-4 mr-1"/> View Quote
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                         <input type="text" placeholder="Vendor Name" value={quoteVendor} onChange={e => setQuoteVendor(e.target.value)} className={inputClasses} />
                         <input type="number" placeholder="Amount (R)" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} step="0.01" className={inputClasses} />
                         <input type="file" id="quote-file-input" onChange={e => setQuoteFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white" />
                    </div>
                    <button type="button" onClick={handleAddQuote} className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-lg">Add Quote</button>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold text-white">Final Repair Details</h4>
                     <div className="grid grid-cols-2 gap-4">
                         <input type="text" placeholder="Final Repairer" value={finalRepairer} onChange={e => setFinalRepairer(e.target.value)} className={inputClasses} />
                         <input type="number" placeholder="Final Repair Cost (R)" value={finalRepairCost} onChange={e => setFinalRepairCost(e.target.value)} step="0.01" className={inputClasses} />
                    </div>
                    {atFaultParty === 'Driver' && finalRepairCost && <p className="text-xs text-orange-400">Note: Saving this will generate an HR case for cost recovery from the driver.</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClasses}></textarea>
                </div>

            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
            </div>
        </form>
    );
};

export default EditIncidentModal;
