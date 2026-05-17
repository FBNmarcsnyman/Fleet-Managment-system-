
import React, { createContext, useReducer, useEffect, useMemo, ReactNode } from 'react';
import * as mockData from '../mockData';
import {
  User, Vehicle, FuelEntry, ServiceEntry, OtherCost, RecurringCost, RevenueEntry, ServiceInterval, LoadConfirmation, Manifest, TripSheet, Client, Supplier, Quote, JobCard, ChecklistTemplate, ChecklistSubmission, Tire, TireInspection, Part, PurchaseRequest, PurchaseOrder, HRCase, PlannedService, Bowser, BowserRefill, FuelPriceRecord, Budget, Forecast, Notification, Message, JobCardStatus, SupplierApplication
} from '../types';
import { COMMODITIES, PACKAGING_TYPES } from '../constants';

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export interface AppState {
    users: User[];
    vehicles: Vehicle[]; fuelEntries: FuelEntry[]; serviceEntries: ServiceEntry[]; otherCosts: OtherCost[]; recurringCosts: RecurringCost[]; revenueEntries: RevenueEntry[]; serviceIntervals: ServiceInterval[]; plannedServices: PlannedService[]; fuelPriceRecords: FuelPriceRecord[]; bowsers: Bowser[]; bowserRefills: BowserRefill[]; budgets: Budget[]; forecasts: Forecast[];
    jobCards: JobCard[]; checklistTemplates: ChecklistTemplate[]; checklistSubmissions: ChecklistSubmission[]; tires: Tire[]; tireInspections: TireInspection[]; parts: Part[]; purchaseRequests: PurchaseRequest[]; purchaseOrders: PurchaseOrder[]; hrCases: HRCase[];
    clients: Client[]; suppliers: Supplier[]; quotes: Quote[]; loadConfirmations: LoadConfirmation[]; manifests: Manifest[]; tripSheets: TripSheet[]; incidentReports: any[]; supplierApplications: SupplierApplication[];
    notifications: Notification[];
    messages: Message[];
    selectedVehicleId: string | null;
    commodities: string[];
    packagingTypes: string[];
}

export const getInitialState = (): AppState => {
    try {
        const saved = localStorage.getItem('fbn_fleet_app_state_v3_1');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error("Failed to load state from localStorage", e);
    }
    return {
        users: mockData.mockUsers || [],
        vehicles: mockData.mockVehicles || [],
        fuelEntries: mockData.fuelEntries || [],
        serviceEntries: mockData.serviceEntries || [],
        otherCosts: mockData.otherCosts || [],
        recurringCosts: mockData.recurringCosts || [],
        revenueEntries: mockData.revenueEntries || [],
        serviceIntervals: mockData.serviceIntervals || [],
        plannedServices: mockData.plannedServices || [],
        fuelPriceRecords: mockData.fuelPriceRecords || [],
        bowsers: mockData.bowsers || [],
        bowserRefills: mockData.bowserRefills || [],
        budgets: mockData.budgets || [],
        forecasts: mockData.forecasts || [],
        jobCards: mockData.jobCards || [],
        checklistTemplates: mockData.checklistTemplates || [],
        checklistSubmissions: mockData.checklistSubmissions || [],
        tires: mockData.tires || [],
        tireInspections: mockData.tireInspections || [],
        parts: mockData.parts || [],
        purchaseRequests: mockData.purchaseRequests || [],
        purchaseOrders: mockData.purchaseOrders || [],
        hrCases: mockData.hrCases || [],
        clients: mockData.clients || [],
        suppliers: mockData.suppliers || [],
        quotes: mockData.quotes || [],
        loadConfirmations: mockData.loadConfirmations || [],
        manifests: mockData.manifests || [],
        tripSheets: mockData.tripSheets || [],
        incidentReports: mockData.incidentReports || [],
        supplierApplications: mockData.supplierApplications || [],
        notifications: mockData.notifications || [],
        messages: mockData.messages || [],
        selectedVehicleId: null,
        commodities: COMMODITIES,
        packagingTypes: PACKAGING_TYPES,
    };
};

