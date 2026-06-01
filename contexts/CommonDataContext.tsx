
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RawDataContext } from './RawDataContext';
import { User, Notification, Message } from '../types';

interface CommonDataContextType {
    users: User[];
    notifications: Notification[];
    messages: Message[];
    handleAddUser: (user: any) => void;
    handleSendMessage: (vehicleId: string, message: any) => void;
    handleUpdateNavPreferences: (email: string, preferences: any) => void;
    handleDismissNotification: (id: string) => void;
    handleDismissAllNotifications: () => void;
    dispatch: any;
}

export const CommonDataContext = createContext<CommonDataContextType | undefined>(undefined);

export const CommonDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const raw = useContext(RawDataContext);
    if (!raw) return <>{children}</>;
    const { state, dispatch } = raw;
    
    const value = useMemo(() => ({
        users: state.users || [],
        notifications: state.notifications || [],
        messages: state.messages || [],
        handleAddUser: (user: any) => dispatch({ type: 'ADD_USER', payload: user }),
        handleSendMessage: (vehicleId: string, message: any) => dispatch({ type: 'ADD_MESSAGE', payload: { vehicleId, message } }),
        handleUpdateNavPreferences: (email: string, preferences: any) => dispatch({ type: 'UPDATE_NAV_PREFERENCES', payload: { email, preferences } }),
        // Local-only for now: dismiss filters the notification out of state.
        // Wiring to Supabase notifications table (UPDATE is_read=true or DELETE)
        // is deferred to a Push 5 follow-up.
        handleDismissNotification: (id: string) => dispatch({
            type: 'SET_NOTIFICATIONS',
            payload: (state.notifications || []).filter(n => n.id !== id),
        }),
        handleDismissAllNotifications: () => dispatch({
            type: 'SET_NOTIFICATIONS',
            payload: [],
        }),
        dispatch
    }), [state.users, state.notifications, state.messages, dispatch]);

    return <CommonDataContext.Provider value={value}>{children}</CommonDataContext.Provider>;
};

export const useCommonData = () => {
    const context = useContext(CommonDataContext);
    if (!context) throw new Error('useCommonData must be used within a CommonDataProvider');
    return context;
};
