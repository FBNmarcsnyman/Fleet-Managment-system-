import React, { useState, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { JobCard, Part, Client, User, Vehicle } from '../../types';
import { useWorkshop, useOperations, useVehicles, useUIState } from '../../contexts/AppContexts';
import { SparklesIcon } from '../icons/SparklesIcon';

const AITriageModal: React.FC = () => {
    const { jobCards = [], parts = [], applyAiAssignments, users = [] } = useWorkshop();
    const { clients = [] } = useOperations();
    const { vehicles = [] } = useVehicles();
    const { hideModal } = useUIState();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Partial<JobCard>[]>([]);
    
    const unassignedJobs = useMemo(() => (jobCards || []).filter((j: JobCard) => j.status === 'Reported'), [jobCards]);
    const technicians = useMemo(() => (users || []).filter((u: User) => u.role === 'Workshop Manager' || u.role === 'Staff'), [users]);


    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);

        if (!process.env.API_KEY) {
            setError("AI Assistant is not configured.");
            setIsLoading(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const jobsData = unassignedJobs.map((j: JobCard) => {
            const vehicle = (vehicles || []).find((v: Vehicle) => v.id === j.vehicleId);
            const client = (clients || []).find((c: Client) => vehicle?.branch === 'LOADMASTER'); // Simplified logic
            return {
                id: j.id,
                description: j.itemDescription,
                notes: j.reporterNotes,
                sla: client?.slaLevel || 'Standard'
            };
        });
        const partsData = (parts || []).map((p: Part) => ({ name: p.name, stock: p.quantityInStock }));
        const techniciansData = technicians.map((t: User) => ({ id: t.email, name: t.name }));

        const prompt = `
            As an expert workshop manager, your task is to triage incoming job cards. Analyze the job description, client SLA, and parts availability to suggest a priority, severity, assignee, and status.

            - **Severity/Priority:** 'Low', 'Medium', 'High', 'Critical'. Critical issues are safety-related or prevent vehicle operation.
            - **Status:** If a likely part is out of stock (stock: 0), set status to 'Awaiting Parts'. Otherwise, set to 'Awaiting Inspection'.
            - **Assignee:** Assign a technician from the available list.

            Job Cards to Triage: ${JSON.stringify(jobsData)}
            Available Technicians: ${JSON.stringify(techniciansData)}
            Relevant Parts Inventory: ${JSON.stringify(partsData)}

            Return a JSON array of objects. Each object must have "id" (the job card ID), "priority", "severity", "assignedToUserId", "status", and "aiReasoning".
        `;

        try {
            // Use the flash model (the pro model isn't on the free tier → 429 quota error).
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                priority: { type: Type.STRING },
                                severity: { type: Type.STRING },
                                assignedToUserId: { type: Type.STRING },
                                status: { type: Type.STRING },
                                aiReasoning: { type: Type.STRING },
                            },
                        },
                    },
                },
            });
            const text = response.text;
            const result = JSON.parse(text ? text.trim() : '[]');
            setSuggestions(result);
        } catch (err) {
            setError(`AI Triage failed. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        applyAiAssignments(suggestions);
        hideModal();
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">AI Triage Assistant</h2>
            {suggestions.length === 0 ? (
                <>
                    <p className="text-gray-400 mb-6">Analyze {unassignedJobs.length} new job cards to suggest priorities, severities, and assignments.</p>
                    {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md mb-4">{error}</p>}
                    <div className="flex justify-end space-x-4 mt-8">
                        <button type="button" onClick={hideModal} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button onClick={handleGenerate} disabled={isLoading || unassignedJobs.length === 0} className="bg-purple-600 font-bold py-2 px-4 rounded-lg flex items-center disabled:bg-gray-500">
                            {isLoading ? 'Generating...' : <><SparklesIcon className="h-5 w-5 mr-2"/> Generate Suggestions</>}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {suggestions.map((s: any) => {
                            const job = unassignedJobs.find(j => j.id === s.id);
                            return (
                                <div key={s.id} className="bg-gray-700/50 p-3 rounded-lg">
                                    <p className="font-bold text-white">{job?.itemDescription}</p>
                                    <p className="text-xs text-gray-400">Suggested: <strong className="text-purple-300">{s.priority} Priority / {s.status}</strong></p>
                                    <p className="text-xs text-gray-400">Assignee: <strong className="text-purple-300">{(users || []).find((u: User) => u.email === s.assignedToUserId)?.name}</strong></p>
                                    <p className="text-xs text-gray-400 italic mt-1">Reason: {s.aiReasoning}</p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-end space-x-4 mt-8">
                        <button type="button" onClick={hideModal} className="bg-gray-600 font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button onClick={handleApply} className="bg-green-600 font-bold py-2 px-4 rounded-lg">Apply All Suggestions</button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AITriageModal;