export type AppAction = 
    | { type: 'ADD_USER', payload: Omit<User, 'permissions'> }
    | { type: 'SELECT_VEHICLE', payload: string | null }
    | { type: 'ADD_VEHICLE', payload: Omit<Vehicle, 'id'> }
    | { type: 'BULK_ADD_VEHICLES', payload: Omit<Vehicle, 'id'>[] }
    | { type: 'ADD_FUEL_ENTRY', payload: { vehicleId: string, entry: Omit<FuelEntry, 'id' | 'vehicleId'> } }
    | { type: 'BULK_ADD_FUEL_ENTRIES', payload: Omit<FuelEntry, 'id'>[] }
    | { type: 'ADD_SERVICE_ENTRY', payload: { vehicleId: string, entry: Omit<ServiceEntry, 'id' | 'vehicleId'> } }
    | { type: 'ADD_OTHER_COST', payload: { vehicleId: string, cost: Omit<OtherCost, 'id' | 'vehicleId'> } }
    | { type: 'BULK_ADD_OTHER_COSTS', payload: Omit<OtherCost, 'id'>[] }
    | { type: 'ADD_RECURRING_COST', payload: { vehicleId: string, cost: Omit<RecurringCost, 'id' | 'vehicleId'> } }
    | { type: 'ADD_REVENUE', payload: { vehicleId: string, revenue: Omit<RevenueEntry, 'id' | 'vehicleId'> } }
    | { type: 'ADD_SERVICE_INTERVAL', payload: { vehicleId: string, interval: Omit<ServiceInterval, 'id' | 'vehicleId'> } }
    | { type: 'DELETE_SERVICE_INTERVAL', payload: string }
    | { type: 'UPDATE_VEHICLE', payload: { vehicleId: string, updates: Partial<Vehicle> } }
    | { type: 'SET_FUEL_PRICE', payload: Omit<FuelPriceRecord, 'id'> }
    | { type: 'ADD_BOWSER', payload: Omit<Bowser, 'id'> }
    | { type: 'ADD_BOWSER_REFILL', payload: Omit<BowserRefill, 'id' | 'finalCostPerLiter'> }
    | { type: 'UPDATE_BOWSER_REFILL', payload: { id: string, updates: Partial<BowserRefill> } }
    | { type: 'DELETE_BOWSER_REFILL', payload: string }
    | { type: 'ADD_BUDGET', payload: Omit<Budget, 'id'> }
    | { type: 'ADD_FORECAST', payload: Omit<Forecast, 'id'> }
    | { type: 'CREATE_JOB_CARD', payload: Omit<JobCard, 'id'> }
    | { type: 'UPDATE_JOB_CARD', payload: { id: string, updates: Partial<JobCard> } }
    | { type: 'UPDATE_JOB_CARD_STATUS', payload: { id: string, status: JobCardStatus } }
    | { type: 'ADD_CHECKLIST_SUBMISSION', payload: any }
    | { type: 'CREATE_QUOTE', payload: any }
    | { type: 'UPDATE_QUOTE', payload: Quote }
    | { type: 'CREATE_LOAD_CONFIRMATION', payload: any }
    | { type: 'UPDATE_LOAD_CONFIRMATION', payload: {id: string, updates: Partial<LoadConfirmation>}}
    | { type: 'ADD_INCIDENT', payload: any }
    | { type: 'UPDATE_INCIDENT', payload: any }
    | { type: 'ADD_INCIDENT_QUOTE', payload: { incidentId: string, quote: any } }
    | { type: 'ADD_CLIENT', payload: Omit<Client, 'id'> & {id: string} }
    | { type: 'ADD_SUPPLIER', payload: Omit<Supplier, 'id'> }
    | { type: 'BULK_ADD_CLIENTS', payload: Omit<Client, 'id'>[] }
    | { type: 'BULK_ADD_SUPPLIERS', payload: Omit<Supplier, 'id'>[] }
    | { type: 'CREATE_MANIFEST', payload: any }
    | { type: 'CREATE_TRIP_SHEET', payload: any }
    | { type: 'APPLY_AI_ASSIGNMENTS', payload: Partial<JobCard>[] }
    | { type: 'ADD_PART', payload: Omit<Part, 'id'> }
    | { type: 'CREATE_PURCHASE_REQUEST', payload: any }
    | { type: 'CREATE_PURCHASE_ORDER', payload: PurchaseRequest }
    | { type: 'RECEIVE_GOODS', payload: PurchaseOrder }
    | { type: 'UPDATE_TIRE', payload: Tire }
    | { type: 'ADD_HR_CASE', payload: Omit<HRCase, 'id'> }
    | { type: 'UPDATE_HR_CASE', payload: HRCase }
    | { type: 'ADD_PLANNED_SERVICE', payload: Omit<PlannedService, 'id'> }
    | { type: 'DELETE_PLANNED_SERVICE', payload: string }
    | { type: 'ASSIGN_DRIVER_TO_VEHICLE', payload: { vehicleId: string, driverId: string | null } }
    | { type: 'ADD_MESSAGE', payload: { vehicleId: string, message: Omit<Message, 'id' | 'vehicleId'> } }
    | { type: 'UPDATE_NAV_PREFERENCES', payload: { email: string, preferences: User['navigationPreferences'] } }
    | { type: 'ADD_SUPPLIER_APPLICATION', payload: any }
    | { type: 'ADD_COMMODITY', payload: string }
    | { type: 'ADD_PACKAGING_TYPE', payload: string };

