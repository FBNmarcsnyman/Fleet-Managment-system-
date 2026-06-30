import { directSelect, directInsert, directUpdate, directDelete } from './supabase';

// Configurable storage + handling rate card (per day / per week storage,
// shrinkwrapping, palletising, custom). Applied to stored / handled loads.
export type RateUnit = 'per_day' | 'per_week' | 'per_pallet' | 'per_item' | 'flat';
export interface HandlingRate { id: string; name: string; unit: RateUnit; rate: number; active: boolean; sort: number }

export const UNIT_LABEL: Record<RateUnit, string> = {
    per_day: 'per day', per_week: 'per week', per_pallet: 'per pallet', per_item: 'per item', flat: 'flat',
};

let cache: HandlingRate[] | null = null;
export async function fetchHandlingRates(force = false): Promise<HandlingRate[]> {
    if (cache && !force) return cache;
    const { data } = await directSelect('handling_rates?select=*&order=sort.asc,name.asc');
    cache = (Array.isArray(data) ? data : []).map((r: any) => ({ id: r.id, name: r.name, unit: r.unit, rate: Number(r.rate) || 0, active: r.active !== false, sort: r.sort || 0 }));
    return cache;
}
export async function addHandlingRate(r: { name: string; unit: RateUnit; rate: number; sort?: number }) {
    const res: any = await directInsert('handling_rates', { name: r.name, unit: r.unit, rate: r.rate, sort: r.sort ?? 99 });
    cache = null; return res?.error ? { ok: false, error: res.error.message } : { ok: true };
}
export async function updateHandlingRate(id: string, patch: Partial<HandlingRate>) {
    const row: any = {}; if (patch.name !== undefined) row.name = patch.name; if (patch.unit !== undefined) row.unit = patch.unit; if (patch.rate !== undefined) row.rate = patch.rate; if (patch.active !== undefined) row.active = patch.active;
    const res: any = await directUpdate('handling_rates', { id }, row);
    cache = null; return res?.error ? { ok: false, error: res.error.message } : { ok: true };
}
export async function deleteHandlingRate(id: string) {
    const res: any = await directDelete('handling_rates', { id });
    cache = null; return res?.error ? { ok: false, error: res.error.message } : { ok: true };
}

// Storage accrual: free days, then chargeable days × the chosen storage rate
// (per_day, or per_week billed in whole weeks).
export function computeStorage(storedSince: string | undefined, freeDays: number, rate: HandlingRate | undefined, today = new Date()): { days: number; chargeable: number; amount: number } {
    if (!storedSince || !rate) return { days: 0, chargeable: 0, amount: 0 };
    const start = new Date(storedSince);
    const days = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
    const chargeable = Math.max(0, days - (freeDays || 0));
    const amount = rate.unit === 'per_week' ? Math.ceil(chargeable / 7) * rate.rate : chargeable * rate.rate;
    return { days, chargeable, amount: Math.round(amount * 100) / 100 };
}
