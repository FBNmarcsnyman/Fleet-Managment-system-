import React, { useState, useMemo } from 'react';
import { useVehicles } from '../contexts/AppContexts';
import MonthlyFleetCostChart from './charts/MonthlyFleetCostChart';
import VehicleComparisonChart from './charts/VehicleComparisonChart';

type ComparisonMetric = 'totalCost' | 'fuelCost' | 'cpk';

const CostAnalysis: React.FC = () => {
    const { 
        vehicles = [], 
        fuelEntriesWithCost = [], 
        generatedOtherCosts = [], 
        serviceEntries = [], 
        calculatedFuelData = [] 
    } = useVehicles();
    const [metric, setMetric] = useState<ComparisonMetric>('totalCost');

    const comparisonData = useMemo(() => {
        return (vehicles || []).map(vehicle => {
            const fuelCost = (fuelEntriesWithCost || []).filter(f => f.vehicleId === vehicle.id).reduce((sum, f) => sum + f.cost, 0);
            const otherCost = (generatedOtherCosts || []).filter(c => c.vehicleId === vehicle.id).reduce((sum, c) => sum + c.amount, 0);
            const serviceCost = (serviceEntries || []).filter(s => s.vehicleId === vehicle.id).reduce((sum, s) => sum + s.cost, 0);
            const totalCost = fuelCost + otherCost + serviceCost;
            
            const vehicleCpkData = (calculatedFuelData || []).filter(d => d.vehicleId === vehicle.id);
            const avgCpk = vehicleCpkData.length > 0 ? vehicleCpkData.reduce((sum, d) => sum + d.cpk, 0) / vehicleCpkData.length : 0;
            
            return {
                name: vehicle.registration,
                totalCost,
                fuelCost,
                cpk: avgCpk,
            };
        }).sort((a, b) => b[metric] - a[metric]);
    }, [vehicles, fuelEntriesWithCost, generatedOtherCosts, serviceEntries, calculatedFuelData, metric]);

    const getChartProps = () => {
        switch (metric) {
            case 'fuelCost':
                return { dataKey: 'fuelCost', unit: 'R', formatAsFloat: false };
            case 'cpk':
                return { dataKey: 'cpk', unit: 'R', formatAsFloat: true };
            case 'totalCost':
            default:
                return { dataKey: 'totalCost', unit: 'R', formatAsFloat: false };
        }
    };
    
    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Fleet Cost Analysis</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Total Fleet Cost Over Time</h3>
                <MonthlyFleetCostChart
                    fuelEntries={fuelEntriesWithCost || []}
                    otherCosts={generatedOtherCosts || []}
                    serviceEntries={serviceEntries || []}
                />
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Vehicle Cost Comparison</h3>
                    <select value={metric} onChange={e => setMetric(e.target.value as ComparisonMetric)} className="bg-gray-700 p-2 rounded-md">
                        <option value="totalCost">Total Cost</option>
                        <option value="fuelCost">Fuel Cost</option>
                        <option value="cpk">Average CPK</option>
                    </select>
                </div>
                <VehicleComparisonChart data={comparisonData} {...getChartProps()} />
            </div>
        </div>
    );
};

export default CostAnalysis;