export const dataReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'ADD_USER': return { ...state, users: [...(state.users || []), { ...action.payload, permissions: [] }] };
        case 'SELECT_VEHICLE': return { ...state, selectedVehicleId: action.payload };
        case 'ADD_VEHICLE': return { ...state, vehicles: [{ id: generateId(), ...action.payload }, ...(state.vehicles || [])] };
        case 'BULK_ADD_VEHICLES': return { ...state, vehicles: [...action.payload.map(v => ({ id: generateId(), ...v })), ...(state.vehicles || [])] };
        case 'ADD_FUEL_ENTRY': {
            const { vehicleId, entry } = action.payload;
            const newEntry = { id: generateId(), vehicleId, ...entry };
            
            let updatedBowsers = [...(state.bowsers || [])];
            if (entry.sourceBowserId) {
                updatedBowsers = updatedBowsers.map(b => 
                    b.id === entry.sourceBowserId 
                        ? { ...b, currentStock: b.currentStock - entry.liters }
                        : b
                );
            }

            const updatedVehicles = (state.vehicles || []).map(v => {
                if (v.id === vehicleId && (!v.currentOdometer || newEntry.odometer > v.currentOdometer)) {
                    return { ...v, currentOdometer: newEntry.odometer };
                }
                return v;
            });
            return { 
                ...state, 
                fuelEntries: [newEntry, ...(state.fuelEntries || [])],
                vehicles: updatedVehicles,
                bowsers: updatedBowsers
            };
        }
        case 'BULK_ADD_FUEL_ENTRIES': {
            const newEntries = action.payload.map(e => ({ id: generateId(), ...e }));
            const bowserDeductions = new Map<string, number>();
            newEntries.forEach(e => {
                if (e.sourceBowserId) {
                    bowserDeductions.set(e.sourceBowserId, (bowserDeductions.get(e.sourceBowserId) || 0) + e.liters);
                }
            });

            const updatedBowsers = (state.bowsers || []).map(b => {
                const deduction = bowserDeductions.get(b.id) || 0;
                return deduction > 0 ? { ...b, currentStock: b.currentStock - deduction } : b;
            });

            const highestOdometers = new Map<string, number>();
            newEntries.forEach(entry => {
                const currentMax = highestOdometers.get(entry.vehicleId) || 0;
                if (entry.odometer > currentMax) {
                    highestOdometers.set(entry.vehicleId, entry.odometer);
                }
            });

            const updatedVehicles = (state.vehicles || []).map(v => {
                const newOdo = highestOdometers.get(v.id);
                if (newOdo && (!v.currentOdometer || newOdo > v.currentOdometer)) {
                    return { ...v, currentOdometer: newOdo };
                }
                return v;
            });

            return {
                ...state,
                fuelEntries: [...newEntries, ...(state.fuelEntries || [])],
                vehicles: updatedVehicles,
                bowsers: updatedBowsers
            };
        }
        case 'ADD_SERVICE_ENTRY': {
            const vehicleId = action.payload.vehicleId;
            const newEntry = { id: generateId(), vehicleId, ...action.payload.entry };
            const updatedVehicles = (state.vehicles || []).map(v => {
                if (v.id === vehicleId) {
                    const updates: Partial<Vehicle> = {};
                    if (!v.currentOdometer || newEntry.endOdometer > v.currentOdometer) {
                        updates.currentOdometer = newEntry.endOdometer;
                    }
                    if (newEntry.endHours && (!v.currentHours || newEntry.endHours > v.currentHours)) {
                        updates.currentHours = newEntry.endHours;
                    }
                    return { ...v, ...updates };
                }
                return v;
            });
            return { 
                ...state, 
                serviceEntries: [newEntry, ...(state.serviceEntries || [])],
                vehicles: updatedVehicles
            };
        }
        case 'ADD_OTHER_COST': return { ...state, otherCosts: [...(state.otherCosts || []), { id: generateId(), vehicleId: action.payload.vehicleId, ...action.payload.cost }] };
        case 'BULK_ADD_OTHER_COSTS': return { ...state, otherCosts: [...(state.otherCosts || []), ...action.payload.map(c => ({ id: generateId(), ...c }))] };
        case 'ADD_RECURRING_COST': return { ...state, recurringCosts: [...(state.recurringCosts || []), { id: generateId(), vehicleId: action.payload.vehicleId, ...action.payload.cost }] };
        case 'ADD_REVENUE': return { ...state, revenueEntries: [...(state.revenueEntries || []), { id: generateId(), vehicleId: action.payload.vehicleId, ...action.payload.revenue }] };
        case 'ADD_SERVICE_INTERVAL': return { ...state, serviceIntervals: [...(state.serviceIntervals || []), { id: generateId(), vehicleId: action.payload.vehicleId, ...action.payload.interval }] };
        case 'DELETE_SERVICE_INTERVAL': return { ...state, serviceIntervals: (state.serviceIntervals || []).filter(i => i.id !== action.payload) };
        case 'UPDATE_VEHICLE': return { ...state, vehicles: (state.vehicles || []).map(v => v.id === action.payload.vehicleId ? { ...v, ...action.payload.updates } : v) };
        case 'CREATE_JOB_CARD': return { ...state, jobCards: [{ id: generateId(), ...action.payload }, ...(state.jobCards || [])] };
        case 'UPDATE_JOB_CARD': return { ...state, jobCards: (state.jobCards || []).map(j => j.id === action.payload.id ? { ...j, ...action.payload.updates } : j) };
        case 'UPDATE_JOB_CARD_STATUS': return { ...state, jobCards: (state.jobCards || []).map(j => j.id === action.payload.id ? { ...j, status: action.payload.status } : j) };
        case 'ADD_CHECKLIST_SUBMISSION': {
            const { vehicleId, currentUser, odometer, hours } = action.payload;
            const newSubmission: ChecklistSubmission = {
                id: generateId(),
                vehicleId: vehicleId,
                userId: currentUser.email,
                userName: currentUser.name,
                date: new Date().toISOString(),
                status: 'Submitted',
                odometer: odometer,
                hours: hours,
                results: action.payload.allResults,
                templateId: action.payload.templateId,
                templateName: action.payload.templateName,
            };

            const newDriverId = currentUser.email;

            const updatedVehicles = (state.vehicles || []).map(vehicle => {
                if (vehicle.id === vehicleId) {
                    const usageUpdates: Partial<Vehicle> = { assignedDriverId: newDriverId };
                    if (!vehicle.currentOdometer || odometer > vehicle.currentOdometer) {
                        usageUpdates.currentOdometer = odometer;
                    }
                    if (hours && (!vehicle.currentHours || hours > vehicle.currentHours)) {
                        usageUpdates.currentHours = hours;
                    }
                    return { ...vehicle, ...usageUpdates };
                }
                if (vehicle.assignedDriverId === newDriverId) {
                    return { ...vehicle, assignedDriverId: undefined };
                }
                return vehicle;
            });

            const updatedUsers = (state.users || []).map(user => {
                const assignedVehicleIds = updatedVehicles
                    .filter(v => v.assignedDriverId === user.email)
                    .map(v => v.id);
                return {
                    ...user,
                    assignedVehicleIds: assignedVehicleIds.length > 0 ? assignedVehicleIds : undefined,
                };
            });

            return {
                ...state,
                checklistSubmissions: [newSubmission, ...(state.checklistSubmissions || [])],
                vehicles: updatedVehicles,
                users: updatedUsers,
            };
        }
        case 'ADD_CLIENT': return { ...state, clients: [...(state.clients || []), action.payload] };
        case 'BULK_ADD_CLIENTS': return { ...state, clients: [...(state.clients || []), ...action.payload.map((c: any) => ({...c, id: generateId()}))]};
        case 'ADD_SUPPLIER': return { ...state, suppliers: [...(state.suppliers || []), { id: generateId(), complianceStatus: 'Pending', ...action.payload }] };
        case 'BULK_ADD_SUPPLIERS': return { ...state, suppliers: [...(state.suppliers || []), ...action.payload.map((s: any) => ({id: generateId(), complianceStatus: 'Pending', ...s}))]};
        case 'CREATE_QUOTE': return { ...state, quotes: [{ ...action.payload, id: generateId(), quoteNumber: `QU-${Date.now()}`, status: 'Draft' }, ...(state.quotes || [])] };
        case 'UPDATE_QUOTE': return { ...state, quotes: (state.quotes || []).map(q => q.id === action.payload.id ? action.payload : q) };
        case 'CREATE_LOAD_CONFIRMATION': return { ...state, loadConfirmations: [{ ...action.payload, id: generateId(), loadConNumber: `LCN-${Date.now()}`, status: 'Booked', date: new Date().toISOString() }, ...(state.loadConfirmations || [])] };
        case 'UPDATE_LOAD_CONFIRMATION': return { ...state, loadConfirmations: (state.loadConfirmations || []).map(lc => lc.id === action.payload.id ? { ...lc, ...action.payload.updates } : lc) };
        case 'ADD_INCIDENT': return { ...state, incidentReports: [{ ...action.payload, id: generateId(), status: 'Reported', quotes: [], notes: '' }, ...(state.incidentReports || [])]};
        case 'UPDATE_INCIDENT': return { ...state, incidentReports: (state.incidentReports || []).map(i => i.id === action.payload.id ? action.payload : i) };
        case 'ADD_INCIDENT_QUOTE': return { ...state, incidentReports: (state.incidentReports || []).map(i => i.id === action.payload.incidentId ? { ...i, quotes: [...(i.quotes || []), action.payload.quote] } : i) };
        case 'APPLY_AI_ASSIGNMENTS': return { ...state, jobCards: (state.jobCards || []).map(jc => { const s = action.payload.find((s: any) => s.id === jc.id); return s ? { ...jc, ...s } : jc; }) };
        case 'ADD_PART': return {...state, parts: [...(state.parts || []), {id: generateId(), ...action.payload}]}
        case 'CREATE_PURCHASE_REQUEST': return {...state, purchaseRequests: [...(state.purchaseRequests || []), {id: generateId(), requestedDate: new Date().toISOString(), status: 'Pending', ...action.payload}]};
        case 'CREATE_PURCHASE_ORDER': {
            const request = action.payload as PurchaseRequest;
            const part = (state.parts || []).find(p => p.id === request.partId);
            const quote = request.quotes?.[0];
            const unitCost = quote ? quote.amount / request.quantity : part?.cost || 0;
            const totalCost = quote ? quote.amount : unitCost * request.quantity;
            const supplierId = quote?.supplierId || part?.supplierId || (state.suppliers || []).find(s => s.type === 'Workshop')?.id || '';
            const newPurchaseOrder: PurchaseOrder = { id: generateId(), poNumber: `PO-${Date.now().toString().slice(-6)}`, purchaseRequestId: request.id, supplierId: supplierId, orderDate: new Date().toISOString(), items: [{ partId: request.partId, quantity: request.quantity, unitCost }], totalCost: totalCost, status: 'Ordered' };
            return { ...state, purchaseOrders: [...(state.purchaseOrders || []), newPurchaseOrder], purchaseRequests: (state.purchaseRequests || []).map(r => r.id === request.id ? { ...r, status: 'Ordered' } : r) };
        }
        case 'RECEIVE_GOODS': return { ...state, purchaseOrders: (state.purchaseOrders || []).map(po => po.id === action.payload.id ? {...po, status: 'Received'} : po), parts: (state.parts || []).map(p => { const i = action.payload.items.find((i: any) => i.partId === p.id); return i ? { ...p, quantityInStock: p.quantityInStock + i.quantity } : p; }) };
        case 'UPDATE_TIRE': return {...state, tires: (state.tires || []).map(t => t.id === action.payload.id ? action.payload : t) };
        case 'ADD_HR_CASE': return {...state, hrCases: [...(state.hrCases || []), {id: generateId(), ...action.payload}]};
        case 'UPDATE_HR_CASE': return {...state, hrCases: (state.hrCases || []).map(c => c.id === action.payload.id ? action.payload : c)};
        case 'ADD_PLANNED_SERVICE': return {...state, plannedServices: [...(state.plannedServices || []), {id: generateId(), ...action.payload}]};
        case 'DELETE_PLANNED_SERVICE': return {...state, plannedServices: (state.plannedServices || []).filter(p => p.id !== action.payload)};
        case 'ADD_MESSAGE': return { ...state, messages: [...(state.messages || []), { id: generateId(), vehicleId: action.payload.vehicleId, ...action.payload.message }] };
        case 'ASSIGN_DRIVER_TO_VEHICLE': {
            const { vehicleId, driverId: newDriverId } = action.payload;

            const updatedVehicles = (state.vehicles || []).map(vehicle => {
                if (vehicle.id === vehicleId) {
                    return { ...vehicle, assignedDriverId: newDriverId || undefined };
                }
                else if (newDriverId && vehicle.assignedDriverId === newDriverId) {
                    return { ...vehicle, assignedDriverId: undefined };
                }
                return vehicle;
            });

            const updatedUsers = (state.users || []).map(user => {
                const assignedVehicleIds = updatedVehicles
                    .filter(v => v.assignedDriverId === user.email)
                    .map(v => v.id);

                return {
                    ...user,
                    assignedVehicleIds: assignedVehicleIds.length > 0 ? assignedVehicleIds : undefined
                };
            });

            return {
                ...state,
                vehicles: updatedVehicles,
                users: updatedUsers,
            };
        }
        case 'UPDATE_NAV_PREFERENCES': {
            return {
                ...state,
                users: (state.users || []).map(u => 
                    u.email === action.payload.email 
                        ? { ...u, navigationPreferences: action.payload.preferences } 
                        : u
                )
            };
        }
        case 'ADD_SUPPLIER_APPLICATION': return { ...state, supplierApplications: [{ id: generateId(), submittedDate: new Date().toISOString(), status: 'Pending', ...action.payload }, ...(state.supplierApplications || [])] };
        case 'ADD_COMMODITY': return { ...state, commodities: [...(state.commodities || []), action.payload] };
        case 'ADD_PACKAGING_TYPE': return { ...state, packagingTypes: [...(state.packagingTypes || []), action.payload] };
        case 'SET_FUEL_PRICE': return { ...state, fuelPriceRecords: [...(state.fuelPriceRecords || []), { id: generateId(), ...action.payload }] };
        case 'ADD_BOWSER': return { ...state, bowsers: [...(state.bowsers || []), { id: generateId(), ...action.payload }] };
        case 'ADD_BOWSER_REFILL': {
            const { bowserId, liters } = action.payload;
            const price = action.payload.costPerLiter;
            const rebate = action.payload.rebatePercentage || 0;
            const finalCost = price * (1 - (rebate / 100));
            
            const updatedBowsers = (state.bowsers || []).map(b => 
                b.id === bowserId ? { ...b, currentStock: b.currentStock + liters } : b
            );
            
            const newRefill: BowserRefill = {
                id: generateId(),
                ...action.payload,
                finalCostPerLiter: finalCost
            };
            
            return {
                ...state,
                bowsers: updatedBowsers,
                bowserRefills: [newRefill, ...(state.bowserRefills || [])]
            };
        }
        case 'UPDATE_BOWSER_REFILL': {
            const { id, updates } = action.payload;
            const oldRefill = state.bowserRefills.find(r => r.id === id);
            if (!oldRefill) return state;

            const updatedRefill = { ...oldRefill, ...updates };
            
            const litersDiff = (updates.liters !== undefined ? updates.liters : oldRefill.liters) - oldRefill.liters;
            const updatedBowsers = state.bowsers.map(b => 
                b.id === oldRefill.bowserId ? { ...b, currentStock: b.currentStock + litersDiff } : b
            );

            return {
                ...state,
                bowsers: updatedBowsers,
                bowserRefills: state.bowserRefills.map(r => r.id === id ? updatedRefill : r)
            };
        }
        case 'DELETE_BOWSER_REFILL': {
            const refillToDelete = state.bowserRefills.find(r => r.id === action.payload);
            if (!refillToDelete) return state;

            const updatedBowsers = state.bowsers.map(b => 
                b.id === refillToDelete.bowserId ? { ...b, currentStock: b.currentStock - refillToDelete.liters } : b
            );

            return {
                ...state,
                bowsers: updatedBowsers,
                bowserRefills: state.bowserRefills.filter(r => r.id !== action.payload)
            };
        }
        default: return state;
    }
};

export const RawDataContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> } | undefined>(undefined);

export const RawDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, getInitialState());

    useEffect(() => {
        localStorage.setItem('fbn_fleet_app_state_v3_1', JSON.stringify(state));
    }, [state]);

    const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

    return (
        <RawDataContext.Provider value={value}>
            {children}
        </RawDataContext.Provider>
    );
};
