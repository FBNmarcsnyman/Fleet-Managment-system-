import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { SparklesIcon } from './icons/SparklesIcon';

const RoutePlanner: React.FC = () => {
    const [startPoint, setStartPoint] = useState('');
    const [endPoint, setEndPoint] = useState('');
    const [vehicleType, setVehicleType] = useState('Superlink Truck');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [route, setRoute] = useState<string>('');

    const handlePlanRoute = async () => {
        if (!startPoint || !endPoint) {
            setError('Please provide a start and end point.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setRoute('');

        if (!process.env.API_KEY) {
            setError("API key is not configured. This feature is unavailable.");
            setIsLoading(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
            As a logistics expert, plan the most efficient route for a ${vehicleType} from ${startPoint} to ${endPoint}.
            Consider typical road conditions in South Africa, major highways, and potential hazards for heavy vehicles (like steep passes or small towns).

            Provide the response with the following structure using Markdown:
            - **Route Summary:** A brief overview of the route.
            - **Estimated Distance & Time:** A reasonable estimate for distance (km) and driving time.
            - **Key Waypoints:** A numbered list of major towns or highway changes along the route.
            - **Potential Hazards:** A bulleted list of things the driver should be aware of (e.g., "N3 Mooi River Toll Plaza", "Van Reenen's Pass weather conditions").
        `;

        try {
            // Fix: Changed model to 'gemini-3-flash-preview' for basic text planning task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });
            const text = response.text;
            setRoute(typeof text === 'string' ? text.trim() : '');
        } catch (err) {
            setError('Failed to get route plan. The API call may have been blocked or an error occurred.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const renderFormattedText = (text: string) => {
        return text
            .split('\n')
            .map((line, index) => {
                line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
                if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                    return <li key={index} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: line.substring(line.indexOf(' ') + 1) }} />;
                }
                 if (line.trim().match(/^\d+\./)) {
                    return <li key={index} className="ml-5 list-decimal" dangerouslySetInnerHTML={{ __html: line.substring(line.indexOf(' ') + 1) }} />;
                }
                return <p key={index} dangerouslySetInnerHTML={{ __html: line }} />;
            });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">AI Route Planner</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Start Point</label>
                        <input type="text" value={startPoint} onChange={e => setStartPoint(e.target.value)} placeholder="e.g., City Deep, Johannesburg" className="w-full bg-gray-700 p-2 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">End Point</label>
                        <input type="text" value={endPoint} onChange={e => setEndPoint(e.target.value)} placeholder="e.g., Durban Harbour, Durban" className="w-full bg-gray-700 p-2 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Vehicle Type</label>
                        <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md">
                            <option>Superlink Truck</option>
                            <option>8-Ton Rigid Truck</option>
                            <option>Light Delivery Van</option>
                        </select>
                    </div>
                    <button onClick={handlePlanRoute} disabled={isLoading} className="w-full flex items-center justify-center font-bold py-3 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white disabled:bg-gray-600">
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        {isLoading ? 'Planning...' : 'Generate Route'}
                    </button>
                </div>
            </div>
             <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Generated Route Plan</h3>
                {isLoading && <div className="animate-pulse text-gray-400">Generating route plan...</div>}
                {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</div>}
                {route && (
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300 space-y-2">
                       {renderFormattedText(route)}
                    </div>
                )}
                 {!isLoading && !route && !error && (
                    <div className="flex items-center justify-center h-full text-center text-gray-500">
                        <p>Your generated route plan will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoutePlanner;