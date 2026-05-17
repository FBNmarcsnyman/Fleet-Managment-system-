import React, { useMemo } from 'react';
import StatCard from '../StatCard';
import { useOperations } from '../../contexts/AppContexts';
import { isToday } from 'date-fns';

const OperationsSummaryWidget: React.FC = () => {
    const { loadConfirmations = [], manifests = [] } = useOperations();

    const stats = useMemo(() => {
        const safeLoads = loadConfirmations || [];
        const safeManifests = manifests || [];

        const collectionsToday = safeLoads.filter(lc => 
            lc.collectionDate && isToday(new Date(lc.collectionDate)) && 
            ['Booked', 'Driver Assigned', 'At Collection Point'].includes(lc.status)
        ).length;

        const deliveriesToday = safeLoads.filter(lc => 
            lc.deliveryDate && isToday(new Date(lc.deliveryDate)) &&
            ['Out for Delivery', 'At Destination Depot'].includes(lc.status)
        ).length;

        const inTransit = safeManifests.filter(m => m.status === 'In Transit').length;

        const brokeredActive = safeLoads.filter(lc => 
            lc.supplierId && 
            !['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'].includes(lc.status)
        ).length;

        return { collectionsToday, deliveriesToday, inTransit, brokeredActive };
    }, [loadConfirmations, manifests]);


    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Collections Today" value={stats.collectionsToday.toString()} />
            <StatCard title="Deliveries Today" value={stats.deliveriesToday.toString()} />
            <StatCard title="Linehaul In-Transit" value={stats.inTransit.toString()} />
            <StatCard title="Brokered Loads Active" value={stats.brokeredActive.toString()} />
        </div>
    );
};

export default OperationsSummaryWidget;