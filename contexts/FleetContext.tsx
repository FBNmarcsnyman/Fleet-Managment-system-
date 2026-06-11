
import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { Vehicle, FuelEntry, JobCard, CalculatedFuelEntry, VehiclePerformanceStats, Tire, ServiceStatus, Branch } from '../types';
import { useServiceStatus } from '../hooks/useServiceStatus';
import { addMonths, format } from 'date-fns';
import { supabase, runWrite } from '../lib/supabase';
import {
    mapVehicle, mapFuelEntry, mapServiceEntry, mapOtherCost, mapRecurringCost,
    mapRevenueEntry, mapServiceInterval, mapFuelPrice,
    toVehicleInsert, toVehicleUpdate, toFuelEntryInsert,
    toServiceEntryInsert, toOtherCostInsert, toRecurringCostInsert,
    toRevenueEntryInsert, toServiceIntervalInsert, toFuelPriceInsert,
} from '../lib/mappers';
import { ServiceEntry, OtherCost, RecurringCost, RevenueEntry, ServiceInterval, FuelPriceRecord } from '../types';

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
        const vehiclePerformanceMap = new Map<string, VehiclePerformanceStats>();
        // Plausible L/100km band: filters out missed-fill / odo-rollover garbage so
        // averages and best/worst rankings stay trustworthy.
        const isSaneConsumption = (c: number) => c >= 3 && c <= 150;

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
            // Use only plausible points for averages/rankings; totals use all valid fills.
            const sane = vCalculated.filter(d => isSaneConsumption(d.consumption));
            const avgCpk = sane.length > 0 ? sane.reduce((s, d) => s + d.cpk, 0) / sane.length : 0;
            const avgConsumption = sane.length > 0 ? sane.reduce((s, d) => s + d.consumption, 0) / sane.length : 0;
            const consumptions = sane.map(d => d.consumption);
            vehiclePerformanceMap.set(v.id, {
                avgCpk,
                avgConsumption,
                latestOdo,
                points: sane.length,
                totalLitres: vCalculated.reduce((s, d) => s + d.liters, 0),
                totalCost: vCalculated.reduce((s, d) => s + d.cost, 0),
                totalDistance: vCalculated.reduce((s, d) => s + d.distance, 0),
                bestConsumption: consumptions.length > 0 ? Math.min(...consumptions) : 0,
                worstConsumption: consumptions.length > 0 ? Math.max(...consumptions) : 0,
            });
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
        handleBulkAddVehicles: async (vehicles: Omit<Vehicle, 'id'>[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> => {
            try {
                const rows = vehicles.map(v => toVehicleInsert(v, branchIdByName));
                const { data, error } = await supabase
                    .from('vehicles').insert(rows).select();
                if (error) {
                    console.error('[fleet] bulkAddVehicles failed:', error);
                    return { ok: false, error: error.message };
                }
                const mapped = (data || []).map(r => mapVehicle(r, { branchById }));
                dispatch({ type: 'BULK_ADD_VEHICLES', payload: mapped });
                return { ok: true, count: mapped.length };
            } catch (err) {
                console.error('[fleet] bulkAddVehicles threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateVehicle: async (vehicleId: string, updates: Partial<Vehicle>): Promise<{ ok: true; vehicle: Vehicle } | { ok: false; error: string }> => {
            try {
                // Capture pre-state BEFORE the write so we can cascade
                // linkedVehicleId changes onto the partner side(s). Reads
                // are from stateRef (latest reducer state) so concurrent
                // bulk applies see each other.
                const preVehicles = stateRef.current.vehicles || [];
                const self = preVehicles.find(v => v.id === vehicleId);
                const previousPartnerId = self?.linkedVehicleId;

                const row = toVehicleUpdate(updates, branchIdByName);
                const { data, error } = await supabase
                    .from('vehicles').update(row).eq('id', vehicleId).select().single();
                if (error) {
                    console.error('[fleet] updateVehicle failed:', error);
                    return { ok: false, error: error.message };
                }
                const mapped = mapVehicle(data, { branchById });
                dispatch({ type: 'UPDATE_VEHICLE', payload: { vehicleId, updates } });

                // Bi-directional pairing: writing A.linkedVehicleId = B must
                // also write B.linkedVehicleId = A so the pair is symmetric
                // in the DB. We also break any prior asymmetric links:
                //  - if A used to point at C, clear C.linkedVehicleId
                //  - if B used to point at D, clear D.linkedVehicleId
                // Cascade failures are logged but do NOT fail the primary
                // update - the user's intent on A is already persisted.
                if (Object.prototype.hasOwnProperty.call(updates, 'linkedVehicleId')) {
                    const newPartnerId = updates.linkedVehicleId ?? null;
                    const newPartner = newPartnerId ? preVehicles.find(v => v.id === newPartnerId) : null;
                    const newPartnerOldLink = newPartner?.linkedVehicleId;

                    type Cascade = { id: string; link: string | null };
                    const cascades: Cascade[] = [];

                    // Old partner of A loses its back-link (if it was actually
                    // pointing back at A and isn't the new partner).
                    if (previousPartnerId && previousPartnerId !== newPartnerId) {
                        const oldPartner = preVehicles.find(v => v.id === previousPartnerId);
                        if (oldPartner?.linkedVehicleId === vehicleId) {
                            cascades.push({ id: previousPartnerId, link: null });
                        }
                    }
                    // New partner's prior link (some third vehicle) loses ITS
                    // back-link, so we don't strand a one-way pointer.
                    if (newPartnerOldLink && newPartnerOldLink !== vehicleId) {
                        const stranded = preVehicles.find(v => v.id === newPartnerOldLink);
                        if (stranded?.linkedVehicleId === newPartnerId) {
                            cascades.push({ id: newPartnerOldLink, link: null });
                        }
                    }
                    // Finally: set the new back-link on the new partner.
                    if (newPartnerId && newPartner?.linkedVehicleId !== vehicleId) {
                        cascades.push({ id: newPartnerId, link: vehicleId });
                    }

                    for (const c of cascades) {
                        const { error: cErr } = await supabase
                            .from('vehicles')
                            .update({ linked_vehicle_id: c.link })
                            .eq('id', c.id);
                        if (cErr) {
                            console.error('[fleet] linked-vehicle cascade failed for', c, cErr);
                        } else {
                            dispatch({
                                type: 'UPDATE_VEHICLE',
                                payload: { vehicleId: c.id, updates: { linkedVehicleId: c.link ?? undefined } },
                            });
                        }
                    }
                }

                return { ok: true, vehicle: mapped };
            } catch (err) {
                console.error('[fleet] updateVehicle threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Fuel entries -----------------------------------------------------
        // Mirrors the reducer's cascade: bump vehicle odometer if greater,
        // decrement bowser stock if a source bowser was named.
        handleAddFuelEntry: async (vehicleId: string, entry: Omit<FuelEntry, 'id' | 'vehicleId'>) => {
            try {
                const insertRow = toFuelEntryInsert({ vehicleId, ...entry });
                // Refreshes the session and retries once if the first write is
                // rejected because the login token went stale.
                const { data: inserted, error: insertErr } = await runWrite(() =>
                    supabase.from('fuel_entries').insert(insertRow).select().single());
                if (insertErr || !inserted) {
                    // Surface the real failure — never pretend a save succeeded.
                    console.error('[fleet] addFuelEntry failed:', insertErr);
                    return { ok: false, error: insertErr?.message || 'The fuel entry could not be saved. Please try again.' };
                }

                // Best-effort cascades (don't fail the save if these don't stick).
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
                return { ok: true };
            } catch (err) {
                console.error('[fleet] addFuelEntry threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        handleUpdateFuelEntry: async (entry: FuelEntry): Promise<{ ok: boolean; error?: string }> => {
            try {
                const { error } = await runWrite(() => supabase.from('fuel_entries').update({
                    date: entry.date,
                    odometer: entry.odometer,
                    liters: entry.liters,
                    trip_distance_km: entry.tripDistance ?? null,
                }).eq('id', entry.id).select().single());
                if (error) {
                    console.error('[fleet] updateFuelEntry failed:', error);
                    return { ok: false, error: error.message || 'The change could not be saved.' };
                }
                dispatch({ type: 'UPDATE_FUEL_ENTRY', payload: { entry } });
                return { ok: true };
            } catch (err) {
                console.error('[fleet] updateFuelEntry threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        handleDeleteFuelEntry: async (id: string): Promise<{ ok: boolean; error?: string }> => {
            try {
                const { error } = await runWrite(() => supabase.from('fuel_entries').delete().eq('id', id).select());
                if (error) {
                    console.error('[fleet] deleteFuelEntry failed:', error);
                    return { ok: false, error: error.message || 'The entry could not be deleted.' };
                }
                dispatch({ type: 'DELETE_FUEL_ENTRY', payload: { id } });
                return { ok: true };
            } catch (err) {
                console.error('[fleet] deleteFuelEntry threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        handleBulkAddFuelEntries: async (entries: Omit<FuelEntry, 'id'>[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> => {
            try {
                const rows = entries.map(e => toFuelEntryInsert(e));
                console.log('[fleet] attempting bulk insert of', rows.length, 'rows:', rows.slice(0, 1));
                
                const { data, error } = await supabase
                    .from('fuel_entries').insert(rows).select('*');
                
                if (error) {
                    console.error('[fleet] bulkAddFuelEntries Supabase error:', error);
                    // Fall back to local state even when Supabase fails
                    console.log('[fleet] falling back to local state dispatch for', entries.length, 'entries');
                    const localEntries: FuelEntry[] = entries.map((e, i) => ({
                        id: `import-${Date.now()}-${i}`,
                        vehicleId: e.vehicleId,
                        date: e.date,
                        odometer: e.odometer,
                        liters: e.liters,
                        tripDistance: e.tripDistance,
                        sourceBowserId: e.sourceBowserId,
                    }));
                    dispatch({ type: 'BULK_ADD_FUEL_ENTRIES', payload: localEntries });
                    return { ok: true, count: localEntries.length };
                }
                
                // NOTE: Vehicle odometer and bowser stock cascading for bulk inserts
                // happens in the reducer (local-only). Backfilling those side
                // effects to Supabase for bulk imports is a follow-up.
                const mapped = (data || []).map(mapFuelEntry);
                console.log('[fleet] bulkAddFuelEntries success:', mapped.length, 'rows');
                dispatch({ type: 'BULK_ADD_FUEL_ENTRIES', payload: mapped });
                return { ok: true, count: mapped.length };
            } catch (err) {
                console.error('[fleet] bulkAddFuelEntries threw:', err);
                // Last resort: dispatch to local state
                try {
                    const fallbackEntries: FuelEntry[] = entries.map((e, i) => ({
                        id: `import-${Date.now()}-${i}`,
                        vehicleId: e.vehicleId,
                        date: e.date,
                        odometer: e.odometer,
                        liters: e.liters,
                        tripDistance: e.tripDistance,
                        sourceBowserId: e.sourceBowserId,
                    }));
                    dispatch({ type: 'BULK_ADD_FUEL_ENTRIES', payload: fallbackEntries });
                    console.log('[fleet] fallback dispatch successful:', fallbackEntries.length, 'entries');
                    return { ok: true, count: fallbackEntries.length };
                } catch (fallbackErr) {
                    console.error('[fleet] fallback dispatch also failed:', fallbackErr);
                    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
                }
            }
        },

        // -- Push 4: services, costs, revenue, intervals, fuel prices --------
        handleAddServiceEntry: async (vehicleId: string, entry: Omit<ServiceEntry, 'id' | 'vehicleId'>) => {
            try {
                const row = toServiceEntryInsert({ vehicleId, ...entry });
                const { data, error } = await supabase.from('service_entries').insert(row).select().single();
                if (error) { console.error('[fleet] addServiceEntry failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'ADD_SERVICE_ENTRY', payload: { entry: mapServiceEntry(data) } });
                return { ok: true };
            } catch (err) { console.error('[fleet] addServiceEntry threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleAddOtherCost: async (vehicleId: string, cost: Omit<OtherCost, 'id' | 'vehicleId'>) => {
            try {
                const row = toOtherCostInsert({ vehicleId, ...cost });
                const { data, error } = await supabase.from('other_costs').insert(row).select().single();
                if (error) { console.error('[fleet] addOtherCost failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'ADD_OTHER_COST', payload: { cost: mapOtherCost(data) } });
                return { ok: true };
            } catch (err) { console.error('[fleet] addOtherCost threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleBulkAddOtherCosts: async (costs: Omit<OtherCost, 'id'>[]) => {
            try {
                const rows = costs.map(toOtherCostInsert);
                const { data, error } = await supabase.from('other_costs').insert(rows).select();
                if (error) { console.error('[fleet] bulkAddOtherCosts failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'BULK_ADD_OTHER_COSTS', payload: (data || []).map(mapOtherCost) });
                return { ok: true, count: (data || []).length };
            } catch (err) { console.error('[fleet] bulkAddOtherCosts threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleAddRecurringCost: async (vehicleId: string, cost: Omit<RecurringCost, 'id' | 'vehicleId'>) => {
            try {
                const row = toRecurringCostInsert({ vehicleId, ...cost });
                const { data, error } = await supabase.from('recurring_costs').insert(row).select().single();
                if (error) { console.error('[fleet] addRecurringCost failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'ADD_RECURRING_COST', payload: { cost: mapRecurringCost(data) } });
                return { ok: true };
            } catch (err) { console.error('[fleet] addRecurringCost threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleAddRevenue: async (vehicleId: string, revenue: Omit<RevenueEntry, 'id' | 'vehicleId'>) => {
            try {
                const row = toRevenueEntryInsert({ vehicleId, ...revenue });
                const { data, error } = await supabase.from('revenue_entries').insert(row).select().single();
                if (error) { console.error('[fleet] addRevenue failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'ADD_REVENUE', payload: { revenue: mapRevenueEntry(data) } });
                return { ok: true };
            } catch (err) { console.error('[fleet] addRevenue threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleAddServiceInterval: async (vehicleId: string, interval: Omit<ServiceInterval, 'id' | 'vehicleId'>) => {
            try {
                const row = toServiceIntervalInsert({ vehicleId, ...interval });
                const { data, error } = await supabase.from('service_intervals').insert(row).select().single();
                if (error) { console.error('[fleet] addServiceInterval failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'ADD_SERVICE_INTERVAL', payload: { interval: mapServiceInterval(data) } });
                return { ok: true };
            } catch (err) { console.error('[fleet] addServiceInterval threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleDeleteServiceInterval: async (id: string) => {
            try {
                const { error } = await supabase.from('service_intervals').delete().eq('id', id);
                if (error) { console.error('[fleet] deleteServiceInterval failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'DELETE_SERVICE_INTERVAL', payload: id });
                return { ok: true };
            } catch (err) { console.error('[fleet] deleteServiceInterval threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },
        handleSetFuelPrice: async (price: Omit<FuelPriceRecord, 'id'>) => {
            try {
                const row = toFuelPriceInsert(price);
                const { data, error } = await runWrite(() => supabase.from('fuel_prices').insert(row).select().single());
                if (error || !data) { console.error('[fleet] setFuelPrice failed:', error); return { ok: false, error: error?.message || 'The fuel price could not be saved.' }; }
                dispatch({ type: 'SET_FUEL_PRICE', payload: mapFuelPrice(data) });
                return { ok: true };
            } catch (err) { console.error('[fleet] setFuelPrice threw:', err); return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }; }
        },

        // -- Still local-only (deferred to Push 5 or later) -------------------
        // Bowsers + refills have cascade to bowsers.current_stock_liters that
        // needs careful handling. Driver assignment touches vehicles + profiles
        // both ways. Tire update lives in WorkshopContext (already wired).
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
