import React from 'react';
import { Vehicle } from '../types';
import { useVehicles } from '../contexts/AppContexts';
import { BackIcon } from './icons/BackIcon';
import SingleVehicleDetailView from './SingleVehicleDetailView';

interface SuperlinkDetailViewProps {
    vehicleA: Vehicle;
    vehicleB: Vehicle;
}

const SuperlinkDetailView: React.FC<SuperlinkDetailViewProps> = ({ vehicleA, vehicleB }) => {
    const { handleSelectVehicle } = useVehicles();

    return (
        <div>
            <button onClick={() => handleSelectVehicle(null)} className="flex items-center text-brand-secondary hover:text-blue-400 mb-6 font-semibold">
                <BackIcon className="h-5 w-5 mr-2" /> Back to Fleet List
            </button>
            <h2 className="text-3xl font-bold text-white mb-6">Superlink Pair: {vehicleA.registration} / {vehicleB.registration}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <SingleVehicleDetailView vehicle={vehicleA} isEmbedded={true} />
                </div>
                <div>
                    <SingleVehicleDetailView vehicle={vehicleB} isEmbedded={true} />
                </div>
            </div>
        </div>
    );
};

export default SuperlinkDetailView;
