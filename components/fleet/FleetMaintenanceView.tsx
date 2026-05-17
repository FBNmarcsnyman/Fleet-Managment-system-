import React from 'react';
import { useVehicles, useWorkshop } from '../../contexts/AppContexts';
import ServicePlanner from '../workshop/ServicePlanner';

const FleetMaintenanceView: React.FC = () => {
    const { vehicles = [], serviceStatuses = new Map(), serviceIntervals = [] } = useVehicles();
    const { jobCards = [], handleCreateJobCard } = useWorkshop();

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-6">Fleet Maintenance Overview</h2>
            <ServicePlanner
                vehicles={vehicles}
                serviceStatuses={serviceStatuses}
                serviceIntervals={serviceIntervals}
                jobCards={jobCards}
                onCreateJobCard={handleCreateJobCard}
            />
        </div>
    );
};

export default FleetMaintenanceView;