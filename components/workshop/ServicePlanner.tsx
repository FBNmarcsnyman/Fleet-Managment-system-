import React, { useMemo } from 'react';
import { Vehicle, ServiceInterval, ServiceStatus, JobCard } from '../../types';
import { WrenchIcon } from '../icons/WrenchIcon';
import { BellAlertIcon } from '../icons/BellAlertIcon';

interface ServicePlannerProps {
    vehicles: Vehicle[];
    serviceStatuses: Map<string, ServiceStatus[]>;
    serviceIntervals: ServiceInterval[];
    jobCards: JobCard[];
    onCreateJobCard: (jobCard: Omit<JobCard, 'id'>) => void;
}

interface ServiceActionItem {
    vehicle: Vehicle;
    status: ServiceStatus;
    intervalId: string;
}

const ServicePlanner: React.FC<ServicePlannerProps> = ({ vehicles = [], serviceStatuses = new Map(), serviceIntervals = [], jobCards = [], onCreateJobCard }) => {

    const { overdue, dueSoon } = useMemo(() => {
        const overdueItems: ServiceActionItem[] = [];
        const dueSoonItems: ServiceActionItem[] = [];
        const vehicleMap: Map<string, Vehicle> = new Map((vehicles || []).map(v => [v.id, v]));

        if (serviceStatuses) {
            for (const [vehicleId, statuses] of serviceStatuses.entries()) {
                const vehicle = vehicleMap.get(vehicleId);
                if (!vehicle) continue;

                for (const status of (statuses || [])) {
                    const interval = (serviceIntervals || []).find(i => i.vehicleId === vehicleId && i.description === status.description);
                    if (!interval) continue;

                    const existingJob = (jobCards || []).some(jc =>
                        jc.vehicleId === vehicleId &&
                        jc.serviceIntervalId === interval.id &&
                        jc.status !== 'Resolved'
                    );

                    if (existingJob) continue;
                    
                    const item: ServiceActionItem = { vehicle, status, intervalId: interval.id };
                    if (status.status === 'Overdue') {
                        overdueItems.push(item);
                    } else if (status.status === 'Due Soon') {
                        dueSoonItems.push(item);
                    }
                }
            }
        }
        return { 
            overdue: overdueItems.sort((a,b) => (a.vehicle.name > b.vehicle.name ? 1 : -1)), 
            dueSoon: dueSoonItems.sort((a,b) => (a.vehicle.name > b.vehicle.name ? 1 : -1)) 
        };
    }, [serviceStatuses, vehicles, jobCards, serviceIntervals]);

    const handleCreateServiceJobCard = (item: ServiceActionItem) => {
        onCreateJobCard({
            vehicleId: item.vehicle.id,
            itemDescription: item.status.description,
            reporterNotes: `System generated: Service is ${item.status.details}.`,
            status: 'Reported',
            priority: item.status.status === 'Overdue' ? 'High' : 'Medium',
            severity: item.status.status === 'Overdue' ? 'High' : 'Medium',
            reportedDate: new Date().toISOString(),
            serviceIntervalId: item.intervalId,
            type: 'Service',
        });
    };
    
    const ServiceList: React.FC<{ title: string, items: ServiceActionItem[], color: 'red' | 'yellow'}> = ({ title, items, color }) => (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <div className="flex items-center mb-4">
                {color === 'red' ? <BellAlertIcon className="h-6 w-6 mr-3 text-red-400"/> : <WrenchIcon className="h-6 w-6 mr-3 text-yellow-400"/>}
                <h3 className={`text-xl font-semibold text-white`}>{title} ({items.length})</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {items.length > 0 ? items.map(item => (
                    <div key={`${item.vehicle.id}-${item.intervalId}`} className={`bg-gray-700/50 p-3 rounded-lg border-l-4 border-${color === 'red' ? 'red' : 'yellow'}-500`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-white">{item.vehicle.registration} - <span className="font-normal">{item.status.description}</span></p>
                                <p className={`text-sm font-semibold ${color === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>{item.status.details}</p>
                            </div>
                            <button onClick={() => handleCreateServiceJobCard(item)} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-lg">Create Job</button>
                        </div>
                    </div>
                )) : <p className="text-center text-gray-500 py-4">No services in this category.</p>}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ServiceList title="Overdue Services" items={overdue} color="red" />
            <ServiceList title="Services Due Soon" items={dueSoon} color="yellow" />
        </div>
    );
};

export default ServicePlanner;