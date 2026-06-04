
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { Budget, Forecast, HRCase, IncidentReport, IncidentQuote } from '../types';
import { supabase } from '../lib/supabase';
import {
    toBudgetInsert, toForecastInsert, toHRCaseInsert, toHRCaseUpdate,
    toIncidentInsert, toIncidentUpdate,
    mapBudget, mapForecast, mapHRCase, mapIncidentReport,
} from '../lib/mappers';

export const ManagementContext = createContext<any>(undefined);

type Result<T = void> = { ok: true; value?: T } | { ok: false; error: string };

export const ManagementDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

    const handlers = useMemo(() => ({
        // -- Budgets / Forecasts ---------------------------------------------
        handleAddBudget: async (budget: Omit<Budget, 'id'>): Promise<Result<Budget>> => {
            try {
                const row = toBudgetInsert(budget);
                const { data, error } = await supabase
                    .from('budgets').insert(row).select().single();
                if (error) { console.error('[mgmt] addBudget failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapBudget(data);
                dispatch({ type: 'ADD_BUDGET', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[mgmt] addBudget threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleAddForecast: async (forecast: Omit<Forecast, 'id'>): Promise<Result<Forecast>> => {
            try {
                const row = toForecastInsert(forecast);
                const { data, error } = await supabase
                    .from('forecasts').insert(row).select().single();
                if (error) { console.error('[mgmt] addForecast failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapForecast(data);
                dispatch({ type: 'ADD_FORECAST', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[mgmt] addForecast threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- HR Cases ---------------------------------------------------------
        handleAddHRCase: async (hrCase: Omit<HRCase, 'id'>): Promise<Result<HRCase>> => {
            try {
                const row = toHRCaseInsert(hrCase);
                const { data, error } = await supabase
                    .from('hr_cases').insert(row).select().single();
                if (error) { console.error('[mgmt] addHRCase failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapHRCase(data);
                dispatch({ type: 'ADD_HR_CASE', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[mgmt] addHRCase threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateHRCase: async (hrCase: HRCase): Promise<Result<HRCase>> => {
            try {
                const row = toHRCaseUpdate(hrCase);
                const { error } = await supabase
                    .from('hr_cases').update(row).eq('id', hrCase.id);
                if (error) { console.error('[mgmt] updateHRCase failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_HR_CASE', payload: hrCase });
                return { ok: true, value: hrCase };
            } catch (err) {
                console.error('[mgmt] updateHRCase threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },

        // -- Incidents --------------------------------------------------------
        handleAddIncident: async (incident: Omit<IncidentReport, 'id'>): Promise<Result<IncidentReport>> => {
            try {
                const row = toIncidentInsert(incident);
                const { data, error } = await supabase
                    .from('incident_reports').insert(row).select().single();
                if (error) { console.error('[mgmt] addIncident failed:', error); return { ok: false, error: error.message }; }
                const mapped = mapIncidentReport(data);
                dispatch({ type: 'ADD_INCIDENT', payload: mapped });
                return { ok: true, value: mapped };
            } catch (err) {
                console.error('[mgmt] addIncident threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleUpdateIncident: async (incident: IncidentReport): Promise<Result<IncidentReport>> => {
            try {
                const row = toIncidentUpdate(incident);
                const { error } = await supabase
                    .from('incident_reports').update(row).eq('id', incident.id);
                if (error) { console.error('[mgmt] updateIncident failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'UPDATE_INCIDENT', payload: incident });
                return { ok: true, value: incident };
            } catch (err) {
                console.error('[mgmt] updateIncident threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
        handleAddIncidentQuote: async (incidentId: string, quote: IncidentQuote): Promise<Result<void>> => {
            try {
                // incident.quotes is a JSONB array on the row; append + update.
                const existing = (state.incidentReports || []).find(i => i.id === incidentId);
                if (!existing) return { ok: false, error: 'Incident not found' };
                const newQuotes = [...(existing.quotes || []), quote];
                const { error } = await supabase
                    .from('incident_reports')
                    .update({ quotes: newQuotes as unknown as any })
                    .eq('id', incidentId);
                if (error) { console.error('[mgmt] addIncidentQuote failed:', error); return { ok: false, error: error.message }; }
                dispatch({ type: 'ADD_INCIDENT_QUOTE', payload: { incidentId, quote } });
                return { ok: true };
            } catch (err) {
                console.error('[mgmt] addIncidentQuote threw:', err);
                return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
            }
        },
    }), [dispatch, state.incidentReports]);

    const value = useMemo(() => ({ ...state, ...handlers, users }), [state, handlers, users]);
    return <ManagementContext.Provider value={value}>{children}</ManagementContext.Provider>;
};

export const useManagement = () => useContext(ManagementContext);
