// Browser-side geocoding via the Google Maps JS API (google.maps.Geocoder).
// This works with the app's referer-restricted key because it runs in the
// browser — unlike the REST Geocoding API, which the key can't use server-side.
// Returns the best lat/lng for a free-text address, or null if it can't resolve.
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    const g = (window as any).google;
    if (!g?.maps?.Geocoder || !address || !address.trim()) return null;
    try {
        const geocoder = new g.maps.Geocoder();
        return await new Promise((resolve) => {
            geocoder.geocode({ address, componentRestrictions: { country: 'za' } }, (results: any, status: string) => {
                const loc = results?.[0]?.geometry?.location;
                if (status === 'OK' && loc) resolve({ lat: loc.lat(), lng: loc.lng() });
                else resolve(null);
            });
        });
    } catch { return null; }
}
