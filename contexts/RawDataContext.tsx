
import React, { createContext, useReducer, useEffect, useMemo, ReactNode } from 'react';
import {
  User, Vehicle, FuelEntry, ServiceEntry, OtherCost, RecurringCost, RevenueEntry, ServiceInterval,
  LoadConfirmation, Manifest, TripSheet, Client, Supplier, Quote, JobCard, ChecklistTemplate,
  ChecklistSubmission, Tire, TireInspection, Part, PurchaseRequest, PurchaseOrder, HRCase,
  PlannedService, Bowser, BowserRefill, FuelPriceRecord, Budget, Forecast, Notification, Message,
  JobCardStatus, SupplierApplication, IncidentReport, IncidentQuote, Branch, Route, VehicleComplianceDoc,
  ComplianceDoc, Attachment, Driver,
} from '../types';
import { COMMODITIES, PACKAGING_TYPES } from '../constants';
import { supabase } from '../lib/supabase';
import {
  mapProfile, mapVehicle, mapFuelEntry, mapServiceEntry, mapOtherCost, mapRecurringCost,
  mapRevenueEntry, mapServiceInterval, mapPlannedService, mapFuelPrice, mapBowser, mapBowserRefill,
  mapBudget, mapForecast, mapJobCard, mapChecklistTemplate, mapChecklistSubmission, mapTire,
  mapTireInspection, mapPart, mapPurchaseRequest, mapPurchaseOrder, mapHRCase, mapClient,
  mapSupplier, mapSupplierComplianceDoc, mapSupplierRateCard, mapQuote, mapLoadConfirmation,
  mapManifest, mapTripSheet, mapIncidentReport, mapSupplierApplication, mapNotification, mapMessage,
  mapRoute, mapVehicleComplianceDoc, mapDriver,
} from '../lib/mappers';

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export interface AppState {
    users: User[];
    vehicles: Vehicle[]; fuelEntries: FuelEntry[]; serviceEntries: ServiceEntry[]; otherCosts: OtherCost[]; recurringCosts: RecurringCost[]; revenueEntries: RevenueEntry[]; serviceIntervals: ServiceInterval[]; plannedServices: PlannedService[]; fuelPriceRecords: FuelPriceRecord[]; bowsers: Bowser[]; bowserRefills: BowserRefill[]; budgets: Budget[]; forecasts: Forecast[];
    jobCards: JobCard[]; checklistTemplates: ChecklistTemplate[]; checklistSubmissions: ChecklistSubmission[]; tires: Tire[]; tireInspections: TireInspection[]; parts: Part[]; purchaseRequests: PurchaseRequest[]; purchaseOrders: PurchaseOrder[]; hrCases: HRCase[];
    clients: Client[]; suppliers: Supplier[]; quotes: Quote[]; loadConfirmations: LoadConfirmation[]; manifests: Manifest[]; tripSheets: TripSheet[]; incidentReports: IncidentReport[]; supplierApplications: SupplierApplication[];
    drivers: Driver[];
    notifications: Notification[];
    messages: Message[];
    selectedVehicleId: string | null;
    commodities: string[];
    packagingTypes: string[];
    routes: Route[];
    vehicleComplianceDocs: VehicleComplianceDoc[];
    branches: Array<{ id: string; name: Branch }>;
}

const getEmptyState = (): AppState => ({
    users: [], vehicles: [], fuelEntries: [], serviceEntries: [], otherCosts: [], recurringCosts: [],
    revenueEntries: [], serviceIntervals: [], plannedServices: [], fuelPriceRecords: [], bowsers: [],
    bowserRefills: [], budgets: [], forecasts: [], jobCards: [], checklistTemplates: [],
    checklistSubmissions: [], tires: [], tireInspections: [], parts: [], purchaseRequests: [],
    purchaseOrders: [], hrCases: [], clients: [], suppliers: [], quotes: [], loadConfirmations: [],
    manifests: [], tripSheets: [], incidentReports: [], supplierApplications: [], drivers: [], notifications: [],
    messages: [], selectedVehicleId: null, commodities: COMMODITIES, packagingTypes: PACKAGING_TYPES,
    routes: [], vehicleComplianceDocs: [], branches: [],
});

export const getInitialState = (): AppState => getEmptyState();

