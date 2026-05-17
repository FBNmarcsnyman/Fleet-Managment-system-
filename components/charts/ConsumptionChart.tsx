
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalculatedFuelEntry } from '../../types';
import { format } from 'date-fns';

interface ConsumptionChartProps {
    data: CalculatedFuelEntry[];
}

const ConsumptionChart: React.FC<ConsumptionChartProps> = ({ data }) => {

    const chartData = data.map(entry => ({
        date: format(new Date(entry.date.split('T')[0].replace(/-/g, '/')), 'MMM d'),
        consumption: entry.consumption,
    }));

    if(data.length < 1){
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                Not enough data to display chart.
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(value) => `${Number(value).toFixed(1)}L`} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => [`${Number(value).toFixed(2)} L/100km`, 'Consumption']}
                />
                <Legend wrapperStyle={{color: '#9ca3af'}} />
                <Line type="monotone" dataKey="consumption" name="Fuel Consumption" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(ConsumptionChart);
