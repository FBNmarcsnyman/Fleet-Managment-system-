
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RevenueEntry, OtherCost, ServiceEntry, FuelEntryWithCost } from '../../types';
import { format } from 'date-fns';

interface MonthlyFinancialsChartProps {
    revenueEntries: RevenueEntry[];
    fuelEntries: FuelEntryWithCost[];
    otherCosts: OtherCost[];
    serviceEntries: ServiceEntry[];
}

const MonthlyFinancialsChart: React.FC<MonthlyFinancialsChartProps> = ({ revenueEntries, fuelEntries, otherCosts, serviceEntries }) => {
    const monthlyData = React.useMemo(() => {
        const dataByMonth: { [key: string]: { revenue: number, cost: number } } = {};

        const processEntry = (dateStr: string, amount: number, type: 'revenue' | 'cost') => {
            const month = format(new Date(dateStr.split('T')[0].replace(/-/g, '/')), 'yyyy-MM');
            if (!dataByMonth[month]) dataByMonth[month] = { revenue: 0, cost: 0 };
            dataByMonth[month][type] += amount;
        };

        revenueEntries.forEach(e => processEntry(e.date, e.amount, 'revenue'));
        fuelEntries.forEach(e => processEntry(e.date, e.cost, 'cost'));
        otherCosts.forEach(e => processEntry(`${e.date}-01`, e.amount, 'cost'));
        serviceEntries.forEach(e => processEntry(e.date, e.cost, 'cost'));

        return Object.entries(dataByMonth)
            .map(([month, data]) => ({
                month: format(new Date(`${month}-02`), 'MMM yy'),
                date: new Date(`${month}-02`),
                ...data
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [revenueEntries, fuelEntries, otherCosts, serviceEntries]);

    if (monthlyData.length < 2) {
        return <div className="flex items-center justify-center h-64 text-gray-500">Not enough monthly data to display trend chart.</div>;
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
                    formatter={(value) => `R${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Line type="monotone" dataKey="revenue" name="Total Revenue" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="cost" name="Total Costs" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(MonthlyFinancialsChart);
