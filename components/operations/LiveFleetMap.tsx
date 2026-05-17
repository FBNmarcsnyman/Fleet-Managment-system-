import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Vehicle, User, LoadConfirmation } from '../../types';

declare global {
    interface Window {
        google: any;
    }
}

interface LiveFleetMapProps {
    vehicles: Vehicle[];
    users: User[];
    loadConfirmations: LoadConfirmation[];
}

const JHB_COORDS = { lat: -26.2041, lng: 28.0473 };
const DBN_COORDS = { lat: -29.8587, lng: 31.0218 };
const MAP_ZOOM = 6;

const LiveFleetMap: React.FC<LiveFleetMapProps> = ({ vehicles = [], users = [], loadConfirmations = [] }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [isApiLoaded, setIsApiLoaded] = useState(!!window.google?.maps?.marker);

    const vehicleLocations = useMemo(() => {
        const locations = new Map<string, { lat: number; lng: number }>();
        (vehicles || []).forEach(v => {
            const base = v.branch === 'FBN DBN' ? DBN_COORDS : JHB_COORDS;
            locations.set(v.id, {
                lat: base.lat + (Math.random() - 0.5) * 2.5,
                lng: base.lng + (Math.random() - 0.5) * 2.5,
            });
        });
        return locations;
    }, [vehicles]);

    useEffect(() => {
        const handleApiLoad = () => {
            if (window.google?.maps?.marker) {
                setIsApiLoaded(true);
            }
        };

        if (!isApiLoaded) {
            window.addEventListener('google-maps-api-loaded', handleApiLoad);
            // Check manually as well in case it loaded between states
            const interval = setInterval(() => {
                if (window.google?.maps?.marker) {
                    setIsApiLoaded(true);
                    clearInterval(interval);
                }
            }, 500);
            return () => {
                window.removeEventListener('google-maps-api-loaded', handleApiLoad);
                clearInterval(interval);
            };
        }
    }, [isApiLoaded]);

    useEffect(() => {
        if (isApiLoaded && mapRef.current && !mapInstanceRef.current) {
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center: JHB_COORDS,
                zoom: MAP_ZOOM,
                mapId: 'FBN_FLEET_MAP',
                disableDefaultUI: true,
                zoomControl: true,
            });
        }
    }, [isApiLoaded]);

    useEffect(() => {
        if (!mapInstanceRef.current || !isApiLoaded || !window.google?.maps?.marker) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        const activeVehicles = (vehicles || []).filter(v => v.status !== 'Sold');

        activeVehicles.forEach(vehicle => {
            const position = vehicleLocations.get(vehicle.id);
            if (!position) return;

            const driver = (users || []).find(u => u.assignedVehicleIds?.includes(vehicle.id));
            const job = (loadConfirmations || []).find(lc => lc.vehicleId === vehicle.id && ['In Transit', 'Out for Delivery'].includes(lc.status));

            const contentString = `
                <div class="p-1 text-black">
                    <h3 class="font-bold text-md">${vehicle.registration} (${vehicle.name})</h3>
                    <p class="text-sm">${driver ? `Driver: ${driver.name}` : 'No driver assigned'}</p>
                    <p class="text-sm">${job ? `Job: ${job.loadConNumber}` : 'Idle'}</p>
                </div>`;
            
            const infowindow = new window.google.maps.InfoWindow({ content: contentString });

            // Ensure marker classes are available
            const { PinElement, AdvancedMarkerElement } = window.google.maps.marker;

            const pinGlyph = new PinElement({
                glyph: 'M13.5 2.25l.422 6.032m-1.218 0h2.436m-7.61 3.51l-1.513 1.513a2.25 2.25 0 01-3.182 0l-1.513-1.513a2.25 2.25 0 010-3.182l1.513-1.513a2.25 2.25 0 013.182 0l1.513 1.513m9.462 3.51l-1.513 1.513a2.25 2.25 0 01-3.182 0l-1.513-1.513a2.25 2.25 0 010-3.182l1.513-1.513a2.25 2.25 0 013.182 0l1.513 1.513M12 21v-5.25',
                background: vehicle.status === 'On the road' ? '#10B981' : vehicle.status === 'In for service' ? '#F59E0B' : '#EF4444',
                borderColor: '#FFFFFF',
            });

            const marker = new AdvancedMarkerElement({
                position,
                map: mapInstanceRef.current,
                title: `${vehicle.registration}`,
                content: pinGlyph.element
            });

            marker.addListener('click', () => {
                infowindow.open({ anchor: marker, map: mapInstanceRef.current });
            });

            markersRef.current.push(marker);
        });
        
    }, [vehicles, users, loadConfirmations, vehicleLocations, isApiLoaded]);

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg h-[calc(100vh-18rem)]">
            <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
        </div>
    );
};

export default LiveFleetMap;