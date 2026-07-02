// Browser-side traffic-aware ETA via the Google Maps JS DirectionsService.
// Runs in the browser so it works with the referer-restricted key (the REST
// Directions API is blocked server-side). Given the driver's current position
// and a destination address, returns the driving ETA WITH live traffic.
// See delivery-run-tripsheet-v2 memory (Phase 4).
export interface Eta { minutes: number; km: number; text: string }

export async function etaFromTo(origin: { lat: number; lng: number }, destAddress: string): Promise<Eta | null> {
    const g = (window as any).google;
    if (!g?.maps?.DirectionsService || !destAddress || !destAddress.trim()) return null;
    try {
        const svc = new g.maps.DirectionsService();
        return await new Promise((resolve) => {
            svc.route({
                origin: new g.maps.LatLng(origin.lat, origin.lng),
                destination: destAddress,
                travelMode: g.maps.TravelMode.DRIVING,
                drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' },
            }, (res: any, status: string) => {
                const leg = res?.routes?.[0]?.legs?.[0];
                if (status === 'OK' && leg) {
                    const dur = leg.duration_in_traffic || leg.duration;
                    const minutes = Math.max(0, Math.round((dur?.value || 0) / 60));
                    const km = Math.round(((leg.distance?.value || 0) / 1000) * 10) / 10;
                    resolve({ minutes, km, text: `~${minutes} min (${km} km)` });
                } else resolve(null);
            });
        });
    } catch { return null; }
}
