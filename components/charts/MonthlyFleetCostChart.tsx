
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { OtherCost, ServiceEntry, FuelEntryWithCost } from '../../types';
import { format } from 'date-fns';

interface MonthlyFleetCostChartProps {
    fuelEntries: FuelEntryWithCost[];
    otherCosts: OtherCost[];
    serviceEntries: ServiceEntry[];
}

const MonthlyFleetCostChart: React.FC<MonthlyFleetCostChartProps> = ({ fuelEntries, otherCosts, serviceEntries }) => {

    const monthlyData = React.useMemo(() => {
        const costsByMonth: { [key: string]: number } = {};

        fuelEntries.forEach(entry => {
            const month = format(new Date(entry.date), 'yyyy-MM');
            costsByMonth[month] = (costsByMonth[month] || 0) + entry.cost;
        });

        otherCosts.forEach(cost => {
            const month = format(new Date(`${cost.date}-01`), 'yyyy-MM');
            costsByMonth[month] = (costsByMonth[month] || 0) + cost.amount;
        });

        serviceEntries.forEach(entry => {
            const month = format(new Date(entry.date), 'yyyy-MM');
            costsByMonth[month] = (costsByMonth[month] || 0) + entry.cost;
        })
        
        return Object.entries(costsByMonth)
            .map(([month, totalCost]) => ({
                month: format(new Date(`${month}-01`), 'MMM yy'),
                date: new Date(`${month}-01`),
                totalCost,
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
            
    }, [fuelEntries, otherCosts, serviceEntries]);

    if (monthlyData.length < 2) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                Not enough monthly data to display trend chart.
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `R${Number(value / 1000).toFixed(0)}k`} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => [`R${Number(value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 'Total Cost']}
                />
                <Legend wrapperStyle={{color: '#9ca3af'}} />
                <Line type="monotone" dataKey="totalCost" name="Total Monthly Cost" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(MonthlyFleetCostChart);
