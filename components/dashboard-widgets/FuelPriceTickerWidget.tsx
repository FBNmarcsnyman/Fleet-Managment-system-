import React, { useMemo } from 'react';
import { useVehicles } from '../../contexts/AppContexts';
import StatCard from '../StatCard';

const FuelPriceTickerWidget: React.FC = () => {
    const { fuelPriceRecords } = useVehicles();

    const latestPrice = useMemo(() => {
        if (fuelPriceRecords.length === 0) return null;
        return [...fuelPriceRecords].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
    }, [fuelPriceRecords]);

    return (
        <StatCard 
            title={`Latest Fuel Price (from ${latestPrice?.startDate || 'N/A'})`}
            value={latestPrice ? `R ${latestPrice.pricePerLiter.toFixed(2)}` : 'N/A'}
            isMono={true}
        />
    );
};

export default FuelPriceTickerWidget;