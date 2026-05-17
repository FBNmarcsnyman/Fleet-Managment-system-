
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { JobCard, JobCardStatus, PurchaseRequest, PurchaseOrder } from '../types';

export const WorkshopContext = createContext<any>(undefined);

export const WorkshopDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

    const handlers = useMemo(() => ({
        handleCreateJobCard: (jobCard: any) => dispatch({ type: 'CREATE_JOB_CARD', payload: jobCard }),
        handleUpdateJobCard: (id: string, updates: Partial<JobCard>) => dispatch({ type: 'UPDATE_JOB_CARD', payload: { id, updates } }),
        handleUpdateJobCardStatus: (id: string, status: JobCardStatus) => dispatch({ type: 'UPDATE_JOB_CARD_STATUS', payload: { id, status } }),
        applyAiAssignments: (suggestions: Partial<JobCard>[]) => dispatch({ type: 'APPLY_AI_ASSIGNMENTS', payload: suggestions }),
        handleAddPart: (part: any) => dispatch({ type: 'ADD_PART', payload: part }),
        handleCreatePurchaseRequest: (request: any, userId: string) => dispatch({ type: 'CREATE_PURCHASE_REQUEST', payload: {...request, requestedByUserId: userId } }),
        handleCreatePurchaseOrder: (req: PurchaseRequest) => dispatch({ type: 'CREATE_PURCHASE_ORDER', payload: req }),
        handleReceiveGoods: (order: PurchaseOrder) => dispatch({ type: 'RECEIVE_GOODS', payload: order }),
        handleAddPlannedService: (service: any) => dispatch({ type: 'ADD_PLANNED_SERVICE', payload: service }),
        handleDeletePlannedService: (id: string) => dispatch({ type: 'DELETE_SERVICE_INTERVAL', payload: id }),
    }), [dispatch]);

    const value = useMemo(() => ({ ...state, ...handlers, users }), [state, handlers, users]);
    return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
};

export const useWorkshop = () => useContext(WorkshopContext);
