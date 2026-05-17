
import React, { useState } from 'react';
import { HRCase, IncidentReport } from '../types';
import { format } from 'date-fns';

interface EditHRCaseModalProps {
    hrCase: HRCase;
    incidentReports: IncidentReport[];
    onSubmit: (updatedCase: HRCase) => void;
    onCancel: () => void;
}

const EditHRCaseModal: React.FC<EditHRCaseModalProps> = ({ hrCase, incidentReports, onSubmit, onCancel }) => {
    const [costToRecover, setCostToRecover] = useState(hrCase.costToRecover.toString());
    const [damageReason, setDamageReason] = useState(hrCase.damageReason);
    const [incidentId, setIncidentId] = useState(hrCase.incidentId || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cost = parseFloat(costToRecover);
        if (isNaN(cost) || !damageReason.trim()) {
            alert('Please provide a valid reason and cost.');
            return;
        }
        onSubmit({
            ...hrCase,
            costToRecover: cost,
            damageReason: damageReason.trim(),
            incidentId: incidentId || undefined,
        });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Edit HR Case #{hrCase.id}</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="incidentId" className="block text-sm font-medium text-gray-300 mb-1">Link to Incident (Optional)</label>
                    <select
                        id="incidentId"
                        value={incidentId}
                        onChange={e => setIncidentId(e.target.value)}
                        className={inputClasses}
                    >
                        <option value="">-- No linked incident --</option>
                        {incidentReports.map(incident => (
                            <option key={incident.id} value={incident.id}>
                                #{incident.id.slice(-5)} - {incident.incidentType} on {format(new Date(incident.date), 'dd MMM yyyy')}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="damageReason" className="block text-sm font-medium text-gray-300 mb-1">Reason for Damage</label>
                    <textarea
                        id="damageReason"
                        value={damageReason}
                        onChange={e => setDamageReason(e.target.value)}
                        className={inputClasses}
                        rows={4}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="costToRecover" className="block text-sm font-medium text-gray-300 mb-1">Cost to Recover (R)</label>
                    <input
                        id="costToRecover"
                        type="number"
                        value={costToRecover}
                        onChange={e => setCostToRecover(e.target.value)}
                        className={inputClasses}
                        step="0.01"
                        required
                    />
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
            </div>
        </form>
    );
};

export default EditHRCaseModal;
