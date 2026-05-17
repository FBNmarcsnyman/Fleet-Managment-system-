import React, { useMemo } from 'react';
import { useVehicles } from '../../contexts/AppContexts';

const FleetPerformanceReport: React.FC = () => {
    const { 
        vehicles = [], 
        revenueEntries = [], 
        fuelEntriesWithCost = [], 
        generatedOtherCosts = [], 
        serviceEntries = [] 
    } = useVehicles();

    const reportData = useMemo(() => {
        return (vehicles || []).map(vehicle => {
            const revenue = (revenueEntries || []).filter(r => r.vehicleId === vehicle.id).reduce((sum, r) => sum + r.amount, 0);
            const fuelCost = (fuelEntriesWithCost || []).filter(f => f.vehicleId === vehicle.id).reduce((sum, f) => sum + f.cost, 0);
            const otherCost = (generatedOtherCosts || []).filter(c => c.vehicleId === vehicle.id).reduce((sum, c) => sum + c.amount, 0);
            const serviceCost = (serviceEntries || []).filter(s => s.vehicleId === vehicle.id).reduce((sum, s) => sum + s.cost, 0);
            const totalCost = fuelCost + otherCost + serviceCost;
            const netProfit = revenue - totalCost;
            return {
                ...vehicle,
                revenue,
                totalCost,
                netProfit,
            };
        }).sort((a, b) => b.netProfit - a.netProfit);
    }, [vehicles, revenueEntries, fuelEntriesWithCost, generatedOtherCosts, serviceEntries]);

    const formatCurrency = (value: number) => `R ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-6">Fleet Performance Report</h2>
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-4 text-gray-300">Vehicle</th>
                            <th className="p-4 text-gray-300 text-right">Total Revenue</th>
                            <th className="p-4 text-gray-300 text-right">Total Costs</th>
                            <th className="p-4 text-gray-300 text-right">Net Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(data => (
                            <tr key={data.id} className="border-b border-gray-700">
                                <td className="p-4 font-medium text-white">{data.name} ({data.registration})</td>
                                <td className="p-4 text-right font-mono text-green-400">{formatCurrency(data.revenue)}</td>
                                <td className="p-4 text-right font-mono text-red-400">{formatCurrency(data.totalCost)}</td>
                                <td className={`p-4 text-right font-mono font-bold ${data.netProfit >= 0 ? 'text-white' : 'text-red-500'}`}>{formatCurrency(data.netProfit)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FleetPerformanceReport;