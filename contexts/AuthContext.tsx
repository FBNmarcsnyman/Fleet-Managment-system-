import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { User, Permission, Branch } from '../types';
import { useCommonData } from './CommonDataContext';
import { supabase, directSelect, directUpdate } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  currentUser: User | null;
  viewingClientAsAdmin: User | null;
  viewingSupplierAsAdmin: User | null;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthContextType extends AuthState {
  handleLogin: (email: string, password: string) => Promise<LoginResult>;
  signInWithGoogle: () => Promise<LoginResult>;
  handleLogout: () => void;
  hasPermission: (permission: Permission) => boolean;
  setViewClientAsAdmin: (user: User | null) => void;
  setViewSupplierAsAdmin: (user: User | null) => void;
  currentViewOverride: string | null;
  updateNavPreferences: (prefs: User['navigationPreferences']) => void;
  resetPassword: (email: string) => Promise<LoginResult>;
  isAuthReady: boolean;
  // Admin-set tabs hidden, keyed `${role}|${branch}` (branch ''=whole role). For the editor.
  roleHiddenTabs: Record<string, string[]>;
  // The current user's effective hidden tabs (role baseline ∪ their depot). For filtering.
  myHiddenTabs: string[];
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
    isActive: (row as { is_active?: boolean }).is_active ?? true,
});

