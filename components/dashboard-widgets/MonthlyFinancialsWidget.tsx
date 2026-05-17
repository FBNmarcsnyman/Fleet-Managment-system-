import React from 'react';
import { useVehicles } from '../../contexts/AppContexts';
import MonthlyFinancialsChart from '../charts/MonthlyFinancialsChart';

const MonthlyFinancialsWidget: React.FC = () => {
    const { revenueEntries, fuelEntriesWithCost, generatedOtherCosts, serviceEntries } = useVehicles();
    
    return (
        <MonthlyFinancialsChart 
            revenueEntries={revenueEntries}
            fuelEntries={fuelEntriesWithCost}
            otherCosts={generatedOtherCosts}
            serviceEntries={serviceEntries}
        />
    );
};

export default MonthlyFinancialsWidget;