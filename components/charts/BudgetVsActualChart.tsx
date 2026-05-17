import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartData {
    month: string;
    amount: number;
}

interface BudgetVsActualChartProps {
    data: ChartData[];
}

const BudgetVsActualChart: React.FC<BudgetVsActualChartProps> = ({ data }) => {
    if (data.length === 0) {
        return <div className="flex items-center justify-center h-64 text-gray-500">No forecast data available.</div>;
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(value) => `R${Number(value / 1000).toFixed(0)}k`} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value: number) => [`R${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Forecasted Cost']}
                />
                <Bar dataKey="amount" name="Forecasted Cost" fill="#8b5cf6" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default BudgetVsActualChart;