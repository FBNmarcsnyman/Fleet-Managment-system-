import { directSelect, directUpdate } from './supabase';

// Curated pick-lists. The app's route / commodity / packaging / load-type
// suggestions are LEARNED from past loads, so junk accumulates. Admins curate
// here: HIDE bad values + add approved EXTRA ones. Stored in
// email_settings.managed_lists as { [key]: { hidden: string[], extra: string[] } }.
export type ManagedKey = 'route' | 'commodity' | 'packaging' | 'loadType';
export interface ManagedEntry { hidden: string[]; extra: string[] }
export type ManagedLists = Partial<Record<ManagedKey, ManagedEntry>>;

let cache: ManagedLists | null = null;

export async function fetchManagedLists(force = false): Promise<ManagedLists> {
    if (cache && !force) return cache;
    try {
        const { data } = await directSelect('email_settings?id=eq.1&select=managed_lists');
        cache = (Array.isArray(data) ? data[0]?.managed_lists : (data as any)?.managed_lists) || {};
    } catch { cache = {}; }
    return cache!;
}

export async function saveManagedList(key: ManagedKey, entry: ManagedEntry): Promise<{ ok: boolean; error?: string }> {
    const current = await fetchManagedLists(true);
    const next = { ...current, [key]: { hidden: entry.hidden || [], extra: entry.extra || [] } };
    const res: any = await directUpdate('email_settings', { id: '1' }, { managed_lists: next });
    if (res?.error) return { ok: false, error: res.error.message };
    cache = next;
    return { ok: true };
}

const norm = (s: string) => (s || '').trim().toLowerCase();
// Apply curation to a learned list: drop hidden, prepend approved extras, dedupe.
export function applyManaged(values: string[], entry?: ManagedEntry): string[] {
    const hidden = new Set((entry?.hidden || []).map(norm));
    const seen = new Set<string>();
    const out: string[] = [];
    [...(entry?.extra || []), ...values].forEach(v => {
        const n = norm(v);
        if (!v || hidden.has(n) || seen.has(n)) return;
        seen.add(n); out.push(v);
    });
    return out;
}
