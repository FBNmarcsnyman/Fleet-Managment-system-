
import React from 'react';

interface StatCardProps {
    title: string;
    value: string;
    isMono?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, isMono = false }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full">
            <p className="text-sm text-gray-400 mb-1 truncate">{title}</p>
            <p className={`text-3xl font-bold text-white ${isMono ? 'font-mono' : ''} truncate`}>
                {value}
            </p>
        </div>
    );
};

export default React.memo(StatCard);
