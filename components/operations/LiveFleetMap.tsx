import React, { useRef, useEffect, useState } from 'react';
import { User, LoadConfirmation } from '../../types';
import { supabase, directSelect, directUpdate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AppContexts';

declare global {
    interface Window {
        google: any;
    }
}

interface LiveFleetMapProps {
    vehicles?: any[];
    users?: User[];
    loadConfirmations?: LoadConfirmation[];
}

// A live position from the Pulsit (MST Track) feed via the `track` edge function.
interface LivePos {
    reg: string; desc: string; fleet: string; lat: number; lng: number;
    speed: number; heading: string; ignition: number; address: string;
    event: string; at: string; driver: string | null;
}

const JHB_COORDS = { lat: -26.2041, lng: 28.0473 };
const MAP_ZOOM = 6;
const REFRESH_MS = 30000;
const alnum = (s?: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fmtTime = (s?: string) => { if (!s) return ''; const d = new Date(s); return isNaN(d.getTime()) ? '' : d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

// Decide whether a tracked unit is a "truck" (big asset) or a "car"/bakkie (small),
// from its fleet category or the tracker description. Default to truck (the fleet is
// mostly trucks).
const assetKind = (hint?: string): 'truck' | 'car' => {
    const s = (hint || '').toUpperCase();
    // Only bakkies / cars / light passenger-type vehicles render as cars; everything
    // else (tonners, rigids, horses) is a truck.
    if (/BAKKIE|HILUX|RANGER|TRITON|AMAROK|D-?MAX|NP\s?200|POLO|SEDAN|\bCAR\b|LDV|KOMBI|\bVAN\b|CADDY|CARAVAN/.test(s)) return 'car';
    return 'truck';
};
// Side-on SVG icons, coloured by status, as a marker image (data URI). Deliberately
// distinct silhouettes: a long boxy LORRY for trucks, a low rounded CAR for bakkies/cars.
const truckSvg = (c: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='26' viewBox='0 0 32 18'><g fill='${c}' stroke='white' stroke-width='0.9' stroke-linejoin='round'><rect x='1' y='2' width='18' height='11' rx='1'/><path d='M19 5h6l5 5v3H19z'/><circle cx='8' cy='14.5' r='2.6'/><circle cx='24' cy='14.5' r='2.6'/></g><g fill='white'><circle cx='8' cy='14.5' r='1.1'/><circle cx='24' cy='14.5' r='1.1'/></g></svg>`;
const carSvg = (c: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='18' viewBox='0 0 24 15'><g fill='${c}' stroke='white' stroke-width='0.9' stroke-linejoin='round'><path d='M1 10c0-1.4 1-2 2-2l2.5-3.2C6 4 6.7 3.6 7.6 3.6h6.8c.9 0 1.7.4 2.2 1.1L19 8c1.6.1 2.8.8 2.8 2.2V11H1z'/><circle cx='7' cy='11.5' r='2.3'/><circle cx='16' cy='11.5' r='2.3'/></g><g fill='white'><circle cx='7' cy='11.5' r='1'/><circle cx='16' cy='11.5' r='1'/></g></svg>`;
const iconUri = (kind: 'truck' | 'car', colour: string) => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent((kind === 'car' ? carSvg : truckSvg)(colour));

// Live fleet map: real truck positions from Pulsit, refreshed every 30s. Each
// marker is green (moving), amber (stopped, ignition on) or slate (ignition off).
// Clicking shows the reg, address, speed, last-seen and any active load on that truck.
const LiveFleetMap: React.FC<LiveFleetMapProps> = ({ vehicles = [], users = [], loadConfirmations = [] }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [isApiLoaded, setIsApiLoaded] = useState(!!window.google?.maps?.Map);
    const [positions, setPositions] = useState<LivePos[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const { currentUser } = useAuth();
    const isAdmin = ['Admin', 'Super Admin'].includes(currentUser?.role as string);
    // Regs an admin has chosen to hide from the map (covers tracked units that aren't
    // in the fleet register). Stored server-side on email_settings.map_hidden_regs.
    // The exact reg strings the admin chose to hide (stored server-side). hiddenSet
    // is the normalised lookup used while plotting. NOTHING is hidden by default.
    const [hiddenList, setHiddenList] = useState<string[]>([]);
    const [carList, setCarList] = useState<string[]>([]); // regs forced to the CAR icon
    const [manageOpen, setManageOpen] = useState(false);
    const hiddenSet = React.useMemo(() => new Set(hiddenList.map(r => alnum(r))), [hiddenList]);
    const carSet = React.useMemo(() => new Set(carList.map(r => alnum(r))), [carList]);
    const loadHidden = async () => {
        try {
            const { data } = await directSelect('email_settings?id=eq.1&select=map_hidden_regs,map_car_regs');
            const row = Array.isArray(data) ? data[0] : data;
            setHiddenList((row?.map_hidden_regs as string[]) || []);
            setCarList((row?.map_car_regs as string[]) || []);
        } catch { /* ignore */ }
    };
    useEffect(() => { loadHidden(); }, []);
    // Hide / show a registration on the map (admin only). Persisted to email_settings.
    const setRegHidden = async (reg: string, hidden: boolean) => {
        if (!reg) return;
        const next = hidden
            ? Array.from(new Set([...hiddenList, reg]))
            : hiddenList.filter(r => alnum(r) !== alnum(reg));
        setHiddenList(next);
        try { await directUpdate('email_settings', { id: '1' }, { map_hidden_regs: next }); } catch { /* non-blocking */ }
    };
    // Force a registration's map icon to car (true) or back to auto/truck (false).
    const setRegCar = async (reg: string, isCar: boolean) => {
        if (!reg) return;
        const next = isCar
            ? Array.from(new Set([...carList, reg]))
            : carList.filter(r => alnum(r) !== alnum(reg));
        setCarList(next);
        try { await directUpdate('email_settings', { id: '1' }, { map_car_regs: next }); } catch { /* non-blocking */ }
    };
    // Bridge for the map InfoWindow "Hide from map" button (plain HTML → React).
    useEffect(() => {
        (window as any).__fbnMapHide = (reg: string) => setRegHidden(reg, true);
        return () => { try { delete (window as any).__fbnMapHide; } catch { /* */ } };
    }, [hiddenList]);

    // Poll the live feed.
    useEffect(() => {
        let active = true;
        const pull = async () => {
            try {
                const { data, error } = await supabase.functions.invoke('track', { body: { action: 'feed' } });
                if (!active) return;
                if (error || (data as any)?.error) { setErr((data as any)?.error || error?.message || 'Tracking unavailable.'); }
                else { setPositions(((data as any)?.vehicles || []) as LivePos[]); setErr(null); setUpdatedAt(new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })); }
            } catch (e) { if (active) setErr(e instanceof Error ? e.message : 'Tracking unavailable.'); }
            finally { if (active) setLoading(false); }
        };
        pull();
        const t = setInterval(pull, REFRESH_MS);
        return () => { active = false; clearInterval(t); };
    }, []);

    // Wait for the Google Maps core script (loaded in index.html). We use the
    // CLASSIC google.maps.Marker (no Cloud Map ID needed) so markers always render.
    useEffect(() => {
        if (isApiLoaded) return;
        const handle = () => { if (window.google?.maps?.Map) setIsApiLoaded(true); };
        window.addEventListener('google-maps-api-loaded', handle);
        const interval = setInterval(() => { if (window.google?.maps?.Map) { setIsApiLoaded(true); clearInterval(interval); } }, 500);
        return () => { window.removeEventListener('google-maps-api-loaded', handle); clearInterval(interval); };
    }, [isApiLoaded]);

    useEffect(() => {
        if (isApiLoaded && mapRef.current && !mapInstanceRef.current) {
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center: JHB_COORDS, zoom: MAP_ZOOM, disableDefaultUI: true, zoomControl: true,
            });
        }
    }, [isApiLoaded]);

    // Match a tracked reg to a fleet vehicle (for asset size + to drop hidden ones).
    const vehByReg = React.useMemo(() => {
        const m = new Map<string, any>();
        (vehicles as any[]).forEach(v => { if (v.registration) m.set(alnum(v.registration), v); });
        return m;
    }, [vehicles]);

    // Render / refresh the markers whenever positions change.
    useEffect(() => {
        if (!mapInstanceRef.current || !isApiLoaded || !window.google?.maps?.Map) return;
        markersRef.current.forEach(m => { try { m.setMap(null); } catch { /* */ } });
        markersRef.current = [];
        const bounds = new window.google.maps.LatLngBounds();

        positions.forEach(p => {
            if (p.lat == null || p.lng == null) return;
            const veh = vehByReg.get(alnum(p.reg));
            if (veh?.hidden) return; // management-hidden (personal) fleet vehicles never plot
            if (hiddenSet.has(alnum(p.reg))) return; // an admin chose to hide this reg from the map
            const job = (loadConfirmations || []).find(lc =>
                alnum(lc.subcontractorVehicleReg) === alnum(p.reg) &&
                !['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'].includes(lc.status));
            const driver = p.driver || (job?.subcontractorDriverName) || '';
            const moving = (p.speed || 0) > 5;
            const colour = moving ? '#10B981' : p.ignition ? '#F59E0B' : '#64748B';
            const info = new window.google.maps.InfoWindow({
                content: `<div style="color:#0f172a;font-family:Arial;max-width:240px">
                    <div style="font-weight:800;font-size:14px">${p.reg}${p.desc ? ` · ${p.desc}` : ''}</div>
                    ${p.address ? `<div style="font-size:12px;margin-top:2px">${p.address}</div>` : ''}
                    <div style="font-size:12px;margin-top:4px">Speed: <b>${Math.round(p.speed || 0)} km/h</b>${driver ? ` · ${driver}` : ''}</div>
                    ${job ? `<div style="font-size:12px;color:#13294b;font-weight:700;margin-top:2px">Load ${job.loadConNumber} — ${job.status}</div>` : '<div style="font-size:12px;color:#64748b;margin-top:2px">No active load</div>'}
                    <div style="font-size:11px;color:#94a3b8;margin-top:4px">Last seen ${fmtTime(p.at)}</div>
                    ${isAdmin ? `<button onclick="window.__fbnMapHide && window.__fbnMapHide('${(p.reg || '').replace(/'/g, '')}')" style="margin-top:8px;font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:3px 8px;cursor:pointer">Hide from map</button>` : ''}
                </div>`,
            });
            // Truck for big assets, car for bakkies/light vehicles; coloured by status.
            // An admin override (carSet) forces specific regs to the car icon.
            const kind = carSet.has(alnum(p.reg)) ? 'car' : assetKind(veh?.weightCategory || p.desc || p.fleet);
            const sz = kind === 'car' ? 28 : 42;
            const h = kind === 'car' ? sz * 0.625 : sz * 0.5625; // match each viewBox so it isn't squashed
            const marker = new window.google.maps.Marker({
                position: { lat: p.lat, lng: p.lng }, map: mapInstanceRef.current, title: p.reg,
                icon: {
                    url: iconUri(kind, colour),
                    scaledSize: new window.google.maps.Size(sz, h),
                    anchor: new window.google.maps.Point(sz / 2, h / 2),
                },
            });
            marker.addListener('click', () => info.open({ anchor: marker, map: mapInstanceRef.current }));
            markersRef.current.push(marker);
            bounds.extend({ lat: p.lat, lng: p.lng });
        });
        // Fit to all trucks the first time we get data.
        if (positions.length && !mapInstanceRef.current.__fitted) { mapInstanceRef.current.fitBounds(bounds); mapInstanceRef.current.__fitted = true; }
    }, [positions, loadConfirmations, isApiLoaded, hiddenSet, carSet, vehByReg, isAdmin]);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-lg font-black text-[#13294b]">Live Fleet</h3>
                    <p className="text-xs text-slate-500">{loading ? 'Loading positions…' : err ? <span className="text-red-600">{err}</span> : `${positions.length} trucks · updated ${updatedAt} · refreshes every 30s`}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Moving</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Stopped</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>Off</span>
                    {isAdmin && (
                        <button onClick={() => setManageOpen(o => !o)} className={`font-bold px-2.5 py-1 rounded-lg border ${manageOpen ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`} title="Choose which vehicle registrations to hide from this map">
                            Hide vehicles{hiddenList.length ? ` (${hiddenList.length})` : ''}
                        </button>
                    )}
                </div>
            </div>

            {/* Manage which registrations show on the map — nothing is hidden unless picked here. */}
            {isAdmin && manageOpen && (() => {
                const tracked = Array.from(new Set(positions.map(p => p.reg).filter(Boolean)));
                const all = Array.from(new Set([...tracked, ...hiddenList])).sort((a, b) => a.localeCompare(b));
                return (
                    <div className="mb-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Manage map vehicles</p>
                        <p className="text-[11px] text-slate-500 mb-2">Per registration: <strong>Hide</strong> it from the map (e.g. a personal vehicle), or set its icon to <strong>Car</strong> vs Truck. Nothing changes until you pick it.</p>
                        <div className="max-h-60 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {all.length === 0 && <span className="text-xs text-slate-400">No tracked vehicles right now.</span>}
                            {all.map(reg => {
                                const hidden = hiddenSet.has(alnum(reg));
                                const isCar = carSet.has(alnum(reg));
                                const veh = vehByReg.get(alnum(reg));
                                return (
                                    <div key={reg} className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                                        <span className="font-mono font-bold text-slate-800 truncate flex-1">{reg}{veh?.name ? <span className="text-[11px] text-slate-400 font-sans"> · {veh.name}</span> : ''}</span>
                                        <div className="flex gap-0.5 shrink-0">
                                            <button onClick={() => setRegCar(reg, false)} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${!isCar ? 'bg-[#13294b] text-white' : 'text-slate-500 hover:bg-slate-100'}`} title="Show as a truck">Truck</button>
                                            <button onClick={() => setRegCar(reg, true)} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isCar ? 'bg-[#13294b] text-white' : 'text-slate-500 hover:bg-slate-100'}`} title="Show as a car / bakkie">Car</button>
                                        </div>
                                        <button onClick={() => setRegHidden(reg, !hidden)} className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${hidden ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-amber-100 hover:text-amber-700'}`} title={hidden ? 'Currently hidden — click to show' : 'Hide from map'}>{hidden ? 'Hidden' : 'Hide'}</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <div ref={mapRef} style={{ width: '100%', height: 'calc(100vh - 22rem)', minHeight: 420, borderRadius: 8 }} />
        </div>
    );
};

export default LiveFleetMap;
