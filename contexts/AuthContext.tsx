
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { User, Permission } from '../types';
import { useCommonData } from './CommonDataContext';

interface AuthState {
  currentUser: User | null;
  viewingClientAsAdmin: User | null;
}

interface AuthContextType extends AuthState {
  handleLogin: (email: string) => void;
  handleLogout: () => void;
  hasPermission: (permission: Permission) => boolean;
  setViewClientAsAdmin: (user: User | null) => void;
  currentViewOverride: string | null;
  updateNavPreferences: (prefs: User['navigationPreferences']) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { users, handleUpdateNavPreferences } = useCommonData();

    const [state, setState] = useState<AuthState>({
        currentUser: null,
        viewingClientAsAdmin: null,
    });
    
    const [currentViewOverride, setCurrentViewOverride] = useState<string | null>(null);

    const handleLogin = useCallback((email: string) => {
        if (!users || users.length === 0) return;
        const user = users.find((u: User) => u.email === email);
        if (user) {
            localStorage.setItem('currentUserEmail', email);
            setState(prev => ({ ...prev, currentUser: user }));
        }
    }, [users]);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('currentUserEmail');
        setState(prev => ({ ...prev, currentUser: null, viewingClientAsAdmin: null }));
    }, []);
    
    const setViewClientAsAdmin = useCallback((user: User | null) => {
        setState(prev => ({...prev, viewingClientAsAdmin: user}));
    }, []);

    const hasPermission = useCallback((permission: Permission) => {
        return state.currentUser?.permissions.includes(permission) ?? false;
    }, [state.currentUser]);

    const updateNavPreferences = useCallback((prefs: User['navigationPreferences']) => {
        if (state.currentUser) {
            handleUpdateNavPreferences(state.currentUser.email, prefs);
        }
    }, [state.currentUser, handleUpdateNavPreferences]);
    
    useEffect(() => {
        if (users && users.length > 0) {
            const storedEmail = localStorage.getItem('currentUserEmail');
            if (storedEmail) {
                handleLogin(storedEmail);
            }
        }
    }, [handleLogin, users]);

    const value = useMemo(() => ({ 
        ...state, 
        handleLogin, 
        handleLogout, 
        hasPermission, 
        setViewClientAsAdmin, 
        currentViewOverride, 
        updateNavPreferences 
    }), [state, handleLogin, handleLogout, hasPermission, setViewClientAsAdmin, currentViewOverride, updateNavPreferences]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
