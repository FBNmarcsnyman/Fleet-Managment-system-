import React, { useMemo } from 'react';
import { Vehicle, CalculatedFuelEntry } from '../../types';
import StatCard from '../StatCard';
import FuelConsumptionAnalysis from '../FuelConsumptionAnalysis';

interface Props {
    vehicle: Vehicle;
    calculatedFuelData: CalculatedFuelEntry[];
}

const isSane = (c: number) => c >= 3 && c <= 150;

const VehicleFuelPerformance: React.FC<Props> = ({ vehicle, calculatedFuelData }) => {
    const stats = useMemo(() => {
        const data = calculatedFuelData || [];
        const sane = data.filter(d => isSane(d.consumption));
        const n = sane.length;
        const avgConsumption = n ? sane.reduce((s, d) => s + d.consumption, 0) / n : 0;
        const avgCpk = n ? sane.reduce((s, d) => s + d.cpk, 0) / n : 0;
        const totalCost = data.reduce((s, d) => s + d.cost, 0);
        const totalDistance = data.reduce((s, d) => s + d.distance, 0);
        const totalLitres = data.reduce((s, d) => s + d.liters, 0);

        const best = sane.reduce<CalculatedFuelEntry | null>((b, d) => (!b || d.consumption < b.consumption ? d : b), null);
        const worst = sane.reduce<CalculatedFuelEntry | null>((w, d) => (!w || d.consumption > w.consumption ? d : w), null);

        return { n, avgConsumption, avgCpk, totalCost, totalDistance, totalLitres, best, worst };
    }, [calculatedFuelData]);

    const target = vehicle.costPerKmTarget;
    const overTarget = target != null && target > 0 && stats.avgCpk > target;
    const fmtR = (v: number) => `R${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    if (stats.n === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-500">
                Not enough fuel data for this vehicle to compute performance. Needs at least two odometer-linked fills.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Avg Consumption" value={`${stats.avgConsumption.toFixed(1)} L/100km`} />
                <StatCard title="Avg Cost per km" value={`R${stats.avgCpk.toFixed(2)}/km`} />
                <StatCard title="Total Fuel Spend" value={fmtR(stats.totalCost)} />
                <StatCard title="Distance (fuel-tracked)" value={`${Math.round(stats.totalDistance).toLocaleString()} km`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
                    <p className="text-sm text-gray-400 mb-1">Best Fill</p>
                    <p className="text-2xl font-bold text-green-400">{stats.best ? `${stats.best.consumption.toFixed(1)} L/100km` : '—'}</p>
                    {stats.best && <p className="text-xs text-gray-500 mt-1">{stats.best.date.split('T')[0]}</p>}
                </div>
                <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
                    <p className="text-sm text-gray-400 mb-1">Worst Fill</p>
                    <p className="text-2xl font-bold text-red-400">{stats.worst ? `${stats.worst.consumption.toFixed(1)} L/100km` : '—'}</p>
                    {stats.worst && <p className="text-xs text-gray-500 mt-1">{stats.worst.date.split('T')[0]}</p>}
                </div>
                <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
                    <p className="text-sm text-gray-400 mb-1">vs CPK Target</p>
                    {target != null && target > 0 ? (
                        <>
                            <p className={`text-2xl font-bold ${overTarget ? 'text-red-400' : 'text-green-400'}`}>
                                {overTarget ? '▲' : '▼'} R{Math.abs(stats.avgCpk - target).toFixed(2)}/km
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Target R{target.toFixed(2)}/km · {overTarget ? 'over budget' : 'within budget'}</p>
                        </>
                    ) : (
                        <p className="text-2xl font-bold text-gray-500">No target set</p>
                    )}
                </div>
            </div>

            <FuelConsumptionAnalysis calculatedFuelData={calculatedFuelData} />
        </div>
    );
};

export default React.memo(VehicleFuelPerformance);
