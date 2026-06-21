// FBN Transport brand — single source of truth for colours and fonts.
// Reuse these instead of hardcoding hex values. (Basis for the brand bible.)
export const BRAND = {
    navy: '#13294b',   // primary — headers, dark surfaces
    gold: '#f5b700',   // accent — highlights, the brand stripe
    green: '#16a34a',  // success / accept / booked
    red: '#dc2626',    // error / decline
    blue: '#1d4ed8',   // interactive accent (brand-secondary)
    blueDark: '#1e40af', // brand-primary
    ink: '#1e293b',    // body text
    muted: '#64748b',  // secondary text
    border: '#e2e8f0',
    bg: '#f1f5f9',
} as const;

export const FONTS = {
    heading: "'Barlow Condensed', sans-serif", // bold condensed display / headings
    body: "'Barlow', sans-serif",              // body copy
} as const;
