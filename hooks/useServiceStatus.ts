
import { useMemo } from 'react';
import { Vehicle, FuelEntry, ServiceEntry, ServiceInterval, ServiceStatus } from '../types';
import { addDays, differenceInDays } from 'date-fns';

const KM_SOON_THRESHOLD = 1000;
const DAYS_SOON_THRESHOLD = 14;
const HOURS_SOON_THRESHOLD = 50;

export const useServiceStatus = (
    vehicles: Vehicle[],
    fuelEntries: FuelEntry[],
    serviceEntries: ServiceEntry[],
    serviceIntervals: ServiceInterval[]
): Map<string, ServiceStatus[]> => {
    return useMemo(() => {
        const statusMap = new Map<string, ServiceStatus[]>();

        // Pre-group and sort entries by vehicleId for O(N) lookup
        const fuelByVehicle = new Map<string, FuelEntry[]>();
        fuelEntries.forEach(f => {
            if (!fuelByVehicle.has(f.vehicleId)) fuelByVehicle.set(f.vehicleId, []);
            fuelByVehicle.get(f.vehicleId)!.push(f);
        });

        const serviceByVehicle = new Map<string, ServiceEntry[]>();
        // Sort all service entries once by date descending
        const sortedServiceEntries = [...serviceEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        sortedServiceEntries.forEach(s => {
            if (!serviceByVehicle.has(s.vehicleId)) serviceByVehicle.set(s.vehicleId, []);
            serviceByVehicle.get(s.vehicleId)!.push(s);
        });

        const intervalsByVehicle = new Map<string, ServiceInterval[]>();
        serviceIntervals.forEach(i => {
            if (!intervalsByVehicle.has(i.vehicleId)) intervalsByVehicle.set(i.vehicleId, []);
            intervalsByVehicle.get(i.vehicleId)!.push(i);
        });

        for (const vehicle of vehicles) {
            const vehicleStatuses: ServiceStatus[] = [];
            const vehicleIntervals = intervalsByVehicle.get(vehicle.id) || [];
            if (vehicleIntervals.length === 0) {
                statusMap.set(vehicle.id, []);
                continue;
            }

            const vehicleFuelEntries = fuelByVehicle.get(vehicle.id) || [];
            const vehicleServiceEntries = serviceByVehicle.get(vehicle.id) || [];

            // --- Running Odometer Source of Truth ---
            // Use pre-calculated max values or stored values
            const maxFuelOdo = vehicleFuelEntries.length > 0 ? Math.max(...vehicleFuelEntries.map(f => f.odometer)) : 0;
            const maxServiceOdo = vehicleServiceEntries.length > 0 ? Math.max(...vehicleServiceEntries.map(s => s.endOdometer)) : 0;
            const currentOdometer = Math.max(vehicle.currentOdometer || 0, maxFuelOdo, maxServiceOdo);
            const currentHours = vehicle.currentHours || 0;

            // Find first fuel entry date efficiently
            let firstFuelEntryDate = new Date().toISOString();
            if (vehicleFuelEntries.length > 0) {
                let minDate = new Date(vehicleFuelEntries[0].date).getTime();
                let minDateStr = vehicleFuelEntries[0].date;
                for (let i = 1; i < vehicleFuelEntries.length; i++) {
                    const d = new Date(vehicleFuelEntries[i].date).getTime();
                    if (d < minDate) {
                        minDate = d;
                        minDateStr = vehicleFuelEntries[i].date;
                    }
                }
                firstFuelEntryDate = minDateStr;
            }


            for (const interval of vehicleIntervals) {
                const lastRelevantService = vehicleServiceEntries.find(s => s.description.toLowerCase().includes(interval.description.toLowerCase()));

                let distStatus: ServiceStatus | null = null;
                let timeStatus: ServiceStatus | null = null;
                let hoursStatus: ServiceStatus | null = null;

                // --- Distance Calculation ---
                if (interval.distanceInterval && interval.distanceInterval > 0) {
                    const lastServiceOdo = lastRelevantService?.endOdometer || 0;
                    const dueOdometer = lastServiceOdo + interval.distanceInterval;
                    const kmRemaining = dueOdometer - currentOdometer;

                    const kmWarn = (interval.warnDistance && interval.warnDistance > 0) ? interval.warnDistance : KM_SOON_THRESHOLD;
                    if (kmRemaining <= 0) {
                        distStatus = { description: interval.description, status: 'Overdue', details: `Overdue by ${Math.abs(kmRemaining).toLocaleString()} km` };
                    } else if (kmRemaining <= kmWarn) {
                        distStatus = { description: interval.description, status: 'Due Soon', details: `Due in ${kmRemaining.toLocaleString()} km` };
                    } else {
                        distStatus = { description: interval.description, status: 'OK', details: `Due in ${kmRemaining.toLocaleString()} km` };
                    }
                }
                
                // --- Hours Calculation ---
                if (interval.hoursInterval && interval.hoursInterval > 0 && currentHours > 0) {
                    const lastServiceHours = lastRelevantService?.endHours || 0;
                    const dueHours = lastServiceHours + interval.hoursInterval;
                    const hoursRemaining = dueHours - currentHours;

                    const hoursWarn = (interval.warnHours && interval.warnHours > 0) ? interval.warnHours : HOURS_SOON_THRESHOLD;
                    if (hoursRemaining <= 0) {
                        hoursStatus = { description: interval.description, status: 'Overdue', details: `Overdue by ${Math.abs(hoursRemaining).toLocaleString()} hrs` };
                    } else if (hoursRemaining <= hoursWarn) {
                        hoursStatus = { description: interval.description, status: 'Due Soon', details: `Due in ${hoursRemaining.toLocaleString()} hrs` };
                    } else {
                        hoursStatus = { description: interval.description, status: 'OK', details: `Due in ${hoursRemaining.toLocaleString()} hrs` };
                    }
                }


                // --- Time Calculation ---
                if (interval.timeIntervalDays && interval.timeIntervalDays > 0) {
                    const lastServiceDate = lastRelevantService ? new Date(lastRelevantService.date) : new Date(firstFuelEntryDate);
                    const dueDate = addDays(lastServiceDate, interval.timeIntervalDays);
                    const daysRemaining = differenceInDays(dueDate, new Date());
                     
                     if (daysRemaining <= 0) {
                        timeStatus = { description: interval.description, status: 'Overdue', details: `Overdue by ${Math.abs(daysRemaining)} days` };
                    } else if (daysRemaining <= DAYS_SOON_THRESHOLD) {
                        timeStatus = { description: interval.description, status: 'Due Soon', details: `Due in ${daysRemaining} days` };
                    } else {
                        timeStatus = { description: interval.description, status: 'OK', details: `Due in ${daysRemaining} days` };
                    }
                }

                // --- Determine Final Status ---
                const allStatuses = [distStatus, timeStatus, hoursStatus].filter(Boolean) as ServiceStatus[];
                
                const overdue = allStatuses.find(s => s.status === 'Overdue');
                const dueSoon = allStatuses.find(s => s.status === 'Due Soon');
                
                if (overdue) {
                     vehicleStatuses.push({ description: interval.description, status: 'Overdue', details: overdue.details });
                } else if (dueSoon) {
                    vehicleStatuses.push({ description: interval.description, status: 'Due Soon', details: dueSoon.details });
                } else if (allStatuses.length > 0) {
                    vehicleStatuses.push({ description: interval.description, status: 'OK', details: allStatuses[0].details });
                }
            }
            statusMap.set(vehicle.id, vehicleStatuses);
        }

        return statusMap;

    }, [vehicles, fuelEntries, serviceEntries, serviceIntervals]);
};
