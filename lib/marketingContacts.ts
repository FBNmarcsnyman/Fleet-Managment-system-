import { directSelect, directInsert, directUpdate } from './supabase';

// CRM marketing audience (clients / carriers / prospects). Separate from the
// operational client/supplier `contacts` so we can hold people not yet in ops and
// track opt-out per email. Never email opted_out = true.
export interface MarketingContact {
    id: string;
    email: string;
    name?: string;
    company?: string;
    kind: 'prospect' | 'client' | 'carrier';
    tags: string[];
    optedOut: boolean;
    optedOutAt?: string;
    source?: string;
    unsubscribeToken?: string;
}

const map = (r: any): MarketingContact => ({
    id: r.id, email: r.email, name: r.name ?? undefined, company: r.company ?? undefined,
    kind: r.kind || 'prospect', tags: r.tags || [], optedOut: !!r.opted_out, optedOutAt: r.opted_out_at ?? undefined, source: r.source ?? undefined,
    unsubscribeToken: r.unsubscribe_token ?? undefined,
});

// The public self-service link (opt out/in, update details, add colleagues).
export const prefsLink = (c: MarketingContact): string => {
    const origin = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    return `${origin}?prefs=${c.id}&t=${c.unsubscribeToken || ''}`;
};

export async function fetchMarketingContacts(): Promise<MarketingContact[]> {
    const { data } = await directSelect('marketing_contacts?select=*&order=created_at.desc&limit=10000');
    return Array.isArray(data) ? data.map(map) : [];
}

// Bulk add (idempotent on org+email via the unique index — duplicates are ignored).
export async function addMarketingContacts(rows: { email: string; name?: string; company?: string; kind?: string; tags?: string[]; source?: string }[]): Promise<{ ok: boolean; count: number; error?: string }> {
    const seen = new Set<string>();
    const clean = rows
        .map(r => ({ ...r, email: (r.email || '').trim() }))
        .filter(r => /\S+@\S+\.\S+/.test(r.email) && !seen.has(r.email.toLowerCase()) && seen.add(r.email.toLowerCase()))
        .map(r => ({ email: r.email, name: r.name || null, company: r.company || null, kind: r.kind || 'prospect', tags: r.tags || [], source: r.source || 'import' }));
    if (!clean.length) return { ok: false, count: 0, error: 'No valid email addresses found.' };
    // Upsert-ignore on the (org,email) unique index so re-imports don't error.
    const res: any = await directInsert('marketing_contacts?on_conflict=organization_id,email', clean as any);
    if (res?.error && !/duplicate|conflict|409/i.test(res.error.message || '')) return { ok: false, count: 0, error: res.error.message };
    return { ok: true, count: clean.length };
}

export async function setOptOut(id: string, optedOut: boolean): Promise<{ ok: boolean; error?: string }> {
    const res: any = await directUpdate('marketing_contacts', { id }, { opted_out: optedOut, opted_out_at: optedOut ? new Date().toISOString() : null });
    return res?.error ? { ok: false, error: res.error.message } : { ok: true };
}
