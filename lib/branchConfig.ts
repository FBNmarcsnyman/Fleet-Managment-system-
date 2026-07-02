// SINGLE SOURCE OF TRUTH for branch routing — ops email, depot address, and the
// area→branch classifier. Reads the `branches` table (cached) so the values are
// data-driven and editable in Settings. Every getter falls back to the values that
// were hardcoded before this existed, so routing is IDENTICAL if the cache hasn't
// loaded yet — this can never break email routing. (Phase 1 of FBN_EVOLUTION_PLAN.)
import { directSelect } from './supabase';

export type BranchCode = 'FBN JHB' | 'FBN DBN' | 'FBN CPT' | 'LOADMASTER';

const OPS_GENERAL = 'ops@fbn-transport.co.za';
// Fallbacks = the exact values in use before this module (see lib/loadEmails DEPOT_ADDR,
// OperationsContext opsEmail, linehaulDocs opsEmailFor). CPT + Loadmaster → ops@ (Marc).
const FALLBACK_EMAIL: Record<string, string> = {
    'FBN JHB': 'opsjhb@fbn-transport.co.za',
    'FBN DBN': 'opsdbn@fbn-transport.co.za',
};
const FALLBACK_DEPOT: Record<string, string> = {
    'FBN JHB': 'FBN TRANSPORT, 307 KREUPELHOUT STREET, WADEVILLE, GERMISTON',
    'FBN DBN': 'FBN TRANSPORT, 463 SYDNEY ROAD, CONGELLA, DURBAN',
    'FBN CPT': 'FBN TRANSPORT, CAPE TOWN',
};

// Area-specific workshop inbox fallbacks (used until the DB config loads / when unset).
const heuristicWorkshop = (code?: string): string => {
    const c = String(code || '').toUpperCase();
    if (/JHB|JOHAN/.test(c)) return 'workshopjhb@fbn-transport.co.za';
    if (/DBN|DURBAN/.test(c)) return 'workshopdbn@fbn-transport.co.za';
    return 'workshop@fbn-transport.co.za';
};

let cache: Record<string, { email: string; address: string | null; name: string; workshop: string | null }> | null = null;

// Load/refresh the branch config from the DB. Call after login and after edits.
export async function loadBranchConfig(): Promise<void> {
    try {
        const { data } = await directSelect('branches?select=code,name,email,address,workshop_email');
        if (Array.isArray(data)) {
            const m: Record<string, { email: string; address: string | null; name: string; workshop: string | null }> = {};
            data.forEach((b: any) => { if (b.code) m[b.code] = { email: b.email || '', address: b.address ?? null, name: b.name || b.code, workshop: b.workshop_email ?? null }; });
            cache = m;
        }
    } catch { /* keep fallbacks */ }
}
// Best-effort load on first import (fallbacks cover the window before it resolves).
void loadBranchConfig();

/** Ops inbox for a branch — the DB value, else the historical fallback, else ops@. */
export const opsEmailFor = (code?: string): string => {
    const c = String(code || '');
    return (cache?.[c]?.email) || FALLBACK_EMAIL[c] || OPS_GENERAL;
};

/** Depot street address for a branch (empty string if none — caller may add a suffix). */
export const depotAddrFor = (code?: string): string => {
    const c = String(code || '');
    return (cache?.[c]?.address) || FALLBACK_DEPOT[c] || '';
};

/** Area workshop inbox for a branch (DB value, else heuristic by code, else general). */
export const workshopEmailFor = (code?: string): string => {
    const c = String(code || '');
    return (cache?.[c]?.workshop) || heuristicWorkshop(c);
};

/** Classify a free-text place → the FBN branch that owns that area (or null). */
export const classifyArea = (text?: string): BranchCode | null => {
    const t = (text || '').toLowerCase();
    if (/johannesburg|jhb|gauteng|germiston|wadeville|kempton|isando|midrand|pretoria|\bpta\b|boksburg|edenvale|jet park|alberton|roodepoort|sandton|centurion|benoni|brakpan|springs|vereeniging|vanderbijl|krugersdorp|chamdor|nigel|heidelberg/.test(t)) return 'FBN JHB';
    if (/cape town|\bcpt\b|western cape|bellville|paarl|stellenbosch|somerset west|epping|montague|maitland|parow|brackenfell|killarney/.test(t)) return 'FBN CPT';
    if (/durban|\bdbn\b|kzn|kwazulu|pinetown|phoenix|umhlanga|pietermaritzburg|\bpmb\b|mobeni|jacobs|prospecton|congella|westmead|new germany|hammarsdale|cato ridge|richards bay/.test(t)) return 'FBN DBN';
    return null;
};
