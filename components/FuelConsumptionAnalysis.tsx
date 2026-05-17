import React from 'react';
import { CalculatedFuelEntry } from '../types';
import CpkChart from './charts/CpkChart';
import ConsumptionChart from './charts/ConsumptionChart';

interface FuelConsumptionAnalysisProps {
    calculatedFuelData: CalculatedFuelEntry[];
}

const FuelConsumptionAnalysis: React.FC<FuelConsumptionAnalysisProps> = ({ calculatedFuelData }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-white">Cost per Kilometer (CPK) Over Time</h3>
                <CpkChart data={calculatedFuelData} />
            </div>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-white">Fuel Consumption (L/100km) Over Time</h3>
                <ConsumptionChart data={calculatedFuelData} />
            </div>
        </div>
    );
};

export default React.memo(FuelConsumptionAnalysis);
