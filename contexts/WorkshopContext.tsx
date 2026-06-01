
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { JobCard, JobCardStatus, PurchaseRequest, PurchaseOrder, Part, Tire } from '../types';
import { supabase } from '../lib/supabase';
import {
    toJobCardInsert, toJobCardUpdate, toPartInsert, toPurchaseRequestInsert, toTireUpdate,
    mapJobCard, mapPart, mapPurchaseRequest,
} from '../lib/mappers';

export const WorkshopContext = createContext<any>(undefined);

type Result<T = void> = { ok: true; value?: T } | { ok: false; error: string };

export const WorkshopDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

    const handlers = useMemo(() => ({
        // -- Job Cards --------------------------------------------------------
        handleCreateJobCard: async (jobCard: any): Promise<Result<JobCard>> => {
            try {
                const row = toJobCardInsert(jobCard);
                const { data, error } = await supabase
                    .from('job_cards').insert(row).select().single();
                if (error) { console.error('[workshop] createJobCard failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapJobCard(data);
                dispatch({ type: 'CREATE_JOB_CARD', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[workshop] createJobCard threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateJobCard: async (id: string, updates: Partial<JobCard>): Promise<Result<void>> => {
            try {
                const row = toJobCardUpdate(updates);
                const { error } = await supabase
                    .from('job_cards').update(row).eq('id', id);
                if (error) { console.error('[workshop] updateJobCard failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_JOB_CARD', payload: { id, updates } });
                return { ok: true };
            } catch (err) {
                console.error('[workshop] updateJobCard threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateJobCardStatus: async (id: string, status: JobCardStatus): Promise<Result<void>> => {
            try {
                const { error } = await supabase
                    .from('job_cards').update({ status }).eq('id', id);
                if (error) { console.error('[workshop] updateJobCardStatus failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_JOB_CARD_STATUS', payload: { id, status } });
                return { ok: true };
            } catch (err) {
                console.error('[workshop] updateJobCardStatus threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Parts ------------------------------------------------------------
        handleAddPart: async (part: Omit<Part, 'id'>): Promise<Result<Part>> => {
            try {
                const row = toPartInsert(part);
                const { data, error } = await supabase
                    .from('parts').insert(row).select().single();
                if (error) { console.error('[workshop] addPart failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapPart(data);
                dispatch({ type: 'ADD_PART', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[workshop] addPart threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Purchase Requests -----------------------------------------------
        handleCreatePurchaseRequest: async (request: any, userId: string): Promise<Result<PurchaseRequest>> => {
            try {
                const withUser = { ...request, requestedByUserId: userId };
                const row = toPurchaseRequestInsert(withUser);
                const { data, error } = await supabase
                    .from('purchase_requests').insert(row).select().single();
                if (error) { console.error('[workshop] createPurchaseRequest failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapPurchaseRequest(data);
                dispatch({ type: 'CREATE_PURCHASE_REQUEST', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[workshop] createPurchaseRequest threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Tires ------------------------------------------------------------
        handleUpdateTire: async (tire: Tire): Promise<Result<Tire>> => {
            try {
                const row = toTireUpdate(tire);
                const { error } = await supabase
                    .from('tires').update(row).eq('id', tire.id);
                if (error) { console.error('[workshop] updateTire failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_TIRE', payload: tire });
                return { ok: true, value: tire };
            } catch (err) {
                console.error('[workshop] updateTire threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Still local-only (deferred to later push) ------------------------
        applyAiAssignments: (suggestions: Partial<JobCard>[]) => dispatch({ type: 'APPLY_AI_ASSIGNMENTS', payload: suggestions }),
        handleCreatePurchaseOrder: (req: PurchaseRequest) => dispatch({ type: 'CREATE_PURCHASE_ORDER', payload: req }),
        handleReceiveGoods: (order: PurchaseOrder) => dispatch({ type: 'RECEIVE_GOODS', payload: order }),
        handleAddPlannedService: (service: any) => dispatch({ type: 'ADD_PLANNED_SERVICE', payload: service }),
        handleDeletePlannedService: (id: string) => dispatch({ type: 'DELETE_SERVICE_INTERVAL', payload: id }),
    }), [dispatch]);

    const value = useMemo(() => ({ ...state, ...handlers, users }), [state, handlers, users]);
    return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
};

export const useWorkshop = () => useContext(WorkshopContext);