export type AppAction =
    | { type: 'RESET_ALL' }
    | { type: 'SET_USERS', payload: User[] }
    | { type: 'SET_VEHICLES', payload: Vehicle[] }
    | { type: 'SET_FUEL_ENTRIES', payload: FuelEntry[] }
    | { type: 'SET_SERVICE_ENTRIES', payload: ServiceEntry[] }
    | { type: 'SET_OTHER_COSTS', payload: OtherCost[] }
    | { type: 'SET_RECURRING_COSTS', payload: RecurringCost[] }
    | { type: 'SET_REVENUE_ENTRIES', payload: RevenueEntry[] }
    | { type: 'SET_SERVICE_INTERVALS', payload: ServiceInterval[] }
    | { type: 'SET_PLANNED_SERVICES', payload: PlannedService[] }
    | { type: 'SET_FUEL_PRICE_RECORDS', payload: FuelPriceRecord[] }
    | { type: 'SET_BOWSERS', payload: Bowser[] }
    | { type: 'SET_BOWSER_REFILLS', payload: BowserRefill[] }
    | { type: 'SET_BUDGETS', payload: Budget[] }
    | { type: 'SET_FORECASTS', payload: Forecast[] }
    | { type: 'SET_JOB_CARDS', payload: JobCard[] }
    | { type: 'SET_CHECKLIST_TEMPLATES', payload: ChecklistTemplate[] }
    | { type: 'ADD_CHECKLIST_TEMPLATE', payload: ChecklistTemplate }
    | { type: 'UPDATE_CHECKLIST_TEMPLATE', payload: ChecklistTemplate }
    | { type: 'DELETE_CHECKLIST_TEMPLATE', payload: string }
    | { type: 'SET_CHECKLIST_SUBMISSIONS', payload: ChecklistSubmission[] }
    | { type: 'SET_TIRES', payload: Tire[] }
    | { type: 'SET_TIRE_INSPECTIONS', payload: TireInspection[] }
    | { type: 'SET_PARTS', payload: Part[] }
    | { type: 'SET_PURCHASE_REQUESTS', payload: PurchaseRequest[] }
    | { type: 'SET_PURCHASE_ORDERS', payload: PurchaseOrder[] }
    | { type: 'SET_HR_CASES', payload: HRCase[] }
    | { type: 'SET_CLIENTS', payload: Client[] }
    | { type: 'SET_DRIVERS', payload: Driver[] }
    | { type: 'ADD_DRIVER', payload: Driver }
    | { type: 'UPDATE_DRIVER', payload: { id: string, updates: Partial<Driver> } }
    | { type: 'BULK_ADD_DRIVERS', payload: Driver[] }
    | { type: 'SET_SUPPLIERS', payload: Supplier[] }
    | { type: 'SET_QUOTES', payload: Quote[] }
    | { type: 'SET_LOAD_CONFIRMATIONS', payload: LoadConfirmation[] }
    | { type: 'SET_MANIFESTS', payload: Manifest[] }
    | { type: 'SET_TRIP_SHEETS', payload: TripSheet[] }
    | { type: 'SET_INCIDENT_REPORTS', payload: IncidentReport[] }
    | { type: 'SET_SUPPLIER_APPLICATIONS', payload: SupplierApplication[] }
    | { type: 'SET_NOTIFICATIONS', payload: Notification[] }
    | { type: 'SET_MESSAGES', payload: Message[] }
    | { type: 'SET_ROUTES', payload: Route[] }
    | { type: 'SET_VEHICLE_COMPLIANCE_DOCS', payload: VehicleComplianceDoc[] }
    | { type: 'SET_BRANCHES', payload: Array<{ id: string; name: Branch }> }
    | { type: 'ADD_USER', payload: Omit<User, 'permissions'> }
    | { type: 'UPDATE_USER', payload: { id?: string, email: string, updates: Partial<User> } }
    | { type: 'SELECT_VEHICLE', payload: string | null }
    | { type: 'ADD_VEHICLE', payload: Vehicle }
    | { type: 'BULK_ADD_VEHICLES', payload: Vehicle[] }
    | { type: 'ADD_FUEL_ENTRY', payload: { entry: FuelEntry } }
    | { type: 'UPDATE_FUEL_ENTRY', payload: { entry: FuelEntry } }
    | { type: 'DELETE_FUEL_ENTRY', payload: { id: string } }
    | { type: 'BULK_ADD_FUEL_ENTRIES', payload: FuelEntry[] }
    | { type: 'ADD_SERVICE_ENTRY', payload: { entry: ServiceEntry } }
    | { type: 'ADD_OTHER_COST', payload: { cost: OtherCost } }
    | { type: 'BULK_ADD_OTHER_COSTS', payload: OtherCost[] }
    | { type: 'ADD_RECURRING_COST', payload: { cost: RecurringCost } }
    | { type: 'ADD_REVENUE', payload: { revenue: RevenueEntry } }
    | { type: 'ADD_SERVICE_INTERVAL', payload: { interval: ServiceInterval } }
    | { type: 'DELETE_SERVICE_INTERVAL', payload: string }
    | { type: 'UPDATE_VEHICLE', payload: { vehicleId: string, updates: Partial<Vehicle> } }
    | { type: 'SET_FUEL_PRICE', payload: FuelPriceRecord }
    | { type: 'ADD_BOWSER', payload: Omit<Bowser, 'id'> }
    | { type: 'ADD_BOWSER_REFILL', payload: Omit<BowserRefill, 'id' | 'finalCostPerLiter'> }
    | { type: 'UPDATE_BOWSER_REFILL', payload: { id: string, updates: Partial<BowserRefill> } }
    | { type: 'DELETE_BOWSER_REFILL', payload: string }
    | { type: 'ADD_BUDGET', payload: Budget }
    | { type: 'ADD_FORECAST', payload: Forecast }
    | { type: 'CREATE_JOB_CARD', payload: JobCard }
    | { type: 'UPDATE_JOB_CARD', payload: { id: string, updates: Partial<JobCard> } }
    | { type: 'UPDATE_JOB_CARD_STATUS', payload: { id: string, status: JobCardStatus } }
    | { type: 'ADD_CHECKLIST_SUBMISSION', payload: any }
    | { type: 'CREATE_QUOTE', payload: Quote }
    | { type: 'UPDATE_QUOTE', payload: Quote }
    | { type: 'CREATE_LOAD_CONFIRMATION', payload: LoadConfirmation }
    | { type: 'UPDATE_LOAD_CONFIRMATION', payload: {id: string, updates: Partial<LoadConfirmation>}}
    | { type: 'ADD_INCIDENT', payload: IncidentReport }
    | { type: 'UPDATE_INCIDENT', payload: IncidentReport }
    | { type: 'ADD_INCIDENT_QUOTE', payload: { incidentId: string, quote: IncidentQuote } }
    | { type: 'ADD_CLIENT', payload: Client }
    | { type: 'UPDATE_CLIENT', payload: { id: string, updates: Partial<Client> } }
    | { type: 'REMOVE_CLIENT', payload: string }
    | { type: 'ADD_SUPPLIER', payload: Supplier }
    | { type: 'UPDATE_SUPPLIER', payload: { id: string, updates: Partial<Supplier> } }
    | { type: 'REMOVE_SUPPLIER', payload: string }
    | { type: 'REMOVE_DRIVER', payload: string }
    | { type: 'BULK_ADD_CLIENTS', payload: Client[] }
    | { type: 'BULK_ADD_SUPPLIERS', payload: Supplier[] }
    | { type: 'CREATE_MANIFEST', payload: any }
    | { type: 'CREATE_TRIP_SHEET', payload: any }
    | { type: 'APPLY_AI_ASSIGNMENTS', payload: Partial<JobCard>[] }
    | { type: 'ADD_PART', payload: Part }
    | { type: 'CREATE_PURCHASE_REQUEST', payload: PurchaseRequest }
    | { type: 'CREATE_PURCHASE_ORDER', payload: PurchaseRequest | { persisted: PurchaseOrder } }
    | { type: 'RECEIVE_GOODS', payload: PurchaseOrder }
    | { type: 'UPDATE_TIRE', payload: Tire }
    | { type: 'ADD_HR_CASE', payload: HRCase }
    | { type: 'UPDATE_HR_CASE', payload: HRCase }
    | { type: 'ADD_PLANNED_SERVICE', payload: PlannedService }
    | { type: 'DELETE_PLANNED_SERVICE', payload: string }
    | { type: 'ASSIGN_DRIVER_TO_VEHICLE', payload: { vehicleId: string, driverId: string | null } }
    | { type: 'ADD_MESSAGE', payload: { vehicleId: string, message: Omit<Message, 'id' | 'vehicleId'> } }
    | { type: 'UPDATE_NAV_PREFERENCES', payload: { email: string, preferences: User['navigationPreferences'] } }
    | { type: 'ADD_SUPPLIER_APPLICATION', payload: any }
    | { type: 'ADD_COMMODITY', payload: string }
    | { type: 'ADD_PACKAGING_TYPE', payload: string };

