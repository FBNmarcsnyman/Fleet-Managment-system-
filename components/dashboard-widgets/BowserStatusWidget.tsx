import React from 'react';
import { useVehicles } from '../../contexts/AppContexts';
import { Bowser } from '../../types';
import { FuelIcon } from '../icons/FuelIcon';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';

const BowserStatusWidget: React.FC = () => {
    const { bowsers = [] } = useVehicles();

    const sortedBowsers = [...bowsers].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="space-y-4">
            {sortedBowsers.length > 0 ? (
                sortedBowsers.map(bowser => {
                    const percentage = (bowser.currentStock / bowser.capacity) * 100;
                    const isLow = percentage < 20;
                    const barColor = isLow ? 'bg-red-500' : percentage < 40 ? 'bg-yellow-500' : 'bg-blue-500';

                    return (
                        <div key={bowser.id} className="bg-gray-900/40 p-4 rounded-xl border border-gray-700/50">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center">
                                    <FuelIcon className={`h-5 w-5 mr-2 ${isLow ? 'text-red-400 animate-pulse' : 'text-blue-400'}`} />
                                    <div>
                                        <h4 className="text-sm font-bold text-white leading-none">{bowser.name}</h4>
                                        <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-tighter">Cap: {bowser.capacity.toLocaleString()}L</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-lg font-black font-mono leading-none ${isLow ? 'text-red-400' : 'text-gray-200'}`}>
                                        {Math.round(bowser.currentStock).toLocaleString()}L
                                    </p>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{Math.round(percentage)}% Full</p>
                                </div>
                            </div>
                            
                            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-1">
                                <div 
                                    className={`${barColor} h-full transition-all duration-1000 ease-out`} 
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                            </div>

                            {isLow && (
                                <div className="flex items-center mt-2 text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">
                                    <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                    Low Stock Alert - Order Refill
                                </div>
                            )}
                        </div>
                    );
                })
            ) : (
                <div className="text-center py-10 text-gray-500 italic text-sm">
                    No bowsers configured.
                </div>
            )}
        </div>
    );
};

export default BowserStatusWidget;
