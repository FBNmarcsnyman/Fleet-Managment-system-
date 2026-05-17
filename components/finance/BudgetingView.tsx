import React, { useState, useMemo } from 'react';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import { Vehicle, Budget, Forecast } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { format, subMonths } from 'date-fns';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import BudgetVsActualChart from '../charts/BudgetVsActualChart';

// Helper to render markdown-like text
const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, index) => {
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            return <li key={index} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: line.substring(line.indexOf(' ') + 1) }} />;
        }
        return <p key={index} dangerouslySetInnerHTML={{ __html: line }} />;
    });
};


const BudgetingView: React.FC = () => {
    const { vehicles = [], budgets = [], forecasts = [], handleAddBudget, handleAddForecast, fuelEntriesWithCost = [], serviceEntries = [], generatedOtherCosts = [] } = useVehicles();
    const { showModal, hideModal } = useUIState();
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const vehicleBudgets = useMemo(() => {
        return (budgets || []).filter(b => b.targetId === selectedVehicleId);
    }, [budgets, selectedVehicleId]);

    const vehicleForecast = useMemo(() => {
        return (forecasts || []).find(f => f.targetId === selectedVehicleId);
    }, [forecasts, selectedVehicleId]);

    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const actualSpend = useMemo(() => {
        if (!selectedVehicleId) return 0;
        const fuel = (fuelEntriesWithCost || []).filter(e => e.vehicleId === selectedVehicleId && e.date.startsWith(currentMonthStr)).reduce((sum, e) => sum + e.cost, 0);
        const services = (serviceEntries || []).filter(e => e.vehicleId === selectedVehicleId && e.date.startsWith(currentMonthStr)).reduce((sum, e) => sum + e.cost, 0);
        const other = (generatedOtherCosts || []).filter(c => c.vehicleId === selectedVehicleId && c.date === currentMonthStr).reduce((sum, c) => sum + c.amount, 0);
        return fuel + services + other;
    }, [selectedVehicleId, fuelEntriesWithCost, serviceEntries, generatedOtherCosts, currentMonthStr]);

    const handleOpenSetBudgetModal = () => {
        showModal('setBudget', {
            vehicles: (vehicles || []).filter(v => v.status !== 'Sold'),
            onSubmit: (budget: Omit<Budget, 'id'>) => {
                handleAddBudget(budget);
                hideModal();
            },
            onCancel: hideModal,
        });
    };
    
    const handleGenerateForecast = async () => {
        const vehicle = (vehicles || []).find(v => v.id === selectedVehicleId);
        if (!vehicle) {
            setError("Please select a vehicle first.");
            return;
        }

        setIsLoading(true);
        setError(null);
        
        const costsByMonth: { [key: string]: number } = {};
        const oneYearAgo = subMonths(new Date(), 12);
        
        const processEntry = (dateStr: string, amount: number) => {
            const entryDate = new Date(dateStr.split('T')[0].replace(/-/g, '/'));
            if (entryDate < oneYearAgo) return;
            const month = format(entryDate, 'yyyy-MM');
            costsByMonth[month] = (costsByMonth[month] || 0) + amount;
        };

        (fuelEntriesWithCost || []).filter(e=>e.vehicleId === vehicle.id).forEach(e => processEntry(e.date, e.cost));
        (serviceEntries || []).filter(e=>e.vehicleId === vehicle.id).forEach(e => processEntry(e.date, e.cost));
        (generatedOtherCosts || []).filter(e=>e.vehicleId === vehicle.id).forEach(e => processEntry(`${e.date}-01`, e.amount));
        
        const monthlyCostSummary = Object.entries(costsByMonth).map(([month, amount]) => ({ month, amount: Math.round(amount) }));
        
        const prompt = `You are an expert AI financial analyst for a logistics company. Your task is to provide a 6-month operating cost forecast for a specific vehicle.

Vehicle Details:
- Type: ${vehicle.year} ${vehicle.make} ${vehicle.model}
- Branch: ${vehicle.branch}

Historical Cost Data (last 12 months, summarized by month):
${JSON.stringify(monthlyCostSummary)}

Analysis Task:
1.  **Forecast Costs:** Project the total operating costs for this vehicle for the next 6 months (starting from next month). Consider trends in the historical data. If there are seasonal patterns (like higher maintenance in certain months), factor them in.
2.  **Identify Risks & Insights:** Analyze the historical data to identify potential financial risks or opportunities. For example: "Fuel costs have been steadily increasing over the last 3 months, suggesting a potential performance issue or rising fuel prices." or "A major service is typically due every 60,000 km; based on recent mileage, this may fall in the next quarter, significantly increasing maintenance costs."
3.  **Return a JSON object** with two keys:
    - "forecastedCosts": An array of objects, each with "month" (in "YYYY-MM" format) and "amount" (a number).
    - "insights": A string containing your analysis of risks and opportunities, formatted with markdown.
`;
        
        try {
             if (!process.env.API_KEY) throw new Error("API key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            // Fix: Changed model to 'gemini-3-pro-preview' for complex financial forecasting
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                 config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            forecastedCosts: {
                                type: Type.ARRAY,
                                description: "Array of 6 monthly cost objects.",
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        month: { type: Type.STRING },
                                        amount: { type: Type.NUMBER }
                                    }
                                }
                            },
                            insights: { type: Type.STRING }
                        }
                    }
                }
            });

            const text = response.text;
            const result = JSON.parse(text ? text.trim() : '{}');

            if (result.forecastedCosts && result.insights) {
                const newForecast: Omit<Forecast, 'id'> = {
                    targetId: vehicle.id,
                    generatedDate: new Date().toISOString(),
                    forecastedCosts: result.forecastedCosts,
                    insights: result.insights
                };
                handleAddForecast(newForecast);
            } else {
                throw new Error("Invalid format received from AI.");
            }
        } catch (err) {
            setError(`AI forecast failed. ${err instanceof Error ? err.message : 'Please check console for details.'}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Budgeting & Forecasting</h2>
                <button onClick={handleOpenSetBudgetModal} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Set New Budget
                </button>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <label className="block text-sm font-medium text-gray-300 mb-1">Select Vehicle for Analysis</label>
                <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} className="w-full max-w-md bg-gray-700 p-2 rounded-md">
                    <option value="">-- Select a Vehicle --</option>
                    {(vehicles || []).filter(v => v.status !== 'Sold').map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>)}
                </select>
            </div>
            
            {selectedVehicleId && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Budgets Section */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold text-white mb-4">Monthly Budgets</h3>
                        <div className="space-y-4">
                            {vehicleBudgets.filter(b => b.startDate === currentMonthStr).map(budget => {
                                const percentage = budget.amount > 0 ? (actualSpend / budget.amount) * 100 : 0;
                                const color = percentage > 100 ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500';
                                return (
                                    <div key={budget.id}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-semibold text-gray-300">Total Operating Cost ({format(new Date(), 'MMMM')})</span>
                                            <span className="text-white">R {actualSpend.toLocaleString()} / <span className="text-gray-400">R {budget.amount.toLocaleString()}</span></span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-4">
                                            <div className={`${color} h-4 rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {vehicleBudgets.filter(b => b.startDate === currentMonthStr).length === 0 && <p className="text-gray-500">No budget set for this vehicle for the current month.</p>}
                        </div>
                    </div>
                    
                    {/* Forecasting Section */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h3 className="text-xl font-bold text-white mb-4">AI-Powered Forecast</h3>
                        {isLoading ? <p className="animate-pulse text-yellow-400">Generating forecast...</p> : error ? <p className="text-red-400 bg-red-900/50 p-2 rounded-md text-sm">{error}</p> : vehicleForecast ? (
                             <div className="space-y-4">
                                 <BudgetVsActualChart data={vehicleForecast.forecastedCosts.map((f: any) => ({...f, month: format(new Date(`${f.month}-02`), 'MMM yy')}))} />
                                 <div className="prose prose-sm prose-invert max-w-none text-gray-300 space-y-2">{renderFormattedText(vehicleForecast.insights)}</div>
                             </div>
                        ) : (
                             <button onClick={handleGenerateForecast} className="flex items-center font-bold py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white">
                                <SparklesIcon className="h-5 w-5 mr-2"/> Generate 6-Month Forecast
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetingView;