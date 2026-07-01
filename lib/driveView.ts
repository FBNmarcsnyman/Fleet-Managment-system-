// Open a private Google Drive file inline via our service-account proxy (drive-view
// edge fn), so staff can VIEW licence discs / compliance docs even though the Drive
// files aren't shared publicly. Non-Drive URLs pass through unchanged.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const isDriveUrl = (u?: string): boolean => !!u && /drive\.google\.com|docs\.google\.com/.test(u);

const extractId = (s?: string): string => {
    const v = String(s || '').trim();
    if (v.includes('/file/d/')) return v.split('/file/d/')[1].split(/[/?]/)[0];
    if (v.includes('/folders/')) return v.split('/folders/')[1].split(/[/?]/)[0];
    if (v.includes('id=')) return v.split('id=')[1].split('&')[0];
    return v;
};

export const driveViewUrl = (u?: string): string => {
    if (!u) return '#';
    return isDriveUrl(u) ? `${BASE}/drive-view?id=${encodeURIComponent(extractId(u))}` : u;
};
