
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FuelEntryWithCost, OtherCost, ServiceEntry } from '../../types';
import { format } from 'date-fns';

interface VehicleCostTrendChartProps {
    fuelEntries: FuelEntryWithCost[];
    otherCosts: OtherCost[];
    serviceEntries: ServiceEntry[];
}

const VehicleCostTrendChart: React.FC<VehicleCostTrendChartProps> = ({ fuelEntries, otherCosts, serviceEntries }) => {

    const monthlyData = React.useMemo(() => {
        const dataByMonth: { [key: string]: { fuelCost: number; otherCost: number; serviceCost: number; } } = {};

        const processEntry = (dateStr: string, amount: number, type: 'fuelCost' | 'otherCost' | 'serviceCost') => {
            // Handle YYYY-MM and full ISO dates
            const month = format(new Date(dateStr.split('T')[0].replace(/-/g, '/')), 'yyyy-MM');
            if (!dataByMonth[month]) {
                dataByMonth[month] = { fuelCost: 0, otherCost: 0, serviceCost: 0 };
            }
            dataByMonth[month][type] += amount;
        };
        
        fuelEntries.forEach(e => processEntry(e.date, e.cost, 'fuelCost'));
        otherCosts.forEach(c => processEntry(`${c.date}-01`, c.amount, 'otherCost')); // OtherCost date is 'YYYY-MM'
        serviceEntries.forEach(s => processEntry(s.date, s.cost, 'serviceCost'));

        return Object.entries(dataByMonth)
            .map(([month, data]) => ({
                month: format(new Date(`${month}-02`), 'MMM yy'), // Use day 02 to avoid timezone issues
                date: new Date(`${month}-02`),
                ...data
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
            
    }, [fuelEntries, otherCosts, serviceEntries]);

    if (monthlyData.length < 1) {
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
                    formatter={(value) => [`R${Number(value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]}
                />
                <Legend wrapperStyle={{color: '#9ca3af'}} />
                <Line type="monotone" dataKey="fuelCost" name="Fuel Cost" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="serviceCost" name="Service Cost" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="otherCost" name="Other Costs" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(VehicleCostTrendChart);
