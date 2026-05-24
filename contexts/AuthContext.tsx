import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { User, Permission, Branch } from '../types';
import { useCommonData } from './CommonDataContext';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  currentUser: User | null;
  viewingClientAsAdmin: User | null;
}

type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthContextType extends AuthState {
  handleLogin: (email: string, password: string) => Promise<LoginResult>;
  handleLogout: () => void;
  hasPermission: (permission: Permission) => boolean;
  setViewClientAsAdmin: (user: User | null) => void;
  currentViewOverride: string | null;
  updateNavPreferences: (prefs: User['navigationPreferences']) => void;
  resetPassword: (email: string) => Promise<LoginResult>;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapProfileRow = (row: ProfileRow, branchById: Map<string, Branch>): User => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as User['role'],
    permissions: (row.permissions || []) as Permission[],
    assignedBranches: (row.assigned_branch_ids || [])
        .map(id => branchById.get(id))
        .filter((b): b is Branch => b !== undefined),
    assignedVehicleIds: row.assigned_vehicle_ids?.length ? row.assigned_vehicle_ids : undefined,
    licenseNumber: row.license_number ?? undefined,
    licenseExpiry: row.license_expiry ?? undefined,
    pdpExpiry: row.pdp_expiry ?? undefined,
    dgCertExpiry: row.dg_cert_expiry ?? undefined,
    medicalExpiry: row.medical_expiry ?? undefined,
    inductionDate: row.induction_date ?? undefined,
    lastRefresherDate: row.last_refresher_date ?? undefined,
    clientId: row.client_id ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    navigationPreferences: (row.navigation_preferences as User['navigationPreferences']) ?? undefined,
});

const fetchUserContext = async (userId: string): Promise<User | null> => {
    const [profileRes, branchesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        // Use `code` (short, e.g. 'FBN JHB') - matches the TS Branch union.
        // See matching comment in RawDataContext hydrateFromSupabase.
        supabase.from('branches').select('id, code'),
    ]);

    if (profileRes.error || !profileRes.data) {
        console.error('AuthContext: failed to load profile', profileRes.error);
        return null;
    }
    if (branchesRes.error || !branchesRes.data) {
        console.error('AuthContext: failed to load branches', branchesRes.error);
        return null;
    }

    const branchById = new Map<string, Branch>(
        branchesRes.data.map(b => [b.id, b.code as Branch])
    );
    return mapProfileRow(profileRes.data, branchById);
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { handleUpdateNavPreferences } = useCommonData();

    const [state, setState] = useState<AuthState>({
        currentUser: null,
        viewingClientAsAdmin: null,
    });
    const [currentViewOverride] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const handleLogin = useCallback(async (email: string, password: string): Promise<LoginResult> => {
        console.log('[login] start');
        // 30s global fetch timeout is enforced inside lib/supabase.ts (single
        // source of truth). The try/catch here turns any thrown error from
        // that timeout - or any other surprise - into a structured LoginResult
        // so Login.tsx re-enables its button instead of leaving the spinner
        // stuck.
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return { ok: false, error: error.message };
            if (!data.user) return { ok: false, error: 'No user returned from sign-in' };
            console.log('[login] signInWithPassword OK, fetching profile');
            const mapped = await fetchUserContext(data.user.id);
            if (!mapped) return { ok: false, error: 'Signed in, but failed to load profile' };
            console.log('[login] profile fetched, setting currentUser');
            setState(prev => ({ ...prev, currentUser: mapped }));
            return { ok: true };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error during sign-in';
            console.error('[login] failed:', err);
            return { ok: false, error: msg };
        }
    }, []);

    const handleLogout = useCallback(() => {
        void supabase.auth.signOut();
        setState({ currentUser: null, viewingClientAsAdmin: null });
    }, []);

    const setViewClientAsAdmin = useCallback((user: User | null) => {
        setState(prev => ({ ...prev, viewingClientAsAdmin: user }));
    }, []);

    const hasPermission = useCallback((permission: Permission) => {
        if (!state.currentUser) return false;
        // Admins implicitly hold every permission. Mirrors the brief's
        // "Admins see all" rule (section 3) and matches RLS behavior server-side.
        // Without this bypass, an Admin/Super Admin whose profiles.permissions
        // array is empty in the DB (which is the current bootstrap state for
        // Marc) gets zero nav items in the Header even though their role
        // should grant full access.
        if (state.currentUser.role === 'Super Admin' || state.currentUser.role === 'Admin') {
            return true;
        }
        return state.currentUser.permissions.includes(permission);
    }, [state.currentUser]);

    const updateNavPreferences = useCallback((prefs: User['navigationPreferences']) => {
        if (state.currentUser) {
            handleUpdateNavPreferences(state.currentUser.email, prefs);
        }
    }, [state.currentUser, handleUpdateNavPreferences]);

    const resetPassword = useCallback(async (email: string): Promise<LoginResult> => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
    }, []);

    useEffect(() => {
        let active = true;
        // One-shot hygiene: drop the mock-auth localStorage key from any prior session
        localStorage.removeItem('currentUserEmail');

        const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!active) return;

            // Both INITIAL_SESSION (page load with stored session) and SIGNED_IN
            // (fresh login) need to hydrate currentUser from profiles. Without
            // SIGNED_IN handling, the only path that sets currentUser on a
            // fresh login was handleLogin's manual setState - if any await in
            // that path stalled, the UI was stuck on Login forever with no
            // fallback. The listener now provides defense-in-depth.
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                if (session?.user) {
                    const mapped = await fetchUserContext(session.user.id);
                    if (active && mapped) {
                        setState(prev => ({ ...prev, currentUser: mapped }));
                    }
                }
                if (active && event === 'INITIAL_SESSION') setIsAuthReady(true);
                return;
            }

            if (event === 'SIGNED_OUT') {
                setState({ currentUser: null, viewingClientAsAdmin: null });
            }
        });

        return () => {
            active = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    const value = useMemo(() => ({
        ...state,
        handleLogin,
        handleLogout,
        hasPermission,
        setViewClientAsAdmin,
        currentViewOverride,
        updateNavPreferences,
        resetPassword,
        isAuthReady,
    }), [state, handleLogin, handleLogout, hasPermission, setViewClientAsAdmin, currentViewOverride, updateNavPreferences, resetPassword, isAuthReady]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
