import React, { useState, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import { LoadConfirmation, Vehicle, User, Client } from '../../types';
import { SparklesIcon } from '../icons/SparklesIcon';
import { useOperations, useVehicles, useUIState } from '../../contexts/AppContexts';

interface AIDispatchAssistantModalProps {
    onCancel: () => void;
}

interface AssignmentSuggestion {
    loadConId: string;
    vehicleId: string;
    driverId: string;
    reasoning: string;
}

const AIDispatchAssistantModal: React.FC<AIDispatchAssistantModalProps> = ({ onCancel }) => {
    const { loadConfirmations = [], handleAssignLoadConfirmation, clients = [], users = [] } = useOperations();
    const { vehicles = [] } = useVehicles();
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<AssignmentSuggestion[]>([]);
    
    const unassignedJobs = useMemo(() => (loadConfirmations || []).filter((j: LoadConfirmation) => j.status === 'Booked'), [loadConfirmations]);
    const availableVehicles = useMemo(() => (vehicles || []).filter((v: Vehicle) => v.status === 'On the road'), [vehicles]);
    const availableDrivers = useMemo(() => (users || []).filter((u: User) => u.role === 'Driver'), [users]);


    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setSuggestions([]);

        if (!process.env.API_KEY) {
            setError("AI Assistant is not configured.");
            setIsLoading(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const jobsData = unassignedJobs.map((j: LoadConfirmation) => ({ id: j.id, from: j.collectionPoint, to: j.deliveryPoint }));
        const vehiclesData = availableVehicles.map((v: Vehicle) => ({ id: v.id, type: v.weightCategory, reg: v.registration }));
        const driversData = availableDrivers.map((d: User) => ({ id: d.email, name: d.name }));

        const prompt = `
            You are an expert logistics dispatcher. Your task is to assign the available jobs to the most suitable vehicles and drivers.
            
            - Prioritize assigning jobs that are geographically close to each other to the same vehicle if possible.
            - Match vehicle type (e.g., '8 TONNER') to the likely job requirements (long-distance vs. local). Assume addresses with city names are local.
            - A driver can only be assigned to one vehicle/job.
            - A vehicle can have multiple jobs if they form a logical route.

            Available Jobs: ${JSON.stringify(jobsData)}
            Available Vehicles: ${JSON.stringify(vehiclesData)}
            Available Drivers: ${JSON.stringify(driversData)}

            Return your response as a JSON array of assignment objects. Each object must have "loadConId", "vehicleId", "driverId", and a brief "reasoning".
        `;

        try {
            // Fix: Changed model to 'gemini-3-pro-preview' for complex reasoning/planning task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                loadConId: { type: Type.STRING },
                                vehicleId: { type: Type.STRING },
                                driverId: { type: Type.STRING },
                                reasoning: { type: Type.STRING },
                            },
                        },
                    },
                },
            });

            const text = response.text;
            const result = JSON.parse(text ? text.trim() : '[]');
            setSuggestions(result);
        } catch (err) {
            setError(`AI planning failed. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplySuggestion = (suggestion: AssignmentSuggestion) => {
        handleAssignLoadConfirmation(suggestion.loadConId, suggestion.vehicleId, suggestion.driverId);
        // Remove from suggestions list to show progress
        setSuggestions(prev => prev.filter(s => s.loadConId !== suggestion.loadConId));
    };
    
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">AI Dispatch Assistant</h2>
            {suggestions.length === 0 ? (
                <>
                    <p className="text-gray-400 mb-6">Let AI suggest the optimal assignments for today's {unassignedJobs.length} unassigned jobs.</p>
                    {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md mb-4">{error}</p>}
                    <div className="flex justify-end space-x-4 mt-8">
                        <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button onClick={handleGenerate} disabled={isLoading || unassignedJobs.length === 0} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center disabled:bg-gray-500">
                            {isLoading ? 'Generating...' : <><SparklesIcon className="h-5 w-5 mr-2"/> Generate Plan</>}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {suggestions.map((s, i) => {
                            const job = unassignedJobs.find(j => j.id === s.loadConId);
                            const vehicle = availableVehicles.find(v => v.id === s.vehicleId);
                            const driver = availableDrivers.find(d => d.email === s.driverId);
                            return (
                                <div key={i} className="bg-gray-700/50 p-3 rounded-lg">
                                    <p className="font-bold text-white">{job?.loadConNumber}: {job?.collectionPoint} &rarr; {job?.deliveryPoint}</p>
                                    <p className="text-sm text-gray-300">Assign to <strong className="font-mono">{vehicle?.registration}</strong> with driver <strong>{driver?.name}</strong>.</p>
                                    <p className="text-xs text-purple-300 italic mt-1">Reasoning: {s.reasoning}</p>
                                    <div className="text-right mt-2">
                                        <button onClick={() => handleApplySuggestion(s)} className="text-xs font-semibold bg-green-600 text-white py-1 px-3 rounded-lg">Accept & Assign</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                     <div className="flex justify-end mt-8">
                        <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Close</button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AIDispatchAssistantModal;