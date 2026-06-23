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

// Normalise a SA phone/cell to +27 international form (handles multiple numbers
// separated by '/'). '0XX…' → '+27XX…', '27…' → '+27…', '+…' kept. Blank → ''.
export const phoneZA = (p?: string | null): string => {
    if (!p || !p.trim()) return '';
    return p.split('/').map(part => {
        const t = part.trim();
        if (!t) return '';
        if (t.startsWith('+')) return t.replace(/\s/g, '');
        const d = t.replace(/\D/g, '');
        if (!d) return '';
        if (d.startsWith('27')) return '+' + d;
        if (d.startsWith('0')) return '+27' + d.slice(1);
        return t.replace(/\s/g, '');
    }).filter(Boolean).join(' / ');
};

// UPPERCASE a text value (names, titles) — emails are NEVER passed through this.
export const upperZA = (s?: string | null): string => (s || '').toUpperCase();

// Normalise a client (or supplier) record the FBN way before saving: UPPERCASE
// name / contact person / each contact's name + title; phones to +27; emails
// left exactly as typed. Returns a shallow-copied, cleaned object.
export const normalizeParty = <T extends { name?: string; contactPerson?: string; contactPhone?: string; contacts?: any[] }>(p: T): T => ({
    ...p,
    name: p.name ? p.name.toUpperCase() : p.name,
    contactPerson: p.contactPerson ? p.contactPerson.toUpperCase() : p.contactPerson,
    contactPhone: p.contactPhone ? phoneZA(p.contactPhone) : p.contactPhone,
    contacts: Array.isArray(p.contacts) ? p.contacts.map(c => ({
        ...c,
        name: c?.name ? String(c.name).toUpperCase() : c?.name,
        title: c?.title ? String(c.title).toUpperCase() : c?.title,
        phone: c?.phone ? phoneZA(c.phone) : c?.phone,
        // email intentionally left as-is
    })) : p.contacts,
});

// True when BOTH dates are strictly before today — i.e. the load is being entered
// after the fact (it will be created as already Delivered). Used to confirm with
// the user so a date typo doesn't silently mark a load delivered.
export const bothDatesPast = (collectionDate?: string | null, deliveryDate?: string | null): boolean => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const past = (s?: string | null) => { const d = D(s); return !!d && d < t; };
    return past(collectionDate) && past(deliveryDate);
};
