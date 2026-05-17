import React from 'react';
import { useVehicles } from '../../contexts/AppContexts'; // This component would need financial data
import StatCard from '../StatCard';

const FinancialSummaryStatsWidget: React.FC = () => {
    // In a real app, this would use a dedicated financial context or selector
    const totalRevenue = 1250000; // Placeholder
    const totalCosts = 980000; // Placeholder
    const netProfit = totalRevenue - totalCosts;

    const formatCurrency = (value: number) => `R ${value.toLocaleString()}`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total Revenue (Month)" value={formatCurrency(totalRevenue)} />
            <StatCard title="Total Costs (Month)" value={formatCurrency(totalCosts)} />
            <StatCard title="Net Profit (Month)" value={formatCurrency(netProfit)} />
        </div>
    );
};

export default FinancialSummaryStatsWidget;