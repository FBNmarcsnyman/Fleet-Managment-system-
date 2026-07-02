// Browser-side route optimisation via the Google Maps JS DirectionsService
// (optimizeWaypoints). Runs in the browser so it works with the app's
// referer-restricted key — the REST Directions API is blocked server-side
// (same as geocoding). Given a depot origin + each drop's address, it returns
// the drop loadIds in the most efficient visiting order, or null if it can't.
// See delivery-run-tripsheet-v2 memory (Phase 2).
export async function optimiseRoute(
    origin: string,
    stops: { loadId: string; address: string }[],
): Promise<string[] | null> {
    const g = (window as any).google;
    if (!g?.maps?.DirectionsService || !origin || !origin.trim()) return null;
    const withAddr = stops.filter(s => s.address && s.address.trim());
    if (withAddr.length < 2) return null; // nothing to optimise for 0–1 stops
    try {
        const svc = new g.maps.DirectionsService();
        return await new Promise((resolve) => {
            svc.route({
                origin,
                destination: origin, // round trip from the depot — order is what we want
                waypoints: withAddr.map(s => ({ location: s.address, stopover: true })),
                optimizeWaypoints: true,
                travelMode: g.maps.TravelMode.DRIVING,
            }, (res: any, status: string) => {
                const order: number[] | undefined = res?.routes?.[0]?.waypoint_order;
                if (status === 'OK' && Array.isArray(order) && order.length === withAddr.length) {
                    resolve(order.map(i => withAddr[i].loadId));
                } else resolve(null);
            });
        });
    } catch { return null; }
}
