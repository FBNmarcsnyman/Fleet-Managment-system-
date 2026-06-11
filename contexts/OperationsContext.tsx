
import React, { createContext, useContext, useMemo, useRef, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { User, Quote, LoadConfirmation, Client, Supplier, Branch } from '../types';
import { supabase, runWrite } from '../lib/supabase';
import {
    toClientInsert, toSupplierInsert, toQuoteInsert, toQuoteUpdate,
    toLoadConfirmationInsert, toLoadConfirmationUpdate,
    mapClient, mapSupplier, mapQuote, mapLoadConfirmation,
    toChecklistSubmissionInsert, mapChecklistSubmission,
} from '../lib/mappers';

export const OperationsContext = createContext<any>(undefined);

type Result<T = void> = { ok: true; value?: T } | { ok: false; error: string };

export const OperationsDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

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

    const derived = useMemo(() => ({
        unassignedJobCount: (state.loadConfirmations || []).filter(lc => lc.status === 'Booked').length,
    }), [state.loadConfirmations]);

    const handlers = useMemo(() => ({
        // -- Clients ----------------------------------------------------------
        handleAddClient: async (client: Omit<Client, 'id'>): Promise<Result<Client>> => {
            try {
                const row = toClientInsert(client);
                const { data, error } = await supabase
                    .from('clients').insert(row).select().single();
                if (error) { console.error('[ops] addClient failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapClient(data);
                dispatch({ type: 'ADD_CLIENT', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] addClient threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleBulkAddClients: async (clients: Omit<Client, 'id'>[]): Promise<Result<{ count: number }>> => {
            try {
                const rows = clients.map(toClientInsert);
                const { data, error } = await supabase.from('clients').insert(rows).select();
                if (error) { console.error('[ops] bulkAddClients failed:', error); return { ok: false, error: error.message }; }
                const mapped = (data || []).map(mapClient);
                dispatch({ type: 'BULK_ADD_CLIENTS', payload: mapped });
                return { ok: true, value: { count: mapped.length } };
            } catch (err) {
                console.error('[ops] bulkAddClients threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Suppliers --------------------------------------------------------
        handleAddSupplier: async (supplier: Omit<Supplier, 'id'>): Promise<Result<Supplier>> => {
            try {
                // Default complianceStatus matches the pre-migration reducer behavior.
                const withDefaults: Omit<Supplier, 'id'> = { complianceStatus: 'Pending', complianceDocs: [], rateCards: [], ...supplier };
                const row = toSupplierInsert(withDefaults);
                const { data, error } = await supabase
                    .from('suppliers').insert(row).select().single();
                if (error) { console.error('[ops] addSupplier failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapSupplier(data, new Map(), new Map());
                dispatch({ type: 'ADD_SUPPLIER', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] addSupplier threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleBulkAddSuppliers: async (suppliers: Omit<Supplier, 'id'>[]): Promise<Result<{ count: number }>> => {
            try {
                const rows = suppliers.map(s => toSupplierInsert({
                    complianceStatus: 'Pending', complianceDocs: [], rateCards: [], ...s,
                }));
                const { data, error } = await supabase.from('suppliers').insert(rows).select();
                if (error) { console.error('[ops] bulkAddSuppliers failed:', error); return { ok: false, error: error.message }; }
                const mapped = (data || []).map(r => mapSupplier(r, new Map(), new Map()));
                dispatch({ type: 'BULK_ADD_SUPPLIERS', payload: mapped });
                return { ok: true, value: { count: mapped.length } };
            } catch (err) {
                console.error('[ops] bulkAddSuppliers threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Quotes -----------------------------------------------------------
        handleCreateQuote: async (quote: any): Promise<Result<Quote>> => {
            try {
                const quoteNumber = `QU-${Date.now()}`;
                const row = toQuoteInsert(quote, quoteNumber);
                const { data, error } = await supabase
                    .from('quotes').insert(row).select().single();
                if (error) { console.error('[ops] createQuote failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapQuote(data);
                dispatch({ type: 'CREATE_QUOTE', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] createQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateQuote: async (quote: Quote): Promise<Result<Quote>> => {
            try {
                const row = toQuoteUpdate(quote);
                const { error } = await supabase
                    .from('quotes').update(row).eq('id', quote.id);
                if (error) { console.error('[ops] updateQuote failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_QUOTE', payload: quote });
                return { ok: true, value: quote };
            } catch (err) {
                console.error('[ops] updateQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleAcceptQuote: async (quote: Quote): Promise<Result<Quote>> => {
            try {
                const { error } = await supabase
                    .from('quotes').update({ status: 'Accepted' }).eq('id', quote.id);
                if (error) { console.error('[ops] acceptQuote failed:', error); return { ok: false, error: error.message }; }
                const updated: Quote = { ...quote, status: 'Accepted' };
                dispatch({ type: 'UPDATE_QUOTE', payload: updated });
                return { ok: true, value: updated };
            } catch (err) {
                console.error('[ops] acceptQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleRejectQuote: async (quote: Quote): Promise<Result<Quote>> => {
            try {
                const { error } = await supabase
                    .from('quotes').update({ status: 'Rejected' }).eq('id', quote.id);
                if (error) { console.error('[ops] rejectQuote failed:', error); return { ok: false, error: error.message }; }
                const updated: Quote = { ...quote, status: 'Rejected' };
                dispatch({ type: 'UPDATE_QUOTE', payload: updated });
                return { ok: true, value: updated };
            } catch (err) {
                console.error('[ops] rejectQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Load Confirmations ----------------------------------------------
        handleCreateLoadConfirmation: async (data: any): Promise<Result<LoadConfirmation>> => {
            try {
                const loadConNumber = `LCN-${Date.now()}`;
                const row = toLoadConfirmationInsert(data, loadConNumber, branchIdByName);
                const { data: inserted, error } = await supabase
                    .from('load_confirmations').insert(row).select().single();
                if (error) { console.error('[ops] createLoadConfirmation failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapLoadConfirmation(inserted, { branchById });
                dispatch({ type: 'CREATE_LOAD_CONFIRMATION', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[ops] createLoadConfirmation threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateLoadConfirmation: async (id: string, updates: Partial<LoadConfirmation>): Promise<Result<void>> => {
            try {
                const row = toLoadConfirmationUpdate(updates, branchIdByName);
                const { error } = await supabase
                    .from('load_confirmations').update(row).eq('id', id);
                if (error) { console.error('[ops] updateLoadConfirmation failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id, updates } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] updateLoadConfirmation threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleAssignLoadConfirmation: async (loadConId: string, vehicleId: string, driverId: string): Promise<Result<void>> => {
            try {
                const { error } = await supabase
                    .from('load_confirmations')
                    .update({ vehicle_id: vehicleId, driver_id: driverId, status: 'Driver Assigned' })
                    .eq('id', loadConId);
                if (error) { console.error('[ops] assignLoadConfirmation failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: loadConId, updates: { vehicleId, driverId, status: 'Driver Assigned' } } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] assignLoadConfirmation threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleApprovePayment: async (loadConId: string): Promise<Result<void>> => {
            try {
                const { error } = await supabase
                    .from('load_confirmations')
                    .update({ payment_status: 'Ready for Payment' })
                    .eq('id', loadConId);
                if (error) { console.error('[ops] approvePayment failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: loadConId, updates: { paymentStatus: 'Ready for Payment' } } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] approvePayment threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // Persists the inspection to Supabase, then updates local state with the
        // saved row. Never reports success unless the write actually landed.
        handleAddChecklistSubmission: async (submission: any, currentUser: User): Promise<{ ok: boolean; error?: string }> => {
            try {
                if (!currentUser) return { ok: false, error: 'No signed-in user — cannot record who did the inspection.' };
                const odometer = submission.odometer ?? 0;
                const insertRow = toChecklistSubmissionInsert({
                    templateId: submission.templateId,
                    templateName: submission.templateName,
                    vehicleId: submission.vehicleId,
                    userId: currentUser.email,
                    userName: currentUser.name,
                    odometer,
                    hours: submission.hours,
                    results: submission.allResults ?? submission.results ?? [],
                });
                const { data, error } = await runWrite(() =>
                    supabase.from('checklist_submissions').insert(insertRow).select().single());
                if (error || !data) {
                    console.error('[ops] addChecklistSubmission failed:', error);
                    return { ok: false, error: error?.message || 'The checklist could not be saved.' };
                }
                // Best-effort: keep the vehicle's odometer/hours current.
                const cur = stateRef.current;
                const vehicle = (cur.vehicles || []).find((v: any) => v.id === submission.vehicleId);
                const vUpdates: any = {};
                if (vehicle && (!vehicle.currentOdometer || odometer > vehicle.currentOdometer)) vUpdates.current_odometer = odometer;
                if (vehicle && submission.hours && (!vehicle.currentHours || submission.hours > vehicle.currentHours)) vUpdates.current_hours = submission.hours;
                if (Object.keys(vUpdates).length > 0) {
                    const { error: vErr } = await supabase.from('vehicles').update(vUpdates).eq('id', submission.vehicleId);
                    if (vErr) console.error('[ops] checklist vehicle odo/hours bump failed:', vErr);
                }
                dispatch({ type: 'ADD_CHECKLIST_SUBMISSION', payload: { persisted: mapChecklistSubmission(data), vehicleId: submission.vehicleId, currentUser, odometer, hours: submission.hours } });
                return { ok: true };
            } catch (err) {
                console.error('[ops] addChecklistSubmission threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Deferred to later push (still local-only) ------------------------
        // Manifests, trip sheets, and supplier applications are not yet wired to
        // Supabase. They mutate local state only via the reducer.
        handleCreateManifest: (payload: any) => dispatch({ type: 'CREATE_MANIFEST', payload }),
        handleCreateTripSheet: (payload: any) => dispatch({ type: 'CREATE_TRIP_SHEET', payload }),
        handleAddSupplierApplication: (data: any) => dispatch({ type: 'ADD_SUPPLIER_APPLICATION', payload: data }),
    }), [dispatch, branchIdByName, branchById]);

    const value = useMemo(() => ({ ...state, ...derived, ...handlers, users }), [state, derived, handlers, users]);
    return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
};

export const useOperations = () => useContext(OperationsContext);
