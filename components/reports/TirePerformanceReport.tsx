import React, { useMemo } from 'react';
import { useWorkshop } from '../../contexts/AppContexts';
import VehicleComparisonChart from '../charts/VehicleComparisonChart';

const TirePerformanceReport: React.FC = () => {
    const { tires = [] } = useWorkshop();

    const brandData = useMemo(() => {
        const brands = new Map<string, { totalDistance: number; totalCost: number; count: number }>();
        
        (tires || []).forEach(tire => {
            if (!brands.has(tire.brand)) {
                brands.set(tire.brand, { totalDistance: 0, totalCost: 0, count: 0 });
            }
            const brandStats = brands.get(tire.brand)!;
            brandStats.count++;
            brandStats.totalCost += tire.purchasePrice;

            const tireDistance = (tire.mountHistory || []).reduce((total, h) => {
                return total + ((h.dismountOdometer || 0) - (h.mountOdometer || 0));
            }, 0);
            brandStats.totalDistance += tireDistance;
        });

        return Array.from(brands.entries()).map(([name, stats]) => ({
            name,
            avgDistance: stats.totalDistance / stats.count,
            cpk: stats.totalDistance > 0 ? stats.totalCost / stats.totalDistance : 0,
        }));
    }, [tires]);

    return (
        <div className="space-y-8">
             <h2 className="text-3xl font-bold text-white">Tire Performance Report</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Average Distance by Brand</h3>
                <VehicleComparisonChart data={brandData.sort((a,b) => b.avgDistance - a.avgDistance)} dataKey="avgDistance" unit="km" />
            </div>
             <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Cost Per Kilometer (CPK) by Brand</h3>
                <VehicleComparisonChart data={brandData.filter(d => d.cpk > 0).sort((a,b) => a.cpk - b.cpk)} dataKey="cpk" unit="R" formatAsFloat={true} />
            </div>
        </div>
    );
};

export default TirePerformanceReport;