
import React, { useMemo } from 'react';
import { Vehicle, VehicleStatus, PlannedService, ServiceStatus } from '../types';
import { WrenchIcon } from './icons/WrenchIcon';
import { addDays, format, isWithinInterval } from 'date-fns';
import { CalendarIcon } from './icons/CalendarIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CarIcon } from './icons/CarIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

interface ServiceSchedulingProps {
    vehicles: Vehicle[];
    serviceStatuses: Map<string, ServiceStatus[]>;
    plannedServices: PlannedService[];
    onAddPlannedService: () => void;
    onDeletePlannedService: (id: string) => void;
    onUpdateVehicleStatus: (vehicleId: string, status: VehicleStatus) => void;
}

const ServiceScheduling: React.FC<ServiceSchedulingProps> = ({ vehicles, serviceStatuses, plannedServices, onAddPlannedService, onDeletePlannedService, onUpdateVehicleStatus }) => {
    
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);

    const upcomingServices = useMemo(() => {
        const now = new Date();
        const nextWeek = addDays(now, 7);
        return plannedServices.filter(s => {
            const startDate = new Date(s.startDate);
            return isWithinInterval(startDate, { start: now, end: nextWeek });
        });
    }, [plannedServices]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Service Planning</h2>
                 <button 
                    onClick={onAddPlannedService} 
                    className="flex items-center font-bold py-2 px-4 rounded-lg transition duration-300 bg-brand-primary hover:bg-brand-secondary text-white"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Plan New Service
                </button>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                <div className="flex items-center mb-4">
                    <CalendarIcon className="h-6 w-6 mr-3 text-purple-400"/>
                    <h3 className="text-xl font-semibold text-white">Upcoming Services (Next 7 Days)</h3>
                </div>
                 {upcomingServices.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {upcomingServices.map(service => {
                            const vehicle = vehicleMap.get(service.vehicleId);
                            return (
                                <div key={service.id} className="bg-purple-900/50 p-4 rounded-md">
                                    <p className="font-bold text-white">{vehicle?.name || 'Unknown'}</p>
                                    <p className="text-sm text-gray-300">{service.description}</p>
                                    <p className="text-sm font-semibold text-purple-300 mt-2">
                                        {format(new Date(service.startDate), 'EEE, MMM d')} - {format(new Date(service.endDate), 'EEE, MMM d')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500">No services scheduled for the upcoming week.</p>
                )}
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <h3 className="text-xl font-semibold text-white mb-4">All Planned Services</h3>
                 <div className="space-y-3">
                     {plannedServices.map(service => {
                        const vehicle = vehicleMap.get(service.vehicleId);
                        if (!vehicle) return null;
                        
                        const isPast = new Date(service.endDate) < new Date();

                        return (
                             <div key={service.id} className={`p-4 rounded-lg flex items-center justify-between ${isPast ? 'bg-gray-700/50 opacity-60' : 'bg-gray-700/80'}`}>
                                <div>
                                    <p className="font-bold text-lg text-white">{vehicle.name} <span className="text-sm font-normal text-gray-400">({vehicle.registration})</span></p>
                                    <p className="text-gray-300">{service.description}</p>
                                    <p className="text-sm font-semibold text-gray-400 mt-1">
                                        {format(new Date(service.startDate), 'EEE, MMM d, yyyy')} to {format(new Date(service.endDate), 'EEE, MMM d, yyyy')}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    {vehicle.status === 'On the road' && !isPast && (
                                         <button 
                                            onClick={() => onUpdateVehicleStatus(vehicle.id, 'In for service')}
                                            className="flex items-center text-sm font-semibold py-1 px-3 rounded-full bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
                                            title="Move vehicle to 'In for service'"
                                        >
                                            <WrenchIcon className="h-4 w-4 mr-2" />
                                            Start Service
                                        </button>
                                    )}
                                    {vehicle.status === 'In for service' && (
                                         <button 
                                            onClick={() => onUpdateVehicleStatus(vehicle.id, 'On the road')}
                                            className="flex items-center text-sm font-semibold py-1 px-3 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors"
                                            title="Mark service as complete and move vehicle to 'On the road'"
                                        >
                                            <CheckCircleIcon className="h-4 w-4 mr-2" />
                                            Complete Service
                                        </button>
                                    )}
                                     <button 
                                        onClick={() => onDeletePlannedService(service.id)}
                                        className="text-gray-400 hover:text-red-400"
                                        title="Delete Planned Service"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    {plannedServices.length === 0 && (
                        <p className="text-gray-500 text-center py-8">No services have been planned yet.</p>
                    )}
                 </div>
            </div>
        </div>
    );
};

export default ServiceScheduling;
