
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RawDataContext, generateId } from './RawDataContext';
import { CommonDataContext } from './CommonDataContext';
import { User, Quote, LoadConfirmation } from '../types';

export const OperationsContext = createContext<any>(undefined);

export const OperationsDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    const common = useContext(CommonDataContext);
    if (!raw || !common) return <>{children}</>;
    const { state, dispatch } = raw;
    const { users } = common;

    const derived = useMemo(() => ({ unassignedJobCount: (state.loadConfirmations || []).filter(lc => lc.status === 'Booked').length }), [state.loadConfirmations]);

    const handlers = useMemo(() => ({
        handleAddClient: (client: any) => { const newId = generateId(); dispatch({ type: 'ADD_CLIENT', payload: {id: newId, ...client}}); return newId; },
        handleBulkAddClients: (clients: any) => dispatch({ type: 'BULK_ADD_CLIENTS', payload: clients }),
        handleAddSupplier: (supplier: any) => dispatch({ type: 'ADD_SUPPLIER', payload: supplier }),
        handleBulkAddSuppliers: (suppliers: any) => dispatch({ type: 'BULK_ADD_SUPPLIERS', payload: suppliers }),
        handleCreateQuote: (quote: any) => dispatch({ type: 'CREATE_QUOTE', payload: quote }),
        handleUpdateQuote: (quote: any) => dispatch({ type: 'UPDATE_QUOTE', payload: quote }),
        handleAcceptQuote: (quote: Quote) => dispatch({ type: 'UPDATE_QUOTE', payload: { ...quote, status: 'Accepted' } }),
        handleRejectQuote: (quote: Quote) => dispatch({ type: 'UPDATE_QUOTE', payload: { ...quote, status: 'Rejected' } }),
        handleCreateLoadConfirmation: (data: any) => dispatch({ type: 'CREATE_LOAD_CONFIRMATION', payload: data }),
        handleUpdateLoadConfirmation: (id: string, updates: Partial<LoadConfirmation>) => dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id, updates } }),
        handleAssignLoadConfirmation: (loadConId: string, vehicleId: string, driverId: string) => dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: loadConId, updates: { vehicleId, driverId, status: 'Driver Assigned' } } }),
        handleApprovePayment: (loadConId: string) => dispatch({ type: 'UPDATE_LOAD_CONFIRMATION', payload: { id: loadConId, updates: { paymentStatus: 'Ready for Payment' } } }),
        handleCreateManifest: (payload: any) => dispatch({ type: 'CREATE_MANIFEST', payload }),
        handleCreateTripSheet: (payload: any) => dispatch({ type: 'CREATE_TRIP_SHEET', payload }),
        handleAddSupplierApplication: (data: any) => dispatch({ type: 'ADD_SUPPLIER_APPLICATION', payload: data }),
        handleAddChecklistSubmission: (submission: any, currentUser: User) => dispatch({ type: 'ADD_CHECKLIST_SUBMISSION', payload: {...submission, currentUser} }),
    }), [dispatch]);

    const value = useMemo(() => ({ ...state, ...derived, ...handlers, users }), [state, derived, handlers, users]);
    return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
};

export const useOperations = () => useContext(OperationsContext);
