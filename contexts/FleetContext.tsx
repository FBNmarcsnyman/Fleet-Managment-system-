
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { Vehicle, FuelEntry, JobCard, CalculatedFuelEntry, Tire, ServiceStatus } from '../types';
import { useServiceStatus } from '../hooks/useServiceStatus';
import { addMonths, format } from 'date-fns';

export const FleetContext = createContext<any>(undefined);

export const FleetDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

    const serviceStatuses = useServiceStatus(state.vehicles || [], state.fuelEntries || [], state.serviceEntries || [], state.serviceIntervals || []);

    const fuelEntries = state.fuelEntries || [];
    const fuelPriceRecords = state.fuelPriceRecords || [];
    const otherCosts = state.otherCosts || [];
    const recurringCosts = state.recurringCosts || [];
    const jobCards = state.jobCards || [];

    const fuelEntriesWithCost = useMemo(() => {
        const sortedPrices = [...fuelPriceRecords].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        const getPriceForDate = (date: string) => {
            const entryDate = new Date(date);
            const priceRecord = sortedPrices.find(p => new Date(p.startDate) <= entryDate);
            return priceRecord ? priceRecord.pricePerLiter : (sortedPrices[sortedPrices.length - 1]?.pricePerLiter || 0);
        };

        return fuelEntries.map(entry => ({
            ...entry,
            cost: entry.liters * getPriceForDate(entry.date)
        }));
    }, [fuelEntries, fuelPriceRecords]);

    const jobCardsByVehicle = useMemo(() => {
        const map = new Map<string, JobCard[]>();
        jobCards.forEach(jc => {
            if (!map.has(jc.vehicleId)) map.set(jc.vehicleId, []);
            map.get(jc.vehicleId)!.push(jc);
        });
        return map;
    }, [jobCards]);

    const vehiclesWithHealth = useMemo(() => {
        return (state.vehicles || []).map(v => {
            let score = 100;
            const vStatuses = serviceStatuses.get(v.id) || [];
            if (vStatuses.some(s => s.status === 'Overdue')) score -= 25;
            else if (vStatuses.some(s => s.status === 'Due Soon')) score -= 10;
            
            const vJobs = jobCardsByVehicle.get(v.id) || [];
            const openJobs = vJobs.filter(jc => jc.status !== 'Resolved');
            score -= (openJobs.filter(j => j.priority === 'Critical').length * 30);
            score -= (openJobs.filter(j => j.priority === 'High').length * 15);
            score -= (openJobs.length * 2);
            return { ...v, healthScore: Math.max(0, Math.min(100, score)) };
        });
    }, [state.vehicles, serviceStatuses, jobCardsByVehicle]);

    const fuelPerformanceData = useMemo(() => {
        const fuelByVehicle = new Map<string, FuelEntry[]>();
        fuelEntries.forEach(e => {
            if (!fuelByVehicle.has(e.vehicleId)) fuelByVehicle.set(e.vehicleId, []);
            fuelByVehicle.get(e.vehicleId)!.push(e);
        });

        const calculatedFuelData: CalculatedFuelEntry[] = [];
        const vehiclePerformanceMap = new Map<string, { avgCpk: number, avgConsumption: number, latestOdo: number }>();

        const sortedPrices = [...fuelPriceRecords].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        const getPriceForDate = (date: string) => {
            const entryDate = new Date(date);
            const priceRecord = sortedPrices.find(p => new Date(p.startDate) <= entryDate);
            return priceRecord ? priceRecord.pricePerLiter : (sortedPrices[sortedPrices.length - 1]?.pricePerLiter || 0);
        };

        vehiclesWithHealth.forEach(v => {
            const entries = [...(fuelByVehicle.get(v.id) || [])].sort((a, b) => a.odometer - b.odometer);
            const vCalculated: CalculatedFuelEntry[] = [];
            for (let i = 1; i < entries.length; i++) {
                const prev = entries[i-1]!;
                const curr = entries[i]!;
                const distance = curr.tripDistance ?? (curr.odometer - prev.odometer);
                if (distance > 0 && curr.liters > 0) {
                    const cost = curr.liters * getPriceForDate(curr.date);
                    const calcEntry = { ...curr, distance, consumption: (curr.liters / distance) * 100, cost, cpk: cost / distance };
                    vCalculated.push(calcEntry);
                    calculatedFuelData.push(calcEntry);
                }
            }
            const latestOdo = entries.length > 0 ? Math.max(...entries.map(d => d.odometer)) : v.currentOdometer || 0;
            const avgCpk = vCalculated.length > 0 ? vCalculated.reduce((s, d) => s + d.cpk, 0) / vCalculated.length : 0;
            const avgConsumption = vCalculated.length > 0 ? vCalculated.reduce((s, d) => s + d.consumption, 0) / vCalculated.length : 0;
            vehiclePerformanceMap.set(v.id, { avgCpk, avgConsumption, latestOdo });
        });

        return { calculatedFuelData, vehiclePerformanceMap };
    }, [fuelEntries, fuelPriceRecords, vehiclesWithHealth]);

    const generatedOtherCosts = useMemo(() => {
        const costs = [...otherCosts];
        const today = new Date();
        recurringCosts.forEach(rc => {
            let current = new Date(rc.startDate);
            const endDate = rc.endDate ? new Date(rc.endDate) : today;
            while (current <= endDate) {
                costs.push({ id: `${rc.id}-${format(current, 'yyyy-MM')}`, vehicleId: rc.vehicleId, date: format(current, 'yyyy-MM'), category: rc.category, amount: rc.amount });
                current = addMonths(current, rc.frequency === 'monthly' ? 1 : 12);
            }
        });
        return costs;
    }, [otherCosts, recurringCosts]);

    const handlers = useMemo(() => ({
        handleSelectVehicle: (id: string | null) => dispatch({ type: 'SELECT_VEHICLE', payload: id }),
        handleAddVehicle: (vehicle: any) => dispatch({ type: 'ADD_VEHICLE', payload: vehicle }),
        handleBulkAddVehicles: (vehicles: any[]) => dispatch({ type: 'BULK_ADD_VEHICLES', payload: vehicles }),
        handleAddFuelEntry: (vehicleId: string, entry: any) => dispatch({ type: 'ADD_FUEL_ENTRY', payload: { vehicleId, entry } }),
        handleBulkAddFuelEntries: (entries: any[]) => dispatch({ type: 'BULK_ADD_FUEL_ENTRIES', payload: entries }),
        handleAddServiceEntry: (vehicleId: string, entry: any) => dispatch({ type: 'ADD_SERVICE_ENTRY', payload: { vehicleId, entry } }),
        handleAddOtherCost: (vehicleId: string, cost: any) => dispatch({ type: 'ADD_OTHER_COST', payload: { vehicleId, cost } }),
        handleBulkAddOtherCosts: (costs: any[]) => dispatch({ type: 'BULK_ADD_OTHER_COSTS', payload: costs }),
        handleAddRecurringCost: (vehicleId: string, cost: any) => dispatch({ type: 'ADD_RECURRING_COST', payload: { vehicleId, cost } }),
        handleAddRevenue: (vehicleId: string, revenue: any) => dispatch({ type: 'ADD_REVENUE', payload: { vehicleId, revenue } }),
        handleAddServiceInterval: (vehicleId: string, interval: any) => dispatch({ type: 'ADD_SERVICE_INTERVAL', payload: { vehicleId, interval } }),
        handleDeleteServiceInterval: (id: string) => dispatch({ type: 'DELETE_SERVICE_INTERVAL', payload: id }),
        handleUpdateVehicle: (vehicleId: string, updates: Partial<Vehicle>) => dispatch({ type: 'UPDATE_VEHICLE', payload: { vehicleId, updates } }),
        handleSetFuelPrice: (price: any) => dispatch({ type: 'SET_FUEL_PRICE', payload: price }),
        handleAddBowser: (bowser: any) => dispatch({ type: 'ADD_BOWSER', payload: bowser }),
        handleAddBowserRefill: (refill: any) => dispatch({ type: 'ADD_BOWSER_REFILL', payload: refill }),
        handleUpdateBowserRefill: (id: string, updates: any) => dispatch({ type: 'UPDATE_BOWSER_REFILL', payload: { id, updates } }),
        handleDeleteBowserRefill: (id: string) => dispatch({ type: 'DELETE_BOWSER_REFILL', payload: id }),
        handleAssignDriverToVehicle: (vehicleId: string, driverId: string | null) => dispatch({ type: 'ASSIGN_DRIVER_TO_VEHICLE', payload: { vehicleId, driverId } }),
        handleUpdateTire: (tire: Tire) => dispatch({ type: 'UPDATE_TIRE', payload: tire }),
    }), [dispatch]);

    const value = useMemo(() => ({
        ...state,
        fuelEntriesWithCost,
        vehiclesWithHealth,
        calculatedFuelData: fuelPerformanceData.calculatedFuelData,
        vehiclePerformanceMap: fuelPerformanceData.vehiclePerformanceMap,
        generatedOtherCosts,
        ...handlers,
        vehicles: vehiclesWithHealth,
        serviceStatuses,
        users
    }), [state, fuelEntriesWithCost, vehiclesWithHealth, fuelPerformanceData, generatedOtherCosts, handlers, serviceStatuses, users]);

    return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
};

export const useVehicles = () => useContext(FleetContext);
export const useFleetData = () => useContext(FleetContext);
