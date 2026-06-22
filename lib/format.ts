// Shared display formatters — one source of truth so dates, times and money look
// the same on every Operations/Broking screen. Import these instead of
// hand-rolling per-component formatters.

const D = (s?: string | null): Date | null => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};

// R 1 234.56
export const money = (n?: number | string | null): string =>
    'R ' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 12 Jun 2026
export const fmtDate = (s?: string | null): string => {
    const d = D(s); return d ? d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : (s ? String(s) : '—');
};
// 12 Jun (no year — for dense tables)
export const fmtDay = (s?: string | null): string => {
    const d = D(s); return d ? d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) : (s ? String(s) : '—');
};
// 12 Jun 14:30
export const fmtDateTime = (s?: string | null): string => {
    const d = D(s); return d ? d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (s ? String(s) : '—');
};

// True when BOTH dates are strictly before today — i.e. the load is being entered
// after the fact (it will be created as already Delivered). Used to confirm with
// the user so a date typo doesn't silently mark a load delivered.
export const bothDatesPast = (collectionDate?: string | null, deliveryDate?: string | null): boolean => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const past = (s?: string | null) => { const d = D(s); return !!d && d < t; };
    return past(collectionDate) && past(deliveryDate);
};
