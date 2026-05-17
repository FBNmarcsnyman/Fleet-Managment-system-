import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Vehicle, CalculatedFuelEntry, ServiceEntry, RecurringCost, JobCard } from '../types';
import { SparklesIcon } from './icons/SparklesIcon';

interface AIInsightsProps {
    vehicle: Vehicle;
    calculatedFuelData: CalculatedFuelEntry[];
    serviceEntries: ServiceEntry[];
    recurringCosts: RecurringCost[];
    jobCards: JobCard[];
}

const AIInsights: React.FC<AIInsightsProps> = ({ vehicle, calculatedFuelData, serviceEntries, recurringCosts, jobCards }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [insights, setInsights] = useState<string>('');

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        setInsights('');

        if (!process.env.API_KEY) {
            setError("API key is not configured. This feature is unavailable.");
            setIsLoading(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const latestOdometer = calculatedFuelData.length > 0 ? Math.max(...calculatedFuelData.map(d => d.odometer)) : 'N/A';

        const fuelDataSummary = calculatedFuelData.map(d => ({
            date: d.date.split('T')[0],
            distance_km: d.distance.toFixed(1),
            cost_per_km_R: d.cpk.toFixed(3),
            consumption_L_100km: d.consumption.toFixed(2)
        })).slice(-10);

        const serviceSummary = serviceEntries.map(s => ({
            date: s.date.split('T')[0],
            description: s.description,
            cost: s.cost,
            odometer: s.endOdometer
        })).slice(-10);

        const recurringCostSummary = recurringCosts.map(rc => ({
            category: rc.category,
            amount: rc.amount,
            frequency: rc.frequency,
        }));
        
        const jobCardsSummary = jobCards.map(jc => ({
            reportedDate: jc.reportedDate.split('T')[0],
            description: jc.itemDescription,
            status: jc.status,
            priority: jc.priority,
            notes: jc.reporterNotes,
        })).slice(-10);


        const prompt = `
            You are an expert AI fleet maintenance analyst. Your task is to provide a comprehensive analysis and predict potential future mechanical issues for a vehicle based on its full operational history.

            Vehicle Details:
            - Type: ${vehicle.year} ${vehicle.make} ${vehicle.model}
            - Current Odometer: ${latestOdometer} km

            Data Points:

            1. Fuel & Performance Data (last 10 entries):
            ${JSON.stringify(fuelDataSummary, null, 2)}

            2. Service History (last 10 entries):
            ${JSON.stringify(serviceSummary, null, 2)}

            3. Recurring Monthly & Annual Costs:
            ${JSON.stringify(recurringCostSummary, null, 2)}

            4. Reported Issues & Job Cards (last 10 entries):
            ${JSON.stringify(jobCardsSummary, null, 2)}

            Analysis Task:
            Based on an integrated view of all the provided data, please identify:
            1.  **Performance Summary:** A brief, concise summary of the vehicle's recent performance, considering fuel efficiency and costs.
            2.  **Pattern Recognition & Anomalies:** Identify any concerning patterns or anomalies. For example, is fuel consumption increasing despite regular servicing? Are certain types of repairs becoming more frequent? Is there a correlation between high CPK and specific job cards?
            3.  **Predictive Maintenance Forecast:** Based on the patterns, predict the most likely upcoming maintenance needs or component failures. Be specific (e.g., "Given the recurring 'Check Engine Light' job cards and slightly increased fuel consumption, the oxygen sensor may be failing and should be inspected at the next service.").
            4.  **Cost-Saving Recommendations:** Suggest actionable recommendations to improve efficiency or reduce future maintenance costs.

            Present your findings in a clear, easy-to-read format. Use markdown for formatting (e.g., **bold** text, lists with '*' or '-'). Be concise and professional.
        `;
        
        try {
            // Fix: Changed model to 'gemini-3-pro-preview' for complex reasoning/analysis task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
            });
            const text = response.text;
            setInsights(text ? text.trim() : '');
        } catch (err) {
            setError('Failed to get insights. The API call may have been blocked or an error occurred. Please check the console for details.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderFormattedText = (text: string) => {
        return text
            .split('\n')
            .map((line, index) => {
                // Replace **bold** with <strong> tags
                line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                // Replace * or - at the start of a line with a list item
                if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                    return <li key={index} className="ml-5" dangerouslySetInnerHTML={{ __html: line.substring(line.indexOf(' ') + 1) }} />;
                }
                return <p key={index} dangerouslySetInnerHTML={{ __html: line }} />;
            });
    };

    const isAnalysisDisabled = calculatedFuelData.length < 2 && serviceEntries.length === 0 && jobCards.length === 0;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center mb-4">
                <SparklesIcon className="h-6 w-6 text-yellow-400 mr-3"/>
                <h3 className="text-xl font-semibold text-white">AI-Powered Insights</h3>
            </div>
            {insights && (
                 <div className="prose prose-invert prose-sm max-w-none text-gray-300 space-y-2">{renderFormattedText(insights)}</div>
            )}
            {isLoading && (
                 <div className="flex items-center justify-center h-24">
                    <div className="animate-pulse text-gray-400">Analyzing data, please wait...</div>
                </div>
            )}
            {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</div>}
            
            {!isLoading && !insights && (
                 <div className="flex flex-col items-start">
                    <p className="text-gray-400 mb-4">
                        Let AI perform a comprehensive analysis of this vehicle's history to identify patterns, predict maintenance needs, and suggest optimizations.
                    </p>
                    <button 
                        onClick={handleAnalyze} 
                        disabled={isAnalysisDisabled}
                        className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg flex items-center transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed">
                        <SparklesIcon className="h-5 w-5 mr-2"/>
                        Analyze Vehicle Data
                    </button>
                    {isAnalysisDisabled && <p className="text-xs text-gray-500 mt-2">More data (fuel, services, job cards) is required for a comprehensive analysis.</p>}
                 </div>
            )}
        </div>
    );
};

export default AIInsights;