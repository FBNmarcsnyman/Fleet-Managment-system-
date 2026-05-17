import React, { useMemo } from 'react';
import { useVehicles } from '../../contexts/AppContexts';

const TopVehiclesWidget: React.FC = () => {
    const { vehicles = [], revenueEntries = [], fuelEntriesWithCost = [] } = useVehicles();

    const vehicleProfits = useMemo(() => {
        return (vehicles || []).map(v => {
            const revenue = (revenueEntries || []).filter(r => r.vehicleId === v.id).reduce((sum, r) => sum + r.amount, 0);
            const cost = (fuelEntriesWithCost || []).filter(f => f.vehicleId === v.id).reduce((sum, f) => sum + f.cost, 0);
            return { name: v.name, profit: revenue - cost };
        }).sort((a, b) => b.profit - a.profit);
    }, [vehicles, revenueEntries, fuelEntriesWithCost]);
    
    const topPerformers = vehicleProfits.slice(0, 3);
    const bottomPerformers = vehicleProfits.slice(-3).reverse();

    return (
        <div className="space-y-4">
            <div>
                <h4 className="font-semibold text-green-400 mb-2">Top Performers</h4>
                {topPerformers.map(v => (
                    <div key={v.name} className="flex justify-between text-sm">
                        <span>{v.name}</span>
                        <span className="font-mono">R {v.profit.toLocaleString()}</span>
                    </div>
                ))}
            </div>
             <div>
                <h4 className="font-semibold text-red-400 mb-2">Bottom Performers</h4>
                {bottomPerformers.map(v => (
                    <div key={v.name} className="flex justify-between text-sm">
                        <span>{v.name}</span>
                        <span className="font-mono">R {v.profit.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TopVehiclesWidget;