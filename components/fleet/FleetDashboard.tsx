import React, { useMemo } from 'react';
import { useVehicles, useWorkshop } from '../../contexts/AppContexts';
import StatCard from '../StatCard';
import FuelConsumptionAnalysis from '../FuelConsumptionAnalysis';
import FleetFuelAnalytics from './FleetFuelAnalytics';
import { Vehicle } from '../../types';
import { BRANCHES } from '../../constants';

const FleetDashboard: React.FC = () => {
    const { vehicles = [], calculatedFuelData = [] } = useVehicles();
    const { jobCards = [] } = useWorkshop();

    const stats = useMemo(() => {
        const safeVehicles = vehicles || [];
        const safeJobs = jobCards || [];

        const onTheRoad = safeVehicles.filter(v => v.status === 'On the road').length;
        const inService = safeVehicles.filter(v => v.status === 'In for service').length;
        const offRoad = safeVehicles.filter(v => v.status === 'Off the road').length;
        const total = safeVehicles.filter(v => v.status !== 'Sold').length;
        
        const byBranch = BRANCHES.map(branch => ({
            name: branch,
            count: safeVehicles.filter(v => v.branch === branch && v.status !== 'Sold').length,
        }));

        return { onTheRoad, inService, offRoad, total, byBranch };
    }, [vehicles, jobCards]);

    const highPriorityAssets = useMemo(() => {
        return (vehicles || []).filter(v => 
            (jobCards || []).some(jc => jc.vehicleId === v.id && jc.priority === 'Critical' && jc.status !== 'Resolved')
        );
    }, [vehicles, jobCards]);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Fleet Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Active Assets" value={stats.total.toString()} />
                <StatCard title="On The Road" value={stats.onTheRoad.toString()} />
                <StatCard title="In For Service" value={stats.inService.toString()} />
                <StatCard title="Off The Road" value={stats.offRoad.toString()} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4">Assets by Branch</h3>
                    <div className="space-y-3">
                        {stats.byBranch.map(branch => (
                            <div key={branch.name} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
                                <span className="font-semibold text-gray-300">{branch.name}</span>
                                <span className="text-lg font-bold text-white">{branch.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4">Assets with Critical Jobs</h3>
                    <div className="space-y-3">
                        {highPriorityAssets.length > 0 ? highPriorityAssets.map(v => (
                            <div key={v.id} className="bg-red-900/30 p-3 rounded-md">
                                <p className="font-semibold text-white">{v.name} ({v.registration})</p>
                                <p className="text-sm text-red-300">
                                    {(jobCards || []).find(jc => jc.vehicleId === v.id && jc.priority === 'Critical')?.itemDescription}
                                </p>
                            </div>
                        )) : (
                            <p className="text-center text-gray-500 py-8">No assets have open critical jobs.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-5">Fleet Fuel Analytics</h3>
                <FleetFuelAnalytics />
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-5">Fleet Fuel Trends Over Time</h3>
                <FuelConsumptionAnalysis calculatedFuelData={calculatedFuelData} />
            </div>
        </div>
    );
};

export default FleetDashboard;