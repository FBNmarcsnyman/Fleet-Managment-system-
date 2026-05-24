
import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { Vehicle, FuelEntry, JobCard, CalculatedFuelEntry, Tire, ServiceStatus, Branch } from '../types';
import { useServiceStatus } from '../hooks/useServiceStatus';
import { addMonths, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
    mapVehicle, mapFuelEntry, toVehicleInsert, toVehicleUpdate, toFuelEntryInsert,
} from '../lib/mappers';

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

    // Latest-state ref so async write handlers can read current vehicles/bowsers
    // without re-creating themselves on every state change (which would break
    // useMemo identity downstream).
    const stateRef = useRef(state);
    stateRef.current = state;

    const branchIdByName = useMemo<Map<Branch, string>>(
        () => new Map((state.branches || []).map(b => [b.name, b.id])),
        [state.branches],
    );
    const branchById = useMemo<Map<string, Branch>>(
        () => new Map((state.branches || []).map(b => [b.id, b.name])),
        [state.branches],
    );

    const handlers = useMemo(() => ({
        handleSelectVehicle: (id: string | null) => dispatch({ type: 'SELECT_VEHICLE', payload: id }),

        // -- Vehicles ---------------------------------------------------------
        // Returns a structured result so callers (VehicleList.openAddAsset)
        // can surface Supabase errors to the user instead of swallowing them.
        // The catch block converts thrown errors (e.g. toVehicleInsert
        // rejecting because branches haven't hydrated) into the same shape.
        handleAddVehicle: async (vehicle: Omit<Vehicle, 'id'>): Promise<{ ok: true; vehicle: Vehicle } | { ok: false; error: string }> => {
            try {
                const row = toVehicleInsert(vehicle, branchIdByName);
                const { data, error } = await supabase
                    .from('vehicles').insert(row).select().single();
                if (error) {
                    console.error('[fleet] addVehicle failed:', error);
                    return { ok: false, error: error.message };
                }
                const mapped = mapVehicle(data, { branchById });
                dispatch({ type: 'ADD_VEHICLE', payload: mapped });
                return { ok: true, vehicle: mapped };
            } catch (err) {
                console.error('[fleet] addVehicle threw:', err);
                const msg = err instanceof Error ? err.message : 'Unknown error';
                return { ok: false, error: msg };
            }
        },
        handleBulkAddVehicles: async (vehicles: Omit<Vehicle, 'id'>[]) => {
            try {
                const rows = vehicles.map(v => toVehicleInsert(v, branchIdByName));
                const { data, error } = await supabase
                    .from('vehicles').insert(rows).select();
                if (error) { console.error('[fleet] bulkAddVehicles failed:', error); return; }
                dispatch({
                    type: 'BULK_ADD_VEHICLES',
                    payload: (data || []).map(r => mapVehicle(r, { branchById })),
                });
            } catch (err) {
                console.error('[fleet] bulkAddVehicles threw:', err);
            }
        },
        handleUpdateVehicle: async (vehicleId: string, updates: Partial<Vehicle>) => {
            try {
                const row = toVehicleUpdate(updates, branchIdByName);
                const { error } = await supabase
                    .from('vehicles').update(row).eq('id', vehicleId);
                if (error) { console.error('[fleet] updateVehicle failed:', error); return; }
                dispatch({ type: 'UPDATE_VEHICLE', payload: { vehicleId, updates } });
            } catch (err) {
                console.error('[fleet] updateVehicle threw:', err);
            }
        },

        // -- Fuel entries -----------------------------------------------------
        // Mirrors the reducer's cascade: bump vehicle odometer if greater,
        // decrement bowser stock if a source bowser was named.
        handleAddFuelEntry: async (vehicleId: string, entry: Omit<FuelEntry, 'id' | 'vehicleId'>) => {
            try {
                const insertRow = toFuelEntryInsert({ vehicleId, ...entry });
                const { data: inserted, error: insertErr } = await supabase
                    .from('fuel_entries').insert(insertRow).select().single();
                if (insertErr) { console.error('[fleet] addFuelEntry failed:', insertErr); return; }

                const cur = stateRef.current;
                const vehicle = (cur.vehicles || []).find(v => v.id === vehicleId);
                if (vehicle && (!vehicle.currentOdometer || entry.odometer > vehicle.currentOdometer)) {
                    const { error: vErr } = await supabase
                        .from('vehicles').update({ current_odometer: entry.odometer }).eq('id', vehicleId);
                    if (vErr) console.error('[fleet] fuel-cascade vehicle odo update failed:', vErr);
                }
                if (entry.sourceBowserId) {
                    const bowser = (cur.bowsers || []).find(b => b.id === entry.sourceBowserId);
                    if (bowser) {
                        const newStock = bowser.currentStock - entry.liters;
                        const { error: bErr } = await supabase
                            .from('bowsers').update({ current_stock_liters: newStock }).eq('id', entry.sourceBowserId);
                        if (bErr) console.error('[fleet] fuel-cascade bowser stock update failed:', bErr);
                    }
                }

                dispatch({ type: 'ADD_FUEL_ENTRY', payload: { entry: mapFuelEntry(inserted) } });
            } catch (err) {
                console.error('[fleet] addFuelEntry threw:', err);
            }
        },
        handleBulkAddFuelEntries: async (entries: Omit<FuelEntry, 'id'>[]) => {
            try {
                const rows = entries.map(e => toFuelEntryInsert(e));
                const { data, error } = await supabase
                    .from('fuel_entries').insert(rows).select();
                if (error) { console.error('[fleet] bulkAddFuelEntries failed:', error); return; }
                // NOTE: Vehicle odometer and bowser stock cascading for bulk inserts
                // happens in the reducer (local-only). Backfilling those side
                // effects to Supabase for bulk imports is a follow-up.
                dispatch({
                    type: 'BULK_ADD_FUEL_ENTRIES',
                    payload: (data || []).map(mapFuelEntry),
                });
            } catch (err) {
                console.error('[fleet] bulkAddFuelEntries threw:', err);
            }
        },

        // -- Not yet wired to Supabase (Commit E) -----------------------------
        handleAddServiceEntry: (vehicleId: string, entry: any) => dispatch({ type: 'ADD_SERVICE_ENTRY', payload: { vehicleId, entry } }),
        handleAddOtherCost: (vehicleId: string, cost: any) => dispatch({ type: 'ADD_OTHER_COST', payload: { vehicleId, cost } }),
        handleBulkAddOtherCosts: (costs: any[]) => dispatch({ type: 'BULK_ADD_OTHER_COSTS', payload: costs }),
        handleAddRecurringCost: (vehicleId: string, cost: any) => dispatch({ type: 'ADD_RECURRING_COST', payload: { vehicleId, cost } }),
        handleAddRevenue: (vehicleId: string, revenue: any) => dispatch({ type: 'ADD_REVENUE', payload: { vehicleId, revenue } }),
        handleAddServiceInterval: (vehicleId: string, interval: any) => dispatch({ type: 'ADD_SERVICE_INTERVAL', payload: { vehicleId, interval } }),
        handleDeleteServiceInterval: (id: string) => dispatch({ type: 'DELETE_SERVICE_INTERVAL', payload: id }),
        handleSetFuelPrice: (price: any) => dispatch({ type: 'SET_FUEL_PRICE', payload: price }),
        handleAddBowser: (bowser: any) => dispatch({ type: 'ADD_BOWSER', payload: bowser }),
        handleAddBowserRefill: (refill: any) => dispatch({ type: 'ADD_BOWSER_REFILL', payload: refill }),
        handleUpdateBowserRefill: (id: string, updates: any) => dispatch({ type: 'UPDATE_BOWSER_REFILL', payload: { id, updates } }),
        handleDeleteBowserRefill: (id: string) => dispatch({ type: 'DELETE_BOWSER_REFILL', payload: id }),
        handleAssignDriverToVehicle: (vehicleId: string, driverId: string | null) => dispatch({ type: 'ASSIGN_DRIVER_TO_VEHICLE', payload: { vehicleId, driverId } }),
        handleUpdateTire: (tire: Tire) => dispatch({ type: 'UPDATE_TIRE', payload: tire }),
    }), [dispatch, branchIdByName, branchById]);

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
