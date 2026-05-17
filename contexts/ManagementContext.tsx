
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { Budget, Forecast, HRCase } from '../types';

export const ManagementContext = createContext<any>(undefined);

export const ManagementDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

    const handlers = useMemo(() => ({
        handleAddBudget: (budget: Omit<Budget, 'id'>) => dispatch({ type: 'ADD_BUDGET', payload: budget }),
        handleAddForecast: (forecast: Omit<Forecast, 'id'>) => dispatch({ type: 'ADD_FORECAST', payload: forecast }),
        handleAddHRCase: (hrCase: Omit<HRCase, 'id'>) => dispatch({ type: 'ADD_HR_CASE', payload: hrCase }),
        handleUpdateHRCase: (hrCase: HRCase) => dispatch({ type: 'UPDATE_HR_CASE', payload: hrCase }),
        handleAddIncident: (incident: any) => dispatch({ type: 'ADD_INCIDENT', payload: incident }),
        handleUpdateIncident: (incident: any) => dispatch({ type: 'UPDATE_INCIDENT', payload: incident }),
        handleAddIncidentQuote: (incidentId: string, quote: any) => dispatch({ type: 'ADD_INCIDENT_QUOTE', payload: { incidentId, quote } }),
    }), [dispatch]);

    const value = useMemo(() => ({ ...state, ...handlers, users }), [state, handlers, users]);
    return <ManagementContext.Provider value={value}>{children}</ManagementContext.Provider>;
};

export const useManagement = () => useContext(ManagementContext);
