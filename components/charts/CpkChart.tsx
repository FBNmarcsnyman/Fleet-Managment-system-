
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalculatedFuelEntry } from '../../types';
import { format } from 'date-fns';

interface CpkChartProps {
    data: CalculatedFuelEntry[];
}

const CpkChart: React.FC<CpkChartProps> = ({ data }) => {

    const chartData = data.map(entry => ({
        date: format(new Date(entry.date.split('T')[0].replace(/-/g, '/')), 'MMM d'),
        cpk: entry.cpk,
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
                <YAxis stroke="#9ca3af" domain={['dataMin - 0.05', 'dataMax + 0.05']} tickFormatter={(value) => `R${Number(value).toFixed(2)}`} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => [`R${Number(value).toFixed(3)}/km`, 'CPK']}
                />
                <Legend wrapperStyle={{color: '#9ca3af'}} />
                <Line type="monotone" dataKey="cpk" name="Cost per km" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(CpkChart);
