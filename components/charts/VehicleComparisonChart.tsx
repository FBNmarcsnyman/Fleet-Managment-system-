
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ComparisonData {
    name: string;
    [key: string]: any;
}

interface VehicleComparisonChartProps {
    data: ComparisonData[];
    dataKey: string;
    unit: string;
    formatAsFloat?: boolean;
}

const VehicleComparisonChart: React.FC<VehicleComparisonChartProps> = ({ data, dataKey, unit, formatAsFloat = false }) => {
    
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                No data available for comparison.
            </div>
        );
    }

    const formatValue = (value: number) => {
        if (formatAsFloat) {
            return `${unit}${value.toFixed(3)}`;
        }
        return `${unit}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    };

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis type="number" stroke="#9ca3af" tickFormatter={(value) => `${unit}${value}`} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" width={80} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => [formatValue(Number(value)), 'Value']}
                />
                <Bar dataKey={dataKey} fill="#38bdf8" name="Total Cost" barSize={20} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default React.memo(VehicleComparisonChart);
