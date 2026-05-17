
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tire, TireStatus } from '../../types';

interface TireStatusChartProps {
    tires: Tire[];
}

const COLORS: Record<TireStatus, string> = {
    'Mounted': '#22c55e',
    'In Storage': '#3b82f6',
    'Out for Retread': '#f97316',
    'Scrapped': '#6b7280',
};

const TireStatusChart: React.FC<TireStatusChartProps> = ({ tires }) => {
    const data = useMemo(() => {
        const statusCounts = tires.reduce((acc, tire) => {
            acc[tire.status] = (acc[tire.status] || 0) + 1;
            return acc;
        }, {} as Record<TireStatus, number>);

        return (Object.keys(statusCounts) as TireStatus[]).map(status => ({
            name: status,
            value: statusCounts[status],
        }));
    }, [tires]);

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-64 text-gray-500">No tire data available.</div>;
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={110} fill="#8884d8" dataKey="value" nameKey="name">
                    {data.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as TireStatus]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => [`${value} tires`, 'Count']}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: '20px' }} />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default React.memo(TireStatusChart);
