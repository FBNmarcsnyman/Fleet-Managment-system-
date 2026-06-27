import { Supplier } from '../types';

// Carrier eligibility for routing / assignment / offers.
//
// Decision (2026-06-27): the working "approved" gate is **isVetted**. The data
// reality is that `complianceStatus` is unmaintained — it defaults to 'Pending'
// and nothing ever sets it to 'Compliant' (0 carriers are Compliant), while 39 of
// 47 carriers ARE vetted. So gating on compliance would empty every picker. We
// therefore steer on VETTED: vetted carriers are offered first and non-vetted ones
// are shown but flagged (never hard-blocked, so ops is never stuck). complianceStatus
// is kept as secondary info and only surfaced when it's been set to 'Expired'.

export const isCarrierActive = (s: Supplier): boolean => s.type === 'Transport' && s.isActive !== false;

export const isCarrierVetted = (s: Supplier): boolean => isCarrierActive(s) && !!s.isVetted;

// Eligible = active + vetted. (Kept as a named export for routing/quoting callers.)
export const isEligibleCarrier = isCarrierVetted;

// Active transport carriers, optionally only vetted, sorted vetted-first then name.
export const eligibleCarriers = (
    suppliers: Supplier[] = [],
    opts: { vettedOnly?: boolean } = {},
): Supplier[] => {
    const list = (suppliers || []).filter(isCarrierActive);
    const filtered = opts.vettedOnly ? list.filter(s => !!s.isVetted) : list;
    return [...filtered].sort(
        (a, b) => (Number(!!b.isVetted) - Number(!!a.isVetted)) || (a.name || '').localeCompare(b.name || ''),
    );
};

// Dropdown label: name + a ⚠ marker when the carrier isn't vetted (or compliance expired).
export const carrierOptionLabel = (s: Supplier): string => {
    const flags: string[] = [];
    if (!s.isVetted) flags.push('⚠ not vetted');
    if (s.complianceStatus === 'Expired') flags.push('compliance expired');
    return flags.length ? `${s.name} — ${flags.join(', ')}` : s.name;
};

// Warning to show when a non-eligible carrier is selected (null = all good).
export const carrierWarning = (s?: Supplier | null): string | null => {
    if (!s) return null;
    if (!s.isVetted) return `${s.name} is not vetted yet. You can still use them — the load will be flagged to management to chase vetting/paperwork.`;
    if (s.complianceStatus === 'Expired') return `${s.name}'s compliance is marked Expired — verify their GIT / paperwork before dispatch.`;
    return null;
};
