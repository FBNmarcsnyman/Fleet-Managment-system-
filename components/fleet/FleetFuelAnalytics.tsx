import React, { useMemo, useState } from 'react';
import { useVehicles } from '../../contexts/AppContexts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '../StatCard';
import { Vehicle, VehiclePerformanceStats } from '../../types';

const MIN_POINTS = 3; // vehicles need at least this many valid fills to be ranked

const fmtL = (n: number) => `${n.toFixed(1)} L/100km`;
const fmtR = (n: number) => `R${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtCpk = (n: number) => `R${n.toFixed(2)}/km`;

interface RankedVehicle {
    vehicle: Vehicle;
    stats: VehiclePerformanceStats;
}

const FleetFuelAnalytics: React.FC = () => {
    const { vehicles = [], vehiclePerformanceMap } = useVehicles();
    const [branchFilter, setBranchFilter] = useState<string>('ALL');

    const { fleet, branches, ranked } = useMemo(() => {
        const perfMap: Map<string, VehiclePerformanceStats> = vehiclePerformanceMap || new Map();

        const withStats: RankedVehicle[] = (vehicles || [])
            .map(v => ({ vehicle: v, stats: perfMap.get(v.id) }))
            .filter((x): x is RankedVehicle => !!x.stats && x.stats.totalDistance > 0);

        const scope = branchFilter === 'ALL'
            ? withStats
            : withStats.filter(x => x.vehicle.branch === branchFilter);

        // Distance-weighted fleet totals (more accurate than averaging per-vehicle means).
        const sum = (sel: (s: VehiclePerformanceStats) => number) =>
            scope.reduce((acc, x) => acc + sel(x.stats), 0);
        const totalDistance = sum(s => s.totalDistance);
        const totalLitres = sum(s => s.totalLitres);
        const totalCost = sum(s => s.totalCost);
        const fleet = {
            avgConsumption: totalDistance > 0 ? (totalLitres / totalDistance) * 100 : 0,
            avgCpk: totalDistance > 0 ? totalCost / totalDistance : 0,
            totalLitres,
            totalCost,
            totalDistance,
            vehicleCount: scope.length,
        };

        // Per-branch aggregation (always all branches, ignores the scope filter).
        const branchMap = new Map<string, { distance: number; litres: number; cost: number; count: number }>();
        for (const x of withStats) {
            const b = x.vehicle.branch || 'Unassigned';
            const agg = branchMap.get(b) || { distance: 0, litres: 0, cost: 0, count: 0 };
            agg.distance += x.stats.totalDistance;
            agg.litres += x.stats.totalLitres;
            agg.cost += x.stats.totalCost;
            agg.count += 1;
            branchMap.set(b, agg);
        }
        const branches = [...branchMap.entries()]
            .map(([name, a]) => ({
                name,
                count: a.count,
                avgConsumption: a.distance > 0 ? (a.litres / a.distance) * 100 : 0,
                avgCpk: a.distance > 0 ? a.cost / a.distance : 0,
                totalCost: a.cost,
            }))
            .sort((a, b) => a.avgConsumption - b.avgConsumption);

        // Rankings: vehicles with enough data, by avg consumption (lower = better).
        const rankable = scope
            .filter(x => x.stats.points >= MIN_POINTS && x.stats.avgConsumption > 0)
            .sort((a, b) => a.stats.avgConsumption - b.stats.avgConsumption);
        const ranked = {
            best: rankable.slice(0, 5),
            worst: [...rankable].reverse().slice(0, 5),
        };

        return { fleet, branches, ranked };
    }, [vehicles, vehiclePerformanceMap, branchFilter]);

    const branchOptions = useMemo<string[]>(() => {
        const seen: string[] = [];
        (vehicles || []).forEach(v => {
            const b = v.branch ? String(v.branch) : '';
            if (b && !seen.includes(b)) seen.push(b);
        });
        return ['ALL', ...seen];
    }, [vehicles]);

    const maxBranchConsumption = Math.max(1, ...branches.map(b => b.avgConsumption));

    if (fleet.vehicleCount === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-500">
                No fuel analytics available yet. Import or log fuel entries to populate this view.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Scope filter */}
            <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Scope:</span>
                <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                    {branchOptions.map(b => (
                        <option key={b} value={b}>{b === 'ALL' ? 'Whole Fleet' : b}</option>
                    ))}
                </select>
                <span className="text-xs text-gray-500">{fleet.vehicleCount} vehicles with data</span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Avg Consumption" value={fmtL(fleet.avgConsumption)} />
                <StatCard title="Avg Cost per km" value={fmtCpk(fleet.avgCpk)} />
                <StatCard title="Total Fuel Cost" value={fmtR(fleet.totalCost)} />
                <StatCard title="Total Litres" value={`${Math.round(fleet.totalLitres).toLocaleString()} L`} />
            </div>

            {/* Per-branch comparison */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4">Consumption by Branch</h3>
                {branches.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ResponsiveContainer width="100%" height={Math.max(160, branches.length * 56)}>
                            <BarChart data={branches} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                                <XAxis type="number" stroke="#9ca3af" tickFormatter={v => `${v.toFixed(0)}`} />
                                <YAxis type="category" dataKey="name" stroke="#9ca3af" width={90} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                    formatter={(v: number) => [fmtL(v), 'Avg Consumption']}
                                />
                                <Bar dataKey="avgConsumption" radius={[0, 4, 4, 0]}>
                                    {branches.map((b, i) => (
                                        <Cell key={b.name} fill={`hsl(${140 - (b.avgConsumption / maxBranchConsumption) * 140}, 70%, 50%)`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                        <th className="py-2 pr-2">Branch</th>
                                        <th className="py-2 px-2 text-right">Vehicles</th>
                                        <th className="py-2 px-2 text-right">L/100km</th>
                                        <th className="py-2 px-2 text-right">CPK</th>
                                        <th className="py-2 pl-2 text-right">Fuel Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branches.map(b => (
                                        <tr key={b.name} className="border-b border-gray-700/50">
                                            <td className="py-2 pr-2 font-semibold text-white">{b.name}</td>
                                            <td className="py-2 px-2 text-right text-gray-300">{b.count}</td>
                                            <td className="py-2 px-2 text-right text-amber-400 font-mono">{b.avgConsumption.toFixed(1)}</td>
                                            <td className="py-2 px-2 text-right text-sky-400 font-mono">{b.avgCpk.toFixed(2)}</td>
                                            <td className="py-2 pl-2 text-right text-gray-300 font-mono">{fmtR(b.totalCost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500 py-6 text-center">No branch data.</p>
                )}
            </div>

            {/* Top 5 / Worst 5 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RankCard title="Top 5 Most Efficient" rows={ranked.best} tone="good" />
                <RankCard title="⚠️ 5 Least Efficient" rows={ranked.worst} tone="bad" />
            </div>
            <p className="text-xs text-gray-500 -mt-4">
                Rankings cover vehicles with at least {MIN_POINTS} valid fills. Lower L/100km is better; compare like-for-like using the vehicle class.
            </p>
        </div>
    );
};

const RankCard: React.FC<{ title: string; rows: RankedVehicle[]; tone: 'good' | 'bad' }> = ({ title, rows, tone }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {rows.length > 0 ? (
            <div className="space-y-2">
                {rows.map((x, i) => (
                    <div key={x.vehicle.id} className="flex items-center justify-between bg-gray-700/40 rounded-md px-3 py-2">
                        <div className="min-w-0">
                            <p className="font-semibold text-white truncate">
                                <span className="text-gray-500 mr-2">{i + 1}.</span>{x.vehicle.name}
                                <span className="text-gray-400 font-normal"> · {x.vehicle.registration}</span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">{x.vehicle.weightCategory} · {x.vehicle.branch}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                            <p className={`font-mono font-bold ${tone === 'good' ? 'text-green-400' : 'text-red-400'}`}>{x.stats.avgConsumption.toFixed(1)}</p>
                            <p className="text-xs text-gray-500">{fmtCpk(x.stats.avgCpk)}</p>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-gray-500 py-6 text-center text-sm">Not enough data to rank vehicles.</p>
        )}
    </div>
);

export default React.memo(FleetFuelAnalytics);
