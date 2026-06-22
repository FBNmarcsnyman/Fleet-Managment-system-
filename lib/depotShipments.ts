// LCL depot cargo — the status flow and storage free-time rules, shared by the
// depot status tab, the log modal and (later) the daily client-update emails.

// Full lifecycle for an LCL shipment unpacked at a container depot, from before
// the vessel arrives through inter-depot transfer to final delivery + empty.
export const DEPOT_SHIPMENT_STATUSES = [
    'Waiting for Vessel',
    'Vessel Arrived',
    'Received at Depot',
    'Unpacked',
    'Collection Booked',
    'Collected',
    'Received at FBN DBN',
    'In Transit (Inter-depot)',
    'Received at FBN JHB',
    'Loaded for Delivery',
    'Delivered',
    'Empty Turned In',
] as const;

export type DepotShipmentStatus = typeof DEPOT_SHIPMENT_STATUSES[number];

// Storage free-time is measured in calendar days INCLUSIVE of the unpack day.
// Hazardous cargo gets a much shorter window. A per-shipment free_time_days
// (set when logging, e.g. for a depot with different terms) overrides this.
export const defaultFreeTimeDays = (hazardous?: boolean): number => (hazardous ? 1 : 3);

export const freeTimeDays = (s: any): number => {
    const n = Number(s?.free_time_days);
    return Number.isFinite(n) && n > 0 ? n : defaultFreeTimeDays(s?.hazardous);
};

// Collection deadline = unpack date + (free-time − 1) days (inclusive of the
// unpack day). Falls back to the depot-received date if not yet unpacked.
export const storageDeadline = (s: any): Date | null => {
    const base = s?.unpack_date || s?.received_at_depot_date;
    if (!base) return null;
    const d = new Date(base);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + Math.max(0, freeTimeDays(s) - 1));
    return d;
};

// Whole days until the deadline: 0 = due today, negative = overdue (storage
// charges raised). null when there's no unpack/received date yet.
export const daysToDeadline = (s: any): number | null => {
    const dl = storageDeadline(s);
    if (!dl) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((dl.getTime() - today.getTime()) / 86400000);
};

// The free-time clock only matters once cargo is at/through the depot and not
// yet collected — that's the window in which storage charges accrue.
const DEADLINE_RELEVANT = new Set(['Received at Depot', 'Unpacked', 'Collection Booked']);
export const deadlineRelevant = (s: any): boolean => DEADLINE_RELEVANT.has(s?.status);

// A short human label + tone for the countdown chip.
export const deadlineLabel = (s: any): { text: string; tone: 'ok' | 'warn' | 'over' } | null => {
    if (!deadlineRelevant(s)) return null;
    const d = daysToDeadline(s);
    if (d === null) return null;
    if (d < 0) return { text: `${Math.abs(d)}d overdue`, tone: 'over' };
    if (d === 0) return { text: 'Due today', tone: 'warn' };
    if (d === 1) return { text: '1 day left', tone: 'warn' };
    return { text: `${d} days left`, tone: d <= 2 ? 'warn' : 'ok' };
};
