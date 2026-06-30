import { directSelect, directInsert, directUpdate, invokeFn } from './supabase';

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
    bounced?: boolean;
    bounceReason?: string;
}

const map = (r: any): MarketingContact => ({
    id: r.id, email: r.email, name: r.name ?? undefined, company: r.company ?? undefined,
    kind: r.kind || 'prospect', tags: r.tags || [], optedOut: !!r.opted_out, optedOutAt: r.opted_out_at ?? undefined, source: r.source ?? undefined,
    unsubscribeToken: r.unsubscribe_token ?? undefined,
    bounced: !!r.bounced, bounceReason: r.bounce_reason ?? undefined,
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

// Pull contacts straight from a shared Google Sheet link (server-side, no CORS).
// Returns parsed rows; the caller assigns kind/tag then calls addMarketingContacts.
export async function importFromSheet(url: string): Promise<{ ok: boolean; rows: { email: string; name?: string; company?: string }[]; error?: string }> {
    try {
        const { data, error } = await invokeFn('import-marketing-sheet', { body: { url } });
        if (error) return { ok: false, rows: [], error: error.message || String(error) };
        const d: any = data;
        if (!d?.ok) return { ok: false, rows: [], error: d?.error || 'Could not read the sheet.' };
        return { ok: true, rows: Array.isArray(d.rows) ? d.rows : [] };
    } catch (e: any) {
        return { ok: false, rows: [], error: e?.message || String(e) };
    }
}

// Client-side CSV parse (for a file upload) — same column inference as the sheet importer.
export function parseCsvContacts(text: string): { email: string; name?: string; company?: string }[] {
    const emailRe = /\S+@\S+\.\S+/;
    const table: string[][] = [];
    let row: string[] = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch; }
        else if (ch === '"') inQ = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); table.push(row); row = []; cell = ''; }
        else if (ch === '\r') { /* skip */ }
        else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); table.push(row); }
    const rows = table.filter(r => r.some(c => c.trim()));
    const seen = new Set<string>();
    const out: { email: string; name?: string; company?: string }[] = [];
    for (const r of rows) {
        const email = (r.find(c => emailRe.test(c)) || '').trim();
        if (!email || seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());
        const rest = r.filter(c => c.trim() && !emailRe.test(c)).map(c => c.trim());
        out.push({ email, name: rest[0] || undefined, company: rest[1] || undefined });
    }
    return out;
}

export async function setOptOut(id: string, optedOut: boolean): Promise<{ ok: boolean; error?: string }> {
    const res: any = await directUpdate('marketing_contacts', { id }, { opted_out: optedOut, opted_out_at: optedOut ? new Date().toISOString() : null });
    return res?.error ? { ok: false, error: res.error.message } : { ok: true };
}

// Flag / clear a bounced (invalid mailbox) contact — kept on file, excluded from sends.
export async function setBounced(id: string, bounced: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
    const res: any = await directUpdate('marketing_contacts', { id }, { bounced, bounced_at: bounced ? new Date().toISOString() : null, bounce_reason: bounced ? (reason || 'Marked invalid') : null });
    return res?.error ? { ok: false, error: res.error.message } : { ok: true };
}
