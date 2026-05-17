import React, { useState } from 'react';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import Modal from './Modal';
import { SparklesIcon } from './icons/SparklesIcon';

interface AIChecklistGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (data: { name: string; items: string[] }) => void;
}

const AIChecklistGeneratorModal: React.FC<AIChecklistGeneratorModalProps> = ({ isOpen, onClose, onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please describe the checklist you want to generate.');
            return;
        }

        setIsLoading(true);
        setError(null);
        
        if (!process.env.API_KEY) {
            setError("API key is not configured. This feature is unavailable.");
            setIsLoading(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const fullPrompt = `Based on the following description, generate a vehicle inspection checklist. Provide a suitable, concise name for the checklist and a comprehensive list of specific, actionable items.
        
        Description: "${prompt}"
        
        Return the response as a single JSON object with a "name" property (string) and an "items" property (array of strings). Do not include any other text or markdown formatting.`;

        try {
            // Fix: Changed model to 'gemini-3-flash-preview' for text generation task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: fullPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            name: { 
                                type: Type.STRING,
                                description: 'A concise name for the checklist template.' 
                            },
                            items: {
                                type: Type.ARRAY,
                                description: 'A list of checklist items as strings.',
                                items: { type: Type.STRING }
                            }
                        }
                    }
                }
            });
            
            const text = response.text;
            const jsonString = text ? text.trim() : '{}';
            const generatedData = JSON.parse(jsonString);
            
            if (generatedData.name && Array.isArray(generatedData.items)) {
                onGenerate(generatedData);
                setPrompt(''); // Clear prompt on success
            } else {
                 throw new Error("Invalid format received from AI. Expected { name: string, items: string[] }.");
            }

        } catch (err) {
            setError(`Failed to generate checklist. ${err instanceof Error ? err.message : 'Please try again or check the console for details.'}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (isLoading) return;
        setError(null);
        setPrompt('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose}>
            <div>
                <h2 className="text-2xl font-bold mb-4 text-white">Generate Checklist with AI</h2>
                <p className="text-gray-400 mb-6">
                    Describe the type of checklist you need. Be specific for best results.
                </p>
                <div className="space-y-4">
                     <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A daily safety inspection for a long-haul truck before it leaves the depot, including checks for tires, brakes, and lights."
                        className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary resize-none"
                        rows={5}
                        disabled={isLoading}
                    />
                    {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
                </div>

                <div className="flex justify-end space-x-4 mt-8">
                    <button type="button" onClick={handleClose} disabled={isLoading} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-50">Cancel</button>
                    <button 
                        type="button" 
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                            </>
                        ) : (
                             <>
                                <SparklesIcon className="h-5 w-5 mr-2" />
                                Generate
                             </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AIChecklistGeneratorModal;