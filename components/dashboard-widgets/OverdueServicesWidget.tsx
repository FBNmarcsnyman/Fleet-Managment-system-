import React, { useMemo } from 'react';
import { useVehicles } from '../../contexts/AppContexts';
import { Vehicle } from '../../types';

const OverdueServicesWidget: React.FC = () => {
    const { vehicles = [], serviceStatuses = new Map() } = useVehicles();
    const vehicleMap = useMemo(() => new Map((vehicles || []).map((v: Vehicle) => [v.id, v])), [vehicles]);

    const overdueServices = useMemo(() => {
        const overdue: { vehicleName: string; details: string }[] = [];
        if (serviceStatuses) {
            serviceStatuses.forEach((statuses, vehicleId) => {
                const vehicle = vehicleMap.get(vehicleId);
                if (vehicle) {
                    (statuses || []).forEach(status => {
                        if (status.status === 'Overdue') {
                            overdue.push({ vehicleName: vehicle.name, details: `${status.description} (${status.details})` });
                        }
                    });
                }
            });
        }
        return overdue.slice(0, 5); // Limit to 5 for widget view
    }, [serviceStatuses, vehicleMap]);

    return (
        <div>
            {overdueServices.length > 0 ? (
                <ul className="space-y-2">
                    {overdueServices.map((item, index) => (
                        <li key={index} className="text-sm">
                            <strong className="text-red-400">{item.vehicleName}:</strong>
                            <span className="text-gray-300 ml-2">{item.details}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500 text-center py-4">No overdue services.</p>
            )}
        </div>
    );
};

export default OverdueServicesWidget;