import React, { useMemo, useState } from 'react';
import { useOperations, useVehicles } from '../../contexts/AppContexts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { SparklesIcon } from '../icons/SparklesIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { TrendingDownIcon } from '../icons/TrendingDownIcon';

interface LaneData {
    lane: string;
    count: number;
    revenue: number;
    estimatedCost: number;
    profit: number;
    margin: number;
}

const LaneProfitabilityReport: React.FC = () => {
    const { loadConfirmations = [] } = useOperations();
    const { calculatedFuelData = [] } = useVehicles();
    const [analysis, setAnalysis] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // 1. Calculate Fleet Average Cost Per KM (CPK) to estimate trip costs
    const fleetAverageCPK = useMemo(() => {
        if (!calculatedFuelData || calculatedFuelData.length === 0) return 25.00; // Default fallback
        const totalCost = calculatedFuelData.reduce((sum, d) => sum + d.cost, 0);
        const totalDist = calculatedFuelData.reduce((sum, d) => sum + d.distance, 0);
        return totalDist > 0 ? totalCost / totalDist : 25.00;
    }, [calculatedFuelData]);

    // 2. Aggregate Load Data by Lane
    const laneData = useMemo(() => {
        const lanes = new Map<string, LaneData>();

        (loadConfirmations || []).forEach(lc => {
            if (lc.status === 'Cancelled' || !lc.collectionPoint || !lc.deliveryPoint) return;

            // Create a simplified "City to City" key. 
            // In a real app, we'd use geocoding. Here we use the first word or a simple heuristic.
            const origin = lc.collectionPoint.split(',')[0].trim();
            const dest = lc.deliveryPoint.split(',')[0].trim();
            const key = `${origin} → ${dest}`;

            if (!lanes.has(key)) {
                lanes.set(key, { lane: key, count: 0, revenue: 0, estimatedCost: 0, profit: 0, margin: 0 });
            }

            const data = lanes.get(key)!;
            data.count += 1;
            data.revenue += lc.totalAmount;
            
            // Estimate distance (simplified: 500km average or revenue proxy if unknown)
            // In production, use actual trip distances or Google Maps API
            const estimatedDistance = lc.totalAmount / 35; // Rough proxy: R35/km revenue rate
            data.estimatedCost += estimatedDistance * fleetAverageCPK; 
        });

        // Calculate profit and margin
        return Array.from(lanes.values()).map(l => ({
            ...l,
            profit: l.revenue - l.estimatedCost,
            margin: l.revenue > 0 ? ((l.revenue - l.estimatedCost) / l.revenue) * 100 : 0
        })).sort((a, b) => b.profit - a.profit);

    }, [loadConfirmations, fleetAverageCPK]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        if (!process.env.API_KEY) {
            setAnalysis("API Key missing.");
            setIsAnalyzing(false);
            return;
        }
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Analyze this logistics lane profitability data.
                Fleet Avg CPK used: R${fleetAverageCPK.toFixed(2)}.
                
                Data: ${JSON.stringify(laneData.slice(0, 10))}
                
                Identify:
                1. The most profitable lane and why (volume vs margin).
                2. Any loss-making lanes that should be reviewed.
                3. Strategic recommendations (e.g., negotiate better rates on Lane X).
                
                Format as concise markdown.
            `;
            // Fix: Changed model to 'gemini-3-pro-preview' for complex text analysis task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt
            });
            setAnalysis(response.text || 'No analysis returned.');
        } catch (e) {
            setAnalysis("Error generating analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const renderFormattedText = (text: string) => {
        return text.split('\n').map((line, index) => {
            line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) return <li key={index} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: line.substring(line.indexOf(' ') + 1) }} />;
            return <p key={index} dangerouslySetInnerHTML={{ __html: line }} />;
        });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white">Lane Profitability Analysis</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4">Profit by Lane (Top 10)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={laneData.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                            <XAxis type="number" stroke="#9ca3af" tickFormatter={(val) => `R${val/1000}k`} />
                            <YAxis dataKey="lane" type="category" stroke="#9ca3af" width={100} tick={{fontSize: 10}} />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} cursor={{fill: '#374151'}} formatter={(value: number) => `R ${value.toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="revenue" name="Revenue" fill="#10b981" stackId="a" />
                            <Bar dataKey="estimatedCost" name="Est. Cost" fill="#ef4444" stackId="a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                        <SparklesIcon className="h-5 w-5 text-purple-400 mr-2" /> AI Insights
                    </h3>
                    {analysis ? (
                        <div className="prose prose-sm prose-invert overflow-y-auto flex-grow max-h-80">
                            {renderFormattedText(analysis)}
                        </div>
                    ) : (
                        <div className="flex-grow flex items-center justify-center">
                            <button onClick={handleAnalyze} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center disabled:opacity-50">
                                {isAnalyzing ? 'Analyzing...' : 'Generate Strategic Insights'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg overflow-hidden">
                <h3 className="text-xl font-bold text-white mb-4">Detailed Lane Data</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-3 text-gray-300">Lane</th>
                                <th className="p-3 text-gray-300 text-center">Load Count</th>
                                <th className="p-3 text-gray-300 text-right">Total Revenue</th>
                                <th className="p-3 text-gray-300 text-right">Est. Cost</th>
                                <th className="p-3 text-gray-300 text-right">Net Profit</th>
                                <th className="p-3 text-gray-300 text-center">Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {laneData.map((lane, idx) => (
                                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/30">
                                    <td className="p-3 font-medium text-white">{lane.lane}</td>
                                    <td className="p-3 text-center text-gray-400">{lane.count}</td>
                                    <td className="p-3 text-right text-green-400 font-mono">R {lane.revenue.toLocaleString()}</td>
                                    <td className="p-3 text-right text-red-400 font-mono">R {Math.round(lane.estimatedCost).toLocaleString()}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${lane.profit > 0 ? 'text-blue-400' : 'text-red-500'}`}>R {Math.round(lane.profit).toLocaleString()}</td>
                                    <td className="p-3 text-center">
                                        <span className={`flex items-center justify-center ${lane.margin > 20 ? 'text-green-400' : lane.margin > 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                                            {lane.margin.toFixed(1)}%
                                            {lane.margin > 0 ? <TrendingUpIcon className="h-4 w-4 ml-1"/> : <TrendingDownIcon className="h-4 w-4 ml-1"/>}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LaneProfitabilityReport;