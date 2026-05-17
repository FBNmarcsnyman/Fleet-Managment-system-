
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { OtherCost, ServiceEntry, FuelEntryWithCost } from '../../types';
import { format } from 'date-fns';

interface CostBreakdownChartProps {
    fuelData: FuelEntryWithCost[];
    otherData: OtherCost[];
    serviceData: ServiceEntry[];
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const CostBreakdownChart: React.FC<CostBreakdownChartProps> = ({ fuelData, otherData, serviceData }) => {
    
    const data = useMemo(() => {
        const costMap = new Map<string, number>();

        // Aggregate fuel costs
        const totalFuelCost = fuelData.reduce((sum, entry) => sum + entry.cost, 0);
        if (totalFuelCost > 0) {
            costMap.set('Fuel', totalFuelCost);
        }

        // Aggregate other costs
        otherData.forEach(cost => {
            costMap.set(cost.category, (costMap.get(cost.category) || 0) + cost.amount);
        });

        // Aggregate service costs
        const totalServiceCost = serviceData.reduce((sum, entry) => sum + entry.cost, 0);
        if (totalServiceCost > 0) {
            costMap.set('Servicing', totalServiceCost);
        }

        return Array.from(costMap.entries()).map(([name, value]) => ({ name, value }));
    }, [fuelData, otherData, serviceData]);

    if(data.length === 0){
         return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                No cost data available.
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={110}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => `R${Number(value).toFixed(2)}`}
                />
                <Legend wrapperStyle={{color: '#9ca3af', paddingTop: '20px' }} />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default React.memo(CostBreakdownChart);