export const dataReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'RESET_ALL': return getEmptyState();
        case 'SET_USERS': return { ...state, users: action.payload };
        case 'SET_VEHICLES': return { ...state, vehicles: action.payload };
        case 'SET_FUEL_ENTRIES': return { ...state, fuelEntries: action.payload };
        case 'SET_SERVICE_ENTRIES': return { ...state, serviceEntries: action.payload };
        case 'SET_OTHER_COSTS': return { ...state, otherCosts: action.payload };
        case 'SET_RECURRING_COSTS': return { ...state, recurringCosts: action.payload };
        case 'SET_REVENUE_ENTRIES': return { ...state, revenueEntries: action.payload };
        case 'SET_SERVICE_INTERVALS': return { ...state, serviceIntervals: action.payload };
        case 'SET_PLANNED_SERVICES': return { ...state, plannedServices: action.payload };
        case 'SET_FUEL_PRICE_RECORDS': return { ...state, fuelPriceRecords: action.payload };
        case 'SET_BOWSERS': return { ...state, bowsers: action.payload };
        case 'SET_BOWSER_REFILLS': return { ...state, bowserRefills: action.payload };
        case 'SET_BUDGETS': return { ...state, budgets: action.payload };
        case 'SET_FORECASTS': return { ...state, forecasts: action.payload };
        case 'SET_JOB_CARDS': return { ...state, jobCards: action.payload };
        case 'SET_CHECKLIST_TEMPLATES': return { ...state, checklistTemplates: action.payload };
        case 'ADD_CHECKLIST_TEMPLATE': return { ...state, checklistTemplates: [...(state.checklistTemplates || []), action.payload] };
        case 'UPDATE_CHECKLIST_TEMPLATE': return { ...state, checklistTemplates: (state.checklistTemplates || []).map(t => t.id === action.payload.id ? action.payload : t) };
        case 'DELETE_CHECKLIST_TEMPLATE': return { ...state, checklistTemplates: (state.checklistTemplates || []).filter(t => t.id !== action.payload) };
        case 'SET_CHECKLIST_SUBMISSIONS': return { ...state, checklistSubmissions: action.payload };
        case 'SET_TIRES': return { ...state, tires: action.payload };
        case 'SET_TIRE_INSPECTIONS': return { ...state, tireInspections: action.payload };
        case 'SET_PARTS': return { ...state, parts: action.payload };
        case 'SET_PURCHASE_REQUESTS': return { ...state, purchaseRequests: action.payload };
        case 'SET_PURCHASE_ORDERS': return { ...state, purchaseOrders: action.payload };
        case 'SET_HR_CASES': return { ...state, hrCases: action.payload };
        case 'SET_CLIENTS': return { ...state, clients: action.payload };
        case 'SET_DRIVERS': return { ...state, drivers: action.payload };
        case 'ADD_DRIVER': return { ...state, drivers: [...(state.drivers || []), action.payload] };
        case 'UPDATE_DRIVER': return { ...state, drivers: (state.drivers || []).map(d => d.id === action.payload.id ? { ...d, ...action.payload.updates } : d) };
        case 'BULK_ADD_DRIVERS': return { ...state, drivers: [...(state.drivers || []), ...action.payload] };
        case 'SET_SUPPLIERS': return { ...state, suppliers: action.payload };
        case 'SET_QUOTES': return { ...state, quotes: action.payload };
        case 'SET_LOAD_CONFIRMATIONS': return { ...state, loadConfirmations: action.payload };
        case 'SET_MANIFESTS': return { ...state, manifests: action.payload };
        case 'SET_TRIP_SHEETS': return { ...state, tripSheets: action.payload };
        case 'SET_INCIDENT_REPORTS': return { ...state, incidentReports: action.payload };
        case 'SET_SUPPLIER_APPLICATIONS': return { ...state, supplierApplications: action.payload };
        case 'SET_NOTIFICATIONS': return { ...state, notifications: action.payload };
        case 'SET_MESSAGES': return { ...state, messages: action.payload };
        case 'SET_ROUTES': return { ...state, routes: action.payload };
        case 'SET_VEHICLE_COMPLIANCE_DOCS': return { ...state, vehicleComplianceDocs: action.payload };
        case 'SET_BRANCHES': return { ...state, branches: action.payload };
        case 'ADD_USER': return { ...state, users: [...(state.users || []), { ...action.payload, permissions: [] }] };
        case 'UPDATE_USER': return { ...state, users: (state.users || []).map(u => (u.email === action.payload.email || (action.payload.id && u.id === action.payload.id)) ? { ...u, ...action.payload.updates } : u) };
        case 'SELECT_VEHICLE': return { ...state, selectedVehicleId: action.payload };
        // Post-Commit-D: ADD/BULK_ADD vehicle + fuel actions expect the DB-assigned
        // id to already be in the payload (write handler does the Supabase insert
        // first, maps the returned row, then dispatches). The reducer no longer
        // generates ids for these entities.
        case 'ADD_VEHICLE': return { ...state, vehicles: [action.payload, ...(state.vehicles || [])] };
        case 'BULK_ADD_VEHICLES': return { ...state, vehicles: [...action.payload, ...(state.vehicles || [])] };
        case 'ADD_FUEL_ENTRY': {
            const { entry: newEntry } = action.payload;
            const { vehicleId } = newEntry;

            let updatedBowsers = [...(state.bowsers || [])];
            if (newEntry.sourceBowserId) {
                updatedBowsers = updatedBowsers.map(b =>
                    b.id === newEntry.sourceBowserId
                        ? { ...b, currentStock: b.currentStock - newEntry.liters }
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
        case 'UPDATE_FUEL_ENTRY': {
            const { entry } = action.payload;
            return {
                ...state,
                fuelEntries: (state.fuelEntries || []).map(f => (f.id === entry.id ? entry : f)),
            };
        }
        case 'DELETE_FUEL_ENTRY': {
            const { id } = action.payload;
            return {
                ...state,
                fuelEntries: (state.fuelEntries || []).filter(f => f.id !== id),
            };
        }
        case 'BULK_ADD_FUEL_ENTRIES': {
            const newEntries = action.payload;
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
        // Push 4: payloads now arrive with DB-assigned ids (handler does
        // the supabase write first and dispatches the mapped row).
        case 'ADD_SERVICE_ENTRY': {
            const newEntry = action.payload.entry;
            const vehicleId = newEntry.vehicleId;
            // Side effect: bump vehicle odometer / hours if greater. Mirrors
            // the legacy reducer behavior; the Supabase cascade for vehicles
            // table is a follow-up.
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
        case 'ADD_OTHER_COST': return { ...state, otherCosts: [...(state.otherCosts || []), action.payload.cost] };
        case 'BULK_ADD_OTHER_COSTS': return { ...state, otherCosts: [...(state.otherCosts || []), ...action.payload] };
        case 'ADD_RECURRING_COST': return { ...state, recurringCosts: [...(state.recurringCosts || []), action.payload.cost] };
        case 'ADD_REVENUE': return { ...state, revenueEntries: [...(state.revenueEntries || []), action.payload.revenue] };
        case 'ADD_SERVICE_INTERVAL': return { ...state, serviceIntervals: [...(state.serviceIntervals || []), action.payload.interval] };
        case 'DELETE_SERVICE_INTERVAL': return { ...state, serviceIntervals: (state.serviceIntervals || []).filter(i => i.id !== action.payload) };
        case 'UPDATE_VEHICLE': return { ...state, vehicles: (state.vehicles || []).map(v => v.id === action.payload.vehicleId ? { ...v, ...action.payload.updates } : v) };
        // Workshop writes (Push 3): payload arrives with DB-assigned ids.
        case 'CREATE_JOB_CARD': return { ...state, jobCards: [action.payload, ...(state.jobCards || [])] };
        case 'UPDATE_JOB_CARD': return { ...state, jobCards: (state.jobCards || []).map(j => j.id === action.payload.id ? { ...j, ...action.payload.updates } : j) };
        case 'UPDATE_JOB_CARD_STATUS': return { ...state, jobCards: (state.jobCards || []).map(j => j.id === action.payload.id ? { ...j, status: action.payload.status } : j) };
        case 'ADD_CHECKLIST_SUBMISSION': {
            const { vehicleId, currentUser, odometer, hours, persisted } = action.payload;
            // `persisted` is the Supabase-saved row (preferred). Fall back to a
            // locally-built submission only if a caller hasn't persisted yet.
            const newSubmission: ChecklistSubmission = persisted ?? {
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
        // Operations writes (Push 2): payloads now arrive with DB-assigned ids
        // and DB-generated fields (quote_number, load_con_number, status defaults).
        // The handler does the Supabase insert first and dispatches the mapped row.
        case 'ADD_CLIENT': return { ...state, clients: [...(state.clients || []), action.payload] };
        case 'UPDATE_CLIENT': return { ...state, clients: (state.clients || []).map(c => c.id === action.payload.id ? { ...c, ...action.payload.updates } : c) };
        case 'REMOVE_CLIENT': return { ...state, clients: (state.clients || []).filter(c => c.id !== action.payload) };
        case 'REMOVE_SUPPLIER': return { ...state, suppliers: (state.suppliers || []).filter(s => s.id !== action.payload) };
        case 'REMOVE_DRIVER': return { ...state, drivers: (state.drivers || []).filter(d => d.id !== action.payload) };
        case 'BULK_ADD_CLIENTS': return { ...state, clients: [...(state.clients || []), ...action.payload] };
        case 'ADD_SUPPLIER': return { ...state, suppliers: [...(state.suppliers || []), action.payload] };
        case 'UPDATE_SUPPLIER': return { ...state, suppliers: (state.suppliers || []).map(s => s.id === action.payload.id ? { ...s, ...action.payload.updates } : s) };
        case 'BULK_ADD_SUPPLIERS': return { ...state, suppliers: [...(state.suppliers || []), ...action.payload] };
        case 'CREATE_QUOTE': return { ...state, quotes: [action.payload, ...(state.quotes || [])] };
        case 'UPDATE_QUOTE': return { ...state, quotes: (state.quotes || []).map(q => q.id === action.payload.id ? action.payload : q) };
        case 'CREATE_LOAD_CONFIRMATION': return { ...state, loadConfirmations: [action.payload, ...(state.loadConfirmations || [])] };
        case 'UPDATE_LOAD_CONFIRMATION': return { ...state, loadConfirmations: (state.loadConfirmations || []).map(lc => lc.id === action.payload.id ? { ...lc, ...action.payload.updates } : lc) };
        // Push 5: incident payloads now arrive with DB-assigned ids.
        case 'ADD_INCIDENT': return { ...state, incidentReports: [action.payload, ...(state.incidentReports || [])] };
        case 'UPDATE_INCIDENT': return { ...state, incidentReports: (state.incidentReports || []).map(i => i.id === action.payload.id ? action.payload : i) };
        case 'ADD_INCIDENT_QUOTE': return { ...state, incidentReports: (state.incidentReports || []).map(i => i.id === action.payload.incidentId ? { ...i, quotes: [...(i.quotes || []), action.payload.quote] } : i) };
        case 'APPLY_AI_ASSIGNMENTS': return { ...state, jobCards: (state.jobCards || []).map(jc => { const s = action.payload.find((s: any) => s.id === jc.id); return s ? { ...jc, ...s } : jc; }) };
        case 'ADD_PART': return {...state, parts: [...(state.parts || []), action.payload]};
        case 'CREATE_PURCHASE_REQUEST': return {...state, purchaseRequests: [...(state.purchaseRequests || []), action.payload]};
        case 'CREATE_PURCHASE_ORDER': {
            // Preferred path: the handler persisted the PO and passes it back.
            const persistedPo = (action.payload as any)?.persisted as PurchaseOrder | undefined;
            if (persistedPo) {
                return {
                    ...state,
                    purchaseOrders: [...(state.purchaseOrders || []), persistedPo],
                    purchaseRequests: (state.purchaseRequests || []).map(r => r.id === persistedPo.purchaseRequestId ? { ...r, status: 'Ordered' } : r),
                };
            }
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
        // Push 5: management writes
        case 'ADD_BUDGET': return { ...state, budgets: [...(state.budgets || []), action.payload] };
        case 'ADD_FORECAST': return { ...state, forecasts: [...(state.forecasts || []), action.payload] };
        case 'ADD_HR_CASE': return {...state, hrCases: [...(state.hrCases || []), action.payload]};
        case 'UPDATE_HR_CASE': return {...state, hrCases: (state.hrCases || []).map(c => c.id === action.payload.id ? action.payload : c)};
        case 'ADD_PLANNED_SERVICE': return {...state, plannedServices: [...(state.plannedServices || []), action.payload]};
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
        case 'SET_FUEL_PRICE': return { ...state, fuelPriceRecords: [...(state.fuelPriceRecords || []), action.payload] };
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

type Dispatch = React.Dispatch<AppAction>;

// Fetches every table the app needs and dispatches per-table SET_* actions.
// Branches load first so other mappers can resolve UUID -> Branch name.
// Module-level guard: prevents concurrent hydrate runs from racing each
// other into the supabase-js auth lock. When SIGNED_IN fires multiple
// times in quick succession (e.g. signInWithPassword + a token-refresh
// immediately after), only one hydrate runs to completion.
let hydrateInFlight = false;

// Retry helper for the very first authed fetch after sign-in. The
// supabase-js rest client occasionally still has a stale token attached
// for a few hundred milliseconds after SIGNED_IN fires; the first query
// 401s but the next retry succeeds once the JWT has propagated. Three
// attempts at 250ms / 750ms / 2000ms covers the worst case I've seen
// without dragging out the happy path.
const fetchBranchesWithRetry = async (): Promise<{ data: { id: string; code: string }[] | null; error: unknown }> => {
    const delays = [0, 250, 750, 2000];
    let lastError: unknown = null;
    for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
        const res = await supabase.from('branches').select('id, code');
        if (!res.error && res.data) return res;
        lastError = res.error;
        const status = (res.error as { status?: number; code?: string } | null)?.status;
        // Only retry on 401 (token-not-yet-attached). Other errors are
        // genuine - permission, schema, network - retrying won't help.
        if (status !== 401) return res as any;
        console.warn(`[hydrate] branches 401 on attempt ${i + 1}/${delays.length}, will retry`);
    }
    return { data: null, error: lastError };
};

async function hydrateFromSupabase(dispatch: Dispatch): Promise<void> {
    if (hydrateInFlight) {
        console.log('[hydrate] already in flight, skipping duplicate call');
        return;
    }
    hydrateInFlight = true;
    console.log('[hydrate] start');
    try {
        // Use `code` (e.g. 'FBN JHB') not `name` (e.g. 'FBN Johannesburg') -
        // the TypeScript Branch union, the AddVehicleForm dropdown, and the
        // BRANCHES constant all use the short codes. Reading `name` silently
        // populated lookups with display strings that didn't match the
        // codes, so vehicle insert's branch resolution always failed and
        // every mapper returned the wrong Branch label for read rows.
        const branchesRes = await fetchBranchesWithRetry();
        if (branchesRes.error || !branchesRes.data) {
            console.error('[hydrate] branches fetch failed after retries, aborting', branchesRes.error);
            return;
        }
        console.log('[hydrate] branches loaded:', branchesRes.data?.length ?? 0);
        const branchById = new Map<string, Branch>(
            (branchesRes.data || []).map(b => [b.id, b.code as Branch])
        );
        const ctx = { branchById };

        // Store branches in state so write handlers can resolve Branch code -> UUID
        // when constructing insert/update payloads (e.g. vehicles.branch_id).
        dispatch({
            type: 'SET_BRANCHES',
            payload: (branchesRes.data || []).map(b => ({ id: b.id, name: b.code as Branch })),
        });

        const [
            profiles, vehicles, fuelEntries, serviceEntries, otherCosts, recurringCosts,
            revenueEntries, serviceIntervals, plannedServices, fuelPrices, bowsers,
            bowserRefills, budgets, forecasts, jobCards, checklistTemplates,
            checklistSubmissions, tires, tireMountHistory, tireInspections, parts,
            purchaseRequests, purchaseOrders, hrCases, clients, suppliers,
            supplierComplianceDocs, supplierRateCards, quotes, loadConfirmations,
            manifests, tripSheets, incidentReports, supplierApplications, notifications,
            messages, routes, vehicleComplianceDocs, drivers,
        ] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('vehicles').select('*'),
            supabase.from('fuel_entries').select('*'),
            supabase.from('service_entries').select('*'),
            supabase.from('other_costs').select('*'),
            supabase.from('recurring_costs').select('*'),
            supabase.from('revenue_entries').select('*'),
            supabase.from('service_intervals').select('*'),
            supabase.from('planned_services').select('*'),
            supabase.from('fuel_prices').select('*'),
            supabase.from('bowsers').select('*'),
            supabase.from('bowser_refills').select('*'),
            supabase.from('budgets').select('*'),
            supabase.from('forecasts').select('*'),
            supabase.from('job_cards').select('*'),
            supabase.from('checklist_templates').select('*'),
            supabase.from('checklist_submissions').select('*'),
            supabase.from('tires').select('*'),
            supabase.from('tire_mount_history').select('*'),
            supabase.from('tire_inspections').select('*'),
            supabase.from('parts').select('*'),
            supabase.from('purchase_requests').select('*'),
            supabase.from('purchase_orders').select('*'),
            supabase.from('hr_cases').select('*'),
            supabase.from('clients').select('*'),
            supabase.from('suppliers').select('*'),
            supabase.from('supplier_compliance_docs').select('*'),
            supabase.from('supplier_rate_cards').select('*'),
            supabase.from('quotes').select('*'),
            supabase.from('load_confirmations').select('*'),
            supabase.from('manifests').select('*'),
            supabase.from('trip_sheets').select('*'),
            supabase.from('incident_reports').select('*'),
            supabase.from('supplier_applications').select('*'),
            supabase.from('notifications').select('*'),
            supabase.from('messages').select('*'),
            supabase.from('routes').select('*'),
            supabase.from('vehicle_compliance_docs').select('*'),
            supabase.from('drivers' as any).select('*'),
        ]);
        console.log('[hydrate] Promise.all settled (38 tables)');

        const logIfError = (label: string, err: unknown) => {
            if (err) console.error(`RawDataContext: ${label} fetch failed`, err);
        };

        logIfError('profiles', profiles.error);
        logIfError('vehicles', vehicles.error);
        logIfError('fuel_entries', fuelEntries.error);
        logIfError('service_entries', serviceEntries.error);
        logIfError('other_costs', otherCosts.error);
        logIfError('recurring_costs', recurringCosts.error);
        logIfError('revenue_entries', revenueEntries.error);
        logIfError('service_intervals', serviceIntervals.error);
        logIfError('planned_services', plannedServices.error);
        logIfError('fuel_prices', fuelPrices.error);
        logIfError('bowsers', bowsers.error);
        logIfError('bowser_refills', bowserRefills.error);
        logIfError('budgets', budgets.error);
        logIfError('forecasts', forecasts.error);
        logIfError('job_cards', jobCards.error);
        logIfError('checklist_templates', checklistTemplates.error);
        logIfError('checklist_submissions', checklistSubmissions.error);
        logIfError('tires', tires.error);
        logIfError('tire_mount_history', tireMountHistory.error);
        logIfError('tire_inspections', tireInspections.error);
        logIfError('parts', parts.error);
        logIfError('purchase_requests', purchaseRequests.error);
        logIfError('purchase_orders', purchaseOrders.error);
        logIfError('hr_cases', hrCases.error);
        logIfError('clients', clients.error);
        logIfError('suppliers', suppliers.error);
        logIfError('supplier_compliance_docs', supplierComplianceDocs.error);
        logIfError('supplier_rate_cards', supplierRateCards.error);
        logIfError('quotes', quotes.error);
        logIfError('load_confirmations', loadConfirmations.error);
        logIfError('manifests', manifests.error);
        logIfError('trip_sheets', tripSheets.error);
        logIfError('incident_reports', incidentReports.error);
        logIfError('supplier_applications', supplierApplications.error);
        logIfError('notifications', notifications.error);
        logIfError('messages', messages.error);
        logIfError('routes', routes.error);
        logIfError('vehicle_compliance_docs', vehicleComplianceDocs.error);
        logIfError('drivers', (drivers as any).error);

        // Build joins for nested data
        const mountHistoryByTire = new Map<string, NonNullable<typeof tireMountHistory.data>>();
        (tireMountHistory.data || []).forEach(row => {
            const list = mountHistoryByTire.get(row.tire_id) || [];
            list.push(row);
            mountHistoryByTire.set(row.tire_id, list);
        });

        const complianceDocsBySupplier = new Map<string, ComplianceDoc[]>();
        (supplierComplianceDocs.data || []).forEach(row => {
            const mapped = mapSupplierComplianceDoc(row);
            const list = complianceDocsBySupplier.get(row.supplier_id) || [];
            list.push(mapped);
            complianceDocsBySupplier.set(row.supplier_id, list);
        });

        const rateCardsBySupplier = new Map<string, Attachment[]>();
        (supplierRateCards.data || []).forEach(row => {
            const mapped = mapSupplierRateCard(row);
            const list = rateCardsBySupplier.get(row.supplier_id) || [];
            list.push(mapped);
            rateCardsBySupplier.set(row.supplier_id, list);
        });

        if (profiles.data) dispatch({ type: 'SET_USERS', payload: profiles.data.map(r => mapProfile(r, ctx)) });
        if (vehicles.data) dispatch({ type: 'SET_VEHICLES', payload: vehicles.data.map(r => mapVehicle(r, ctx)) });
        if (fuelEntries.data) dispatch({ type: 'SET_FUEL_ENTRIES', payload: fuelEntries.data.map(mapFuelEntry) });
        if (serviceEntries.data) dispatch({ type: 'SET_SERVICE_ENTRIES', payload: serviceEntries.data.map(mapServiceEntry) });
        if (otherCosts.data) dispatch({ type: 'SET_OTHER_COSTS', payload: otherCosts.data.map(mapOtherCost) });
        if (recurringCosts.data) dispatch({ type: 'SET_RECURRING_COSTS', payload: recurringCosts.data.map(mapRecurringCost) });
        if (revenueEntries.data) dispatch({ type: 'SET_REVENUE_ENTRIES', payload: revenueEntries.data.map(mapRevenueEntry) });
        if (serviceIntervals.data) dispatch({ type: 'SET_SERVICE_INTERVALS', payload: serviceIntervals.data.map(mapServiceInterval) });
        if (plannedServices.data) dispatch({ type: 'SET_PLANNED_SERVICES', payload: plannedServices.data.map(mapPlannedService) });
        if (fuelPrices.data) dispatch({ type: 'SET_FUEL_PRICE_RECORDS', payload: fuelPrices.data.map(mapFuelPrice) });
        if (bowsers.data) dispatch({ type: 'SET_BOWSERS', payload: bowsers.data.map(mapBowser) });
        if (bowserRefills.data) dispatch({ type: 'SET_BOWSER_REFILLS', payload: bowserRefills.data.map(mapBowserRefill) });
        if (budgets.data) dispatch({ type: 'SET_BUDGETS', payload: budgets.data.map(mapBudget) });
        if (forecasts.data) dispatch({ type: 'SET_FORECASTS', payload: forecasts.data.map(mapForecast) });
        if (jobCards.data) dispatch({ type: 'SET_JOB_CARDS', payload: jobCards.data.map(mapJobCard) });
        if (checklistTemplates.data) dispatch({ type: 'SET_CHECKLIST_TEMPLATES', payload: checklistTemplates.data.map(mapChecklistTemplate) });
        if (checklistSubmissions.data) dispatch({ type: 'SET_CHECKLIST_SUBMISSIONS', payload: checklistSubmissions.data.map(mapChecklistSubmission) });
        if (tires.data) dispatch({ type: 'SET_TIRES', payload: tires.data.map(r => mapTire(r, mountHistoryByTire)) });
        if (tireInspections.data) dispatch({ type: 'SET_TIRE_INSPECTIONS', payload: tireInspections.data.map(mapTireInspection) });
        if (parts.data) dispatch({ type: 'SET_PARTS', payload: parts.data.map(mapPart) });
        if (purchaseRequests.data) dispatch({ type: 'SET_PURCHASE_REQUESTS', payload: purchaseRequests.data.map(mapPurchaseRequest) });
        if (purchaseOrders.data) dispatch({ type: 'SET_PURCHASE_ORDERS', payload: purchaseOrders.data.map(mapPurchaseOrder) });
        if (hrCases.data) dispatch({ type: 'SET_HR_CASES', payload: hrCases.data.map(mapHRCase) });
        if (clients.data) dispatch({ type: 'SET_CLIENTS', payload: clients.data.map(mapClient) });
        if ((drivers as any).data) dispatch({ type: 'SET_DRIVERS', payload: (drivers as any).data.map(mapDriver) });
        if (suppliers.data) dispatch({ type: 'SET_SUPPLIERS', payload: suppliers.data.map(r => mapSupplier(r, complianceDocsBySupplier, rateCardsBySupplier)) });
        if (quotes.data) dispatch({ type: 'SET_QUOTES', payload: quotes.data.map(mapQuote) });
        if (loadConfirmations.data) dispatch({ type: 'SET_LOAD_CONFIRMATIONS', payload: loadConfirmations.data.map(r => mapLoadConfirmation(r, ctx)) });
        if (manifests.data) dispatch({ type: 'SET_MANIFESTS', payload: manifests.data.map(r => mapManifest(r, ctx)) });
        if (tripSheets.data) dispatch({ type: 'SET_TRIP_SHEETS', payload: tripSheets.data.map(r => mapTripSheet(r, ctx)) });
        if (incidentReports.data) dispatch({ type: 'SET_INCIDENT_REPORTS', payload: incidentReports.data.map(mapIncidentReport) });
        if (supplierApplications.data) dispatch({ type: 'SET_SUPPLIER_APPLICATIONS', payload: supplierApplications.data.map(mapSupplierApplication) });
        if (notifications.data) dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications.data.map(mapNotification) });
        if (messages.data) dispatch({ type: 'SET_MESSAGES', payload: messages.data.map(mapMessage) });
        if (routes.data) dispatch({ type: 'SET_ROUTES', payload: routes.data.map(mapRoute) });
        if (vehicleComplianceDocs.data) dispatch({ type: 'SET_VEHICLE_COMPLIANCE_DOCS', payload: vehicleComplianceDocs.data.map(mapVehicleComplianceDoc) });
        console.log('[hydrate] end — dispatched all tables');
    } catch (err) {
        console.error('[hydrate] failed with thrown error', err);
    } finally {
        hydrateInFlight = false;
    }
}

export const RawDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, getInitialState());

    useEffect(() => {
        let active = true;

        const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!active) return;

            if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session?.user)) {
                dispatch({ type: 'RESET_ALL' });
                return;
            }

            if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
                await hydrateFromSupabase(dispatch);
            }
        });

        return () => {
            active = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

    return (
        <RawDataContext.Provider value={value}>
            {children}
        </RawDataContext.Provider>
    );
};
