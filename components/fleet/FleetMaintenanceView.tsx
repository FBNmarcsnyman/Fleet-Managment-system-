import React, { useMemo } from 'react';
import { Vehicle, ServiceStatus } from '../../types';
import { useVehicles, useWorkshop } from '../../contexts/AppContexts';
import ServicePlanner from '../workshop/ServicePlanner';

const FleetMaintenanceView: React.FC = () => {
    const { vehicles = [], serviceStatuses = new Map(), serviceIntervals = [] } = useVehicles();
    const { jobCards = [], handleCreateJobCard } = useWorkshop();

    // Vehicles on a DEALER MAINTENANCE PLAN that have a service due soon / overdue —
    // these need to be booked IN with the dealer ahead of time (Marc's rule:
    // ~1000km before due, start booking into the plan).
    const planBookings = useMemo(() => {
        const out: { vehicle: Vehicle; statuses: ServiceStatus[] }[] = [];
        (vehicles as Vehicle[]).forEach(v => {
            if (!v.onMaintenancePlan) return;
            const sts = ((serviceStatuses as Map<string, ServiceStatus[]>).get(v.id) || [])
                .filter(s => s.status === 'Due Soon' || s.status === 'Overdue');
            if (sts.length) out.push({ vehicle: v, statuses: sts });
        });
        return out;
    }, [vehicles, serviceStatuses]);

    return (
        <div>
            <h2 className="text-3xl font-bold text-white mb-6">Fleet Maintenance Overview</h2>

            {planBookings.length > 0 && (
                <div className="mb-6 bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4">
                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        Book into dealer plan
                        <span className="bg-amber-500 text-white text-[11px] px-2 py-0.5 rounded-full">{planBookings.length}</span>
                    </h3>
                    <div className="space-y-2">
                        {planBookings.map(({ vehicle, statuses }) => {
                            const overdue = statuses.some(s => s.status === 'Overdue');
                            return (
                                <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 bg-gray-900/40 rounded-lg p-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-white text-sm">{vehicle.name} · <span className="font-mono">{vehicle.registration}</span></p>
                                        <p className="text-[11px] text-amber-200/80 truncate">{statuses.map(s => `${s.description} — ${s.details}`).join(' · ')}</p>
                                        {vehicle.maintenancePlanProvider && <p className="text-[11px] text-gray-400">Plan: {vehicle.maintenancePlanProvider}</p>}
                                    </div>
                                    <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-full uppercase ${overdue ? 'bg-red-900/50 text-red-300' : 'bg-amber-900/50 text-amber-300'}`}>
                                        {overdue ? 'Overdue — book now' : 'Book in soon'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">These vehicles are on a dealer maintenance plan and have a service due — book them in with the dealer rather than raising an in-house job card.</p>
                </div>
            )}

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
