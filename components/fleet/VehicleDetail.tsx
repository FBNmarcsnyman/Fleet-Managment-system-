import React, { useMemo } from 'react';
import { Vehicle } from '../../types';
import SingleVehicleDetailView from '../SingleVehicleDetailView';
import SuperlinkDetailView from '../SuperlinkDetailView';
import { useVehicles } from '../../contexts/AppContexts';

const VehicleDetail: React.FC = () => {
    const { 
        selectedVehicleId, vehicles
    } = useVehicles();

    const vehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId), [vehicles, selectedVehicleId]);
    
    const linkedVehicle = useMemo(() => {
        return vehicle?.linkedVehicleId ? vehicles.find(v => v.id === vehicle.linkedVehicleId) : null;
    }, [vehicle, vehicles]);

    if (!vehicle) {
        return <div className="text-center py-20">No vehicle selected or found.</div>
    }

    if (linkedVehicle) {
        const [vehicleA, vehicleB] = [vehicle, linkedVehicle].sort((a,b) => a.registration.localeCompare(b.registration));
        return <SuperlinkDetailView vehicleA={vehicleA} vehicleB={vehicleB} />;
    }
    
    return <SingleVehicleDetailView vehicle={vehicle} />;
};

export default React.memo(VehicleDetail);