const fetchUserContext = async (userId: string): Promise<User | null> => {
    // Use directSelect (plain fetch + token from storage), NOT supabase.from():
    // when this runs inside the onAuthStateChange callback (the only path that
    // loads the profile after a Google OAuth redirect), the supabase-js client
    // is mid-operation and supabase.from() wedges on its internal lock - the
    // fetch never completes, the 10s timeout fires, currentUser stays null and
    // the user is bounced back to the login screen even though they ARE signed
    // in. directSelect bypasses that lock entirely. Same reason the rest of the
    // app uses the direct-* helpers for writes.
    const [profileRes, branchesRes] = await Promise.all([
        directSelect(`profiles?select=*&id=eq.${userId}`),
        // Use `code` (short, e.g. 'FBN JHB') - matches the TS Branch union.
        // See matching comment in RawDataContext hydrateFromSupabase.
        directSelect('branches?select=id,code'),
    ]);

    const profileRow = Array.isArray(profileRes.data) ? profileRes.data[0] : null;
    if (profileRes.error || !profileRow) {
        console.error('AuthContext: failed to load profile', profileRes.error);
        return null;
    }
    const branchRows: Array<{ id: string; code: string }> = Array.isArray(branchesRes.data) ? branchesRes.data : [];

    const branchById = new Map<string, Branch>(
        branchRows.map(b => [b.id, b.code as Branch])
    );
    return mapProfileRow(profileRow as ProfileRow, branchById);
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { handleUpdateNavPreferences } = useCommonData();

    const [state, setState] = useState<AuthState>({
        currentUser: null,
        viewingClientAsAdmin: null,
        viewingSupplierAsAdmin: null,
    });
    const [currentViewOverride] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    // The role → visible-modules matrix (editable in Users → Role Access).
    // Used by hasPermission so a role's default visibility can be changed without
    // a code deploy. A user's OWN permissions list (if set) overrides the role.
    const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
    useEffect(() => {
        let active = true;
        const load = async () => {
            const { data } = await directSelect('role_permissions?select=role,permissions');
            if (active && Array.isArray(data)) {
                const map: Record<string, string[]> = {};
                data.forEach((r: any) => { map[r.role] = Array.isArray(r.permissions) ? r.permissions : []; });
                setRolePermissions(map);
            }
        };
        load();
        // Refresh when the matrix is edited elsewhere in the app.
        const onChange = () => load();
        window.addEventListener('role-permissions-changed', onChange);
        return () => { active = false; window.removeEventListener('role-permissions-changed', onChange); };
    }, []);
    // Admin-set tabs hidden per role + branch (server-stored). Keyed `${role}|${branch}`
    // where branch '' = whole role, 'DBN'/'JHB'/'CPT' = that depot. Super/Admin see all.
    const [roleHiddenTabs, setRoleHiddenTabs] = useState<Record<string, string[]>>({});
    useEffect(() => {
        let active = true;
        const load = async () => {
            const { data } = await directSelect('role_tab_visibility?select=role,branch,hidden');
            if (active && Array.isArray(data)) {
                const map: Record<string, string[]> = {};
                data.forEach((r: any) => { map[`${r.role}|${r.branch || ''}`] = Array.isArray(r.hidden) ? r.hidden : []; });
                setRoleHiddenTabs(map);
            }
        };
        load();
        const onChange = () => load();
        window.addEventListener('role-tabs-changed', onChange);
        return () => { active = false; window.removeEventListener('role-tabs-changed', onChange); };
    }, []);
    // The current user's effective hidden tabs: role baseline (branch '') ∪ their depot's set.
    const myHiddenTabs = useMemo(() => {
        const u = state.currentUser;
        if (!u || ['Admin', 'Super Admin'].includes(u.role as string)) return [] as string[];
        const code = (u.assignedBranches || []).map(b => /DBN|DURBAN/i.test(b) ? 'DBN' : /JHB|JOHAN/i.test(b) ? 'JHB' : /CPT|CAPE/i.test(b) ? 'CPT' : '').find(Boolean) || '';
        return Array.from(new Set([...(roleHiddenTabs[`${u.role}|`] || []), ...(code ? (roleHiddenTabs[`${u.role}|${code}`] || []) : [])]));
    }, [roleHiddenTabs, state.currentUser]);
    // Distinguishes "user clicked Logout" (intentional) from "session expired
    // in the background" (implicit). The latter happens after Marc leaves the
    // tab idle for an hour+; the supabase-js client and the JS tab context
    // can end up in a wedged state where the next signInWithPassword hangs.
    // We force a hard reload after implicit signout to get a clean slate.
    const intentionalLogoutRef = useRef(false);
    // Mirror of state.currentUser, readable inside the onAuthStateChange
    // listener closure (which only captures state once at mount). Used by
    // the SIGNED_IN fallback to decide whether handleLogin already loaded
    // the profile.
    const currentUserRef = useRef<User | null>(state.currentUser);
    currentUserRef.current = state.currentUser;

    const handleLogin = useCallback(async (email: string, password: string): Promise<LoginResult> => {
        console.log('[login] start');
        // 30s global fetch timeout is enforced inside lib/supabase.ts (single
        // source of truth). The try/catch here turns any thrown error from
        // that timeout - or any other surprise - into a structured LoginResult
        // so Login.tsx re-enables its button instead of leaving the spinner
        // stuck.
        try {
            // Defensive storage nuke: when the supabase-js auth client is
            // wedged (e.g. INITIAL_SESSION hydration hung on a stale token),
            // its internal serialization lock makes every subsequent auth
            // call - INCLUDING signOut - queue behind the original hung
            // promise forever. Awaiting signOut here would itself hang.
            //
            // Instead, we synchronously strip the sb-<project>-auth-token*
            // entries straight out of localStorage. Supabase-js re-reads
            // storage on its next auth call; with nothing there it treats
            // the user as unauthenticated and signInWithPassword proceeds
            // against a clean slate. No await needed = no lock to wait on.
            console.log('[login] clearing any cached supabase auth storage');
            try {
                const keysToDrop: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('sb-') || k.includes('supabase'))) keysToDrop.push(k);
                }
                for (const k of keysToDrop) localStorage.removeItem(k);
                console.log('[login] cleared', keysToDrop.length, 'auth keys');
            } catch (e) {
                console.warn('[login] storage clear threw (ok to ignore):', e);
            }

            // Race signInWithPassword against a 15s ceiling. The global
            // fetch timeout (30s) only fires once the request reaches the
            // network layer; if supabase-js queues this call behind a
            // wedged auth lock, it never reaches fetch and the global
            // timeout never trips. This ceiling guarantees the spinner
            // clears so Marc gets a clear error and a chance to retry.
            type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
            const signInPromise = supabase.auth.signInWithPassword({ email, password });
            const timeoutPromise = new Promise<SignInResult>(resolve =>
                setTimeout(() => resolve({
                    data: { user: null, session: null },
                    error: { name: 'TimeoutError', message: 'Sign-in did not respond within 15s. Refresh the page (Ctrl+F5) and try again.' } as any,
                } as SignInResult), 15000),
            );
            const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
            if (error) return { ok: false, error: error.message };
            if (!data.user) return { ok: false, error: 'No user returned from sign-in' };
            console.log('[login] signInWithPassword OK, fetching profile');
            const mapped = await fetchUserContext(data.user.id);
            if (!mapped) return { ok: false, error: 'Signed in, but failed to load profile' };
            if (mapped.isActive === false) {
                void supabase.auth.signOut();
                return { ok: false, error: 'Your account has been deactivated. Please contact your administrator.' };
            }
            console.log('[login] profile fetched, setting currentUser');
            setState(prev => ({ ...prev, currentUser: mapped }));
            return { ok: true };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error during sign-in';
            console.error('[login] failed:', err);
            return { ok: false, error: msg };
        }
    }, []);

    const signInWithGoogle = useCallback(async (): Promise<LoginResult> => {
        // One-click sign-in with the staff member's FBN Google Workspace account.
        // We hint Google to the company domain (hd) and force the account chooser
        // so people on a personal+work Google don't get logged in as the wrong one.
        // On success Google redirects back to this app; supabase-js (detectSessionInUrl)
        // picks up the session and the onAuthStateChange listener loads the profile.
        try {
            // Clear any wedged auth storage first (same defensive nuke as handleLogin).
            try {
                const drop: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('sb-') || k.includes('supabase'))) drop.push(k);
                }
                for (const k of drop) localStorage.removeItem(k);
            } catch { /* ignore */ }
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}${window.location.pathname}`,
                    queryParams: { hd: 'fbn-transport.co.za', prompt: 'select_account' },
                },
            });
            if (error) return { ok: false, error: error.message };
            // Browser is now redirecting to Google; this promise effectively never
            // resolves further. Return ok so the button shows a spinner.
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : 'Google sign-in failed' };
        }
    }, []);

    const handleLogout = useCallback(() => {
        intentionalLogoutRef.current = true;
        void supabase.auth.signOut();
        setState({ currentUser: null, viewingClientAsAdmin: null, viewingSupplierAsAdmin: null });
    }, []);

    // Only one impersonation at a time — choosing a client clears any supplier view and vice-versa.
    const setViewClientAsAdmin = useCallback((user: User | null) => {
        setState(prev => ({ ...prev, viewingClientAsAdmin: user, viewingSupplierAsAdmin: null }));
    }, []);
    const setViewSupplierAsAdmin = useCallback((user: User | null) => {
        setState(prev => ({ ...prev, viewingSupplierAsAdmin: user, viewingClientAsAdmin: null }));
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
        // A user's OWN permissions list (per-user override) wins if set; otherwise
        // fall back to the role's default visibility from the matrix.
        const own = state.currentUser.permissions || [];
        const effective = own.length ? own : (rolePermissions[state.currentUser.role] || []);
        return effective.includes(permission);
    }, [state.currentUser, rolePermissions]);

    const updateNavPreferences = useCallback((prefs: User['navigationPreferences']) => {
        if (!state.currentUser) return;
        // Update local state FIRST so the tabs visibly reorder/hide immediately
        // (the old code only wrote to the DB, so nothing moved on screen). The
        // DB write is freeze-proof and persists it for next login.
        setState(prev => prev.currentUser ? { ...prev, currentUser: { ...prev.currentUser, navigationPreferences: prefs } } : prev);
        const id = state.currentUser.id;
        void directUpdate('profiles', { id }, { navigation_preferences: prefs as any })
            .then(({ error }) => { if (error) console.error('[auth] save nav prefs failed:', error); });
        // Keep the legacy path too (no-op if it also writes; harmless).
        handleUpdateNavPreferences(state.currentUser.email, prefs);
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

        // Hard fallback: if INITIAL_SESSION never fires (extremely wedged
        // client), force isAuthReady true after 12s so the login form is
        // always usable as a recovery path.
        const readyFallback = setTimeout(() => {
            if (active) {
                console.warn('[auth] INITIAL_SESSION fallback fired - flipping isAuthReady');
                setIsAuthReady(true);
            }
        }, 12000);

        const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!active) return;

            // OAuth landing: Google redirects back to "...?code=<pkce>". supabase-js
            // exchanges that code for a session DURING client init, and emits this
            // event while still mid-exchange - so any supabase.from() that runs now
            // (the profile fetch AND the full RawDataContext data hydrate) wedges on
            // the auth lock, leaving the app signed-in but with empty lists. The
            // session is already persisted to storage at this point, so the clean
            // fix is one automatic reload to a code-free URL: the next load starts
            // fresh (no in-flight exchange holding the lock) and hydrates normally,
            // exactly like a manual Ctrl+F5. Runs once - after reload there's no code.
            if (session?.user && /[?&](code|error)=/.test(window.location.search)) {
                const u = new URL(window.location.href);
                ['code', 'state', 'error', 'error_description'].forEach(p => u.searchParams.delete(p));
                window.location.replace(u.origin + u.pathname + (u.search ? u.search : '') + u.hash);
                return;
            }

            // INITIAL_SESSION is the page-load path: hydrate currentUser
            // from the stored session if one exists. SIGNED_IN is handled
            // explicitly by handleLogin (it sets currentUser there) so we
            // SKIP it here - running a duplicate fetchUserContext on
            // SIGNED_IN was racing handleLogin and wedging the supabase-js
            // auth lock, which then caused subsequent calls (including the
            // RawDataContext hydrate) to hang. defense-in-depth: if the
            // listener fires SIGNED_IN and we somehow have no currentUser
            // yet (handleLogin not on the stack), still hydrate as a
            // fallback.
            if (event === 'INITIAL_SESSION') {
                if (session?.user) {
                    const mapped = await Promise.race<User | null>([
                        fetchUserContext(session.user.id),
                        new Promise<null>(resolve => setTimeout(() => {
                            console.warn('[auth] profile fetch timed out during', event);
                            resolve(null);
                        }, 10000)),
                    ]);
                    if (active && mapped) {
                        if (mapped.isActive === false) {
                            void supabase.auth.signOut();
                        } else {
                            setState(prev => ({ ...prev, currentUser: mapped }));
                        }
                    }
                }
                if (active) setIsAuthReady(true);
                return;
            }

            if (event === 'SIGNED_IN') {
                // handleLogin already covers the fresh-login case. If we got
                // here without a currentUser (e.g. a token refresh emitted
                // SIGNED_IN), fetch the profile as a fallback. Skip otherwise
                // to avoid duplicate calls wedging the auth lock.
                if (session?.user && !currentUserRef.current) {
                    const mapped = await fetchUserContext(session.user.id);
                    if (active && mapped) {
                        if (mapped.isActive === false) {
                            void supabase.auth.signOut();
                        } else {
                            setState(prev => ({ ...prev, currentUser: mapped }));
                        }
                    }
                }
                return;
            }

            if (event === 'SIGNED_OUT') {
                // Just drop to the Login form via state — NO hard reload. The old
                // code force-reloaded the page on any signout to dodge a
                // next-login hang, but that also blew away whatever you were
                // working on (a half-filled LoadCon) the instant a background
                // token check hiccuped. The actual login-hang cause (the
                // supabase-js auth lock) is fixed by the noop lock in
                // lib/supabase.ts, so the reload is no longer needed.
                setState({ currentUser: null, viewingClientAsAdmin: null, viewingSupplierAsAdmin: null });
                intentionalLogoutRef.current = false;
            }
        });

        return () => {
            active = false;
            clearTimeout(readyFallback);
            sub.subscription.unsubscribe();
        };
    }, []);

    const value = useMemo(() => ({
        ...state,
        handleLogin,
        signInWithGoogle,
        handleLogout,
        hasPermission,
        setViewClientAsAdmin,
        setViewSupplierAsAdmin,
        currentViewOverride,
        updateNavPreferences,
        resetPassword,
        isAuthReady,
        roleHiddenTabs,
        myHiddenTabs,
    }), [state, handleLogin, signInWithGoogle, handleLogout, hasPermission, setViewClientAsAdmin, setViewSupplierAsAdmin, currentViewOverride, updateNavPreferences, resetPassword, isAuthReady, roleHiddenTabs, myHiddenTabs]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
