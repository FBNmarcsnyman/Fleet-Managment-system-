import React, { useRef, useEffect, useState } from 'react';
import { User, LoadConfirmation } from '../../types';
import { supabase } from '../../lib/supabase';

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

// Live fleet map: real truck positions from Pulsit, refreshed every 30s. Each
// marker is green (moving), amber (stopped, ignition on) or slate (ignition off).
// Clicking shows the reg, address, speed, last-seen and any active load on that truck.
const LiveFleetMap: React.FC<LiveFleetMapProps> = ({ users = [], loadConfirmations = [] }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [isApiLoaded, setIsApiLoaded] = useState(!!window.google?.maps?.marker);
    const [positions, setPositions] = useState<LivePos[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string>('');
    const [loading, setLoading] = useState(true);

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

    // Wait for the Google Maps script (loaded in index.html with the marker library).
    useEffect(() => {
        if (isApiLoaded) return;
        const handle = () => { if (window.google?.maps?.marker) setIsApiLoaded(true); };
        window.addEventListener('google-maps-api-loaded', handle);
        const interval = setInterval(() => { if (window.google?.maps?.marker) { setIsApiLoaded(true); clearInterval(interval); } }, 500);
        return () => { window.removeEventListener('google-maps-api-loaded', handle); clearInterval(interval); };
    }, [isApiLoaded]);

    useEffect(() => {
        if (isApiLoaded && mapRef.current && !mapInstanceRef.current) {
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center: JHB_COORDS, zoom: MAP_ZOOM, mapId: 'FBN_FLEET_MAP', disableDefaultUI: true, zoomControl: true,
            });
        }
    }, [isApiLoaded]);

    // Render / refresh the markers whenever positions change.
    useEffect(() => {
        if (!mapInstanceRef.current || !isApiLoaded || !window.google?.maps?.marker) return;
        markersRef.current.forEach(m => { m.map = null; });
        markersRef.current = [];
        const { PinElement, AdvancedMarkerElement } = window.google.maps.marker;
        const bounds = new window.google.maps.LatLngBounds();

        positions.forEach(p => {
            if (p.lat == null || p.lng == null) return;
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
                </div>`,
            });
            const pin = new PinElement({ background: colour, borderColor: '#FFFFFF', glyphColor: '#FFFFFF' });
            const marker = new AdvancedMarkerElement({ position: { lat: p.lat, lng: p.lng }, map: mapInstanceRef.current, title: p.reg, content: pin.element });
            marker.addListener('click', () => info.open({ anchor: marker, map: mapInstanceRef.current }));
            markersRef.current.push(marker);
            bounds.extend({ lat: p.lat, lng: p.lng });
        });
        // Fit to all trucks the first time we get data.
        if (positions.length && !mapInstanceRef.current.__fitted) { mapInstanceRef.current.fitBounds(bounds); mapInstanceRef.current.__fitted = true; }
    }, [positions, loadConfirmations, isApiLoaded]);

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
