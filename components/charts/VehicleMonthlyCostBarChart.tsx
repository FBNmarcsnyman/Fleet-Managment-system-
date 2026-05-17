
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FuelEntryWithCost, OtherCost, ServiceEntry } from '../../types';
import { format } from 'date-fns';

interface VehicleMonthlyCostBarChartProps {
    fuelEntries: FuelEntryWithCost[];
    otherCosts: OtherCost[];
    serviceEntries: ServiceEntry[];
}

const VehicleMonthlyCostBarChart: React.FC<VehicleMonthlyCostBarChartProps> = ({ fuelEntries, otherCosts, serviceEntries }) => {

    const monthlyData = useMemo(() => {
        const dataByMonth: { [key: string]: { fuelCost: number; otherCost: number; serviceCost: number; } } = {};

        const processEntry = (dateStr: string, amount: number, type: 'fuelCost' | 'otherCost' | 'serviceCost') => {
            const month = format(new Date(dateStr.split('T')[0].replace(/-/g, '/')), 'yyyy-MM');
            if (!dataByMonth[month]) {
                dataByMonth[month] = { fuelCost: 0, otherCost: 0, serviceCost: 0 };
            }
            dataByMonth[month][type] += amount;
        };
        
        fuelEntries.forEach(e => processEntry(e.date, e.cost, 'fuelCost'));
        otherCosts.forEach(c => processEntry(`${c.date}-01`, c.amount, 'otherCost'));
        serviceEntries.forEach(s => processEntry(s.date, s.cost, 'serviceCost'));

        return Object.entries(dataByMonth)
            .map(([month, data]) => ({
                month: format(new Date(`${month}-02`), 'MMM yy'),
                date: new Date(`${month}-02`),
                ...data
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
            
    }, [fuelEntries, otherCosts, serviceEntries]);

    if (monthlyData.length < 1) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                Not enough monthly data to display chart.
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `R${Number(value / 1000).toFixed(0)}k`} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value: number) => [`R${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]}
                />
                <Legend wrapperStyle={{color: '#9ca3af'}} />
                <Bar dataKey="fuelCost" name="Fuel Cost" stackId="a" fill="#f59e0b" />
                <Bar dataKey="serviceCost" name="Service Cost" stackId="a" fill="#3b82f6" />
                <Bar dataKey="otherCost" name="Other Costs" stackId="a" fill="#ef4444" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default React.memo(VehicleMonthlyCostBarChart);
