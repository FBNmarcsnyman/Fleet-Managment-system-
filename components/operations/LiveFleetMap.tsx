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
    // Light vehicles — bakkies + everything up to a 4-tonner — render as cars; 5T+ as trucks.
    if (/BAKKIE|HILUX|RANGER|TRITON|TOYOTA|POLO|SEDAN|\bCAR\b|LDV|KOMBI|\bVAN\b|D-?MAX|AMAROK|NP\s?200|CARAVAN/.test(s)) return 'car';
    if (/RIGID\s*[1-4]\s*T\b|\b[1-4]\s*TON(NER)?\b|\b[1-4]T\b/.test(s)) return 'car';
    return 'truck';
};
// Small side-on SVG icons, coloured by status, as a marker image (data URI).
const truckSvg = (c: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='38' height='30' viewBox='0 0 26 20'><g fill='${c}' stroke='white' stroke-width='0.8' stroke-linejoin='round'><rect x='1' y='4' width='13' height='9' rx='1'/><path d='M14 6h5l4 4v3h-9z'/><circle cx='6' cy='15' r='2.2'/><circle cx='18' cy='15' r='2.2'/></g><g fill='white'><circle cx='6' cy='15' r='0.8'/><circle cx='18' cy='15' r='0.8'/></g></svg>`;
const carSvg = (c: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='26' viewBox='0 0 26 20'><g fill='${c}' stroke='white' stroke-width='0.8' stroke-linejoin='round'><path d='M2 13c0-1 .5-3 2-3l3-3h7l4 3h3c1.5 0 3 1 3 2.5V13z'/><circle cx='7' cy='14' r='2.2'/><circle cx='18' cy='14' r='2.2'/></g><g fill='white'><circle cx='7' cy='14' r='0.8'/><circle cx='18' cy='14' r='0.8'/></g></svg>`;
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
    const [hiddenRegs, setHiddenRegs] = useState<Set<string>>(new Set());
    const loadHidden = async () => {
        try {
            const { data } = await directSelect('email_settings?id=eq.1&select=map_hidden_regs');
            const row = Array.isArray(data) ? data[0] : data;
            setHiddenRegs(new Set(((row?.map_hidden_regs as string[]) || []).map((r: string) => alnum(r))));
        } catch { /* ignore */ }
    };
    useEffect(() => { loadHidden(); }, []);
    // Bridge for the map InfoWindow button (plain HTML) to call back into React.
    useEffect(() => {
        (window as any).__fbnMapHide = async (reg: string) => {
            if (!reg) return;
            const next = new Set(hiddenRegs); next.add(alnum(reg)); setHiddenRegs(next);
            try {
                const { data } = await directSelect('email_settings?id=eq.1&select=map_hidden_regs');
                const row = Array.isArray(data) ? data[0] : data;
                const list = Array.from(new Set([...(((row?.map_hidden_regs as string[]) || [])), reg]));
                await directUpdate('email_settings', { id: '1' }, { map_hidden_regs: list });
            } catch { /* non-blocking */ }
        };
        return () => { try { delete (window as any).__fbnMapHide; } catch { /* */ } };
    }, [hiddenRegs]);

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
            if (hiddenRegs.has(alnum(p.reg))) return; // hidden directly from the map
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
            const kind = assetKind(veh?.weightCategory || p.desc || p.fleet);
            const sz = kind === 'car' ? 30 : 36;
            const marker = new window.google.maps.Marker({
                position: { lat: p.lat, lng: p.lng }, map: mapInstanceRef.current, title: p.reg,
                icon: {
                    url: iconUri(kind, colour),
                    scaledSize: new window.google.maps.Size(sz, sz * 0.8),
                    anchor: new window.google.maps.Point(sz / 2, sz * 0.4),
                },
            });
            marker.addListener('click', () => info.open({ anchor: marker, map: mapInstanceRef.current }));
            markersRef.current.push(marker);
            bounds.extend({ lat: p.lat, lng: p.lng });
        });
        // Fit to all trucks the first time we get data.
        if (positions.length && !mapInstanceRef.current.__fitted) { mapInstanceRef.current.fitBounds(bounds); mapInstanceRef.current.__fitted = true; }
    }, [positions, loadConfirmations, isApiLoaded, hiddenRegs, vehByReg, isAdmin]);

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
                </div>
            </div>
            <div ref={mapRef} style={{ width: '100%', height: 'calc(100vh - 22rem)', minHeight: 420, borderRadius: 8 }} />
        </div>
    );
};

export default LiveFleetMap;
