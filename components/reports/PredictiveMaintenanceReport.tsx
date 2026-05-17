import React, { useState } from 'react';
import { useVehicles, useWorkshop } from '../../contexts/AppContexts';
import AIInsights from '../AIInsights';

const PredictiveMaintenanceReport: React.FC = () => {
    const { vehicles = [], calculatedFuelData = [], serviceEntries = [], recurringCosts = [] } = useVehicles();
    const { jobCards = [] } = useWorkshop();
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

    const selectedVehicle = (vehicles || []).find(v => v.id === selectedVehicleId);

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-6">Predictive Maintenance Report</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <label htmlFor="vehicle-select" className="block text-sm font-medium text-gray-300 mb-1">
                    Select a Vehicle to Analyze
                </label>
                <select
                    id="vehicle-select"
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full max-w-md bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary mb-6"
                >
                    <option value="" disabled>-- Choose a vehicle --</option>
                    {(vehicles || []).map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>
                    ))}
                </select>

                {selectedVehicle ? (
                    <AIInsights
                        vehicle={selectedVehicle}
                        calculatedFuelData={(calculatedFuelData || []).filter(d => d.vehicleId === selectedVehicleId)}
                        serviceEntries={(serviceEntries || []).filter(s => s.vehicleId === selectedVehicleId)}
                        recurringCosts={(recurringCosts || []).filter(rc => rc.vehicleId === selectedVehicleId)}
                        jobCards={(jobCards || []).filter(jc => jc.vehicleId === selectedVehicleId)}
                    />
                ) : (
                    <div className="text-center py-16 text-gray-500">
                        <p>Please select a vehicle to generate a predictive maintenance report.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PredictiveMaintenanceReport;