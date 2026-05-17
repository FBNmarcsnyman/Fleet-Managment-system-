

import React, { useState, useMemo, useRef } from 'react';
import { Tire, TireInspection, Vehicle, User, HRCase, TireStatus } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { BackIcon } from './icons/BackIcon';
import { CarIcon } from './icons/CarIcon';
import { TrashIcon } from './icons/TrashIcon';
import { BRANCHES } from '../constants';
import StatCard from './StatCard';

interface TireManagementProps {
    tires: Tire[];
    tireInspections: TireInspection[];
    vehicles: Vehicle[];
    users: User[];
    hrCases: HRCase[];
    onAddTire: () => void;
    onUpdateTire: (updatedTire: Tire) => void;
    onAddInspection: (tireId: string) => void;
    onOpenMountTireModal: (tireId: string) => void;
    onOpenSendForRetreadModal: (tireId: string) => void;
    onOpenReceiveRetreadModal: (tireId: string) => void;
    onOpenScrapTireModal: (tireId: string) => void;
}

type ActiveTab = 'overview' | 'asset' | 'inventory';

const TireManagement: React.FC<TireManagementProps> = (props) => {
    const { tires, tireInspections, vehicles, users, hrCases, onAddTire, onUpdateTire, onAddInspection, onOpenMountTireModal, onOpenSendForRetreadModal, onOpenReceiveRetreadModal, onOpenScrapTireModal } = props;
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

    const userMap = useMemo(() => new Map(users.map(u => [u.email, u.name])), [users]);
    const vehicleMap = useMemo(() => new Map(vehicles.map(v => [v.id,v])), [vehicles]);
    
    const TabButton = ({ tab, label }: { tab: ActiveTab, label: string }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-lg font-semibold rounded-t-lg transition-colors ${activeTab === tab ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    const renderContent = () => {
        switch(activeTab) {
            case 'overview':
                return <OverviewTab tires={tires} hrCases={hrCases} userMap={userMap} />;
            case 'asset':
                return <AssetView {...props} />;
            case 'inventory':
                return <InventoryView {...props} vehicleMap={vehicleMap} />;
            default:
                return null;
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Tire Lifecycle Management</h2>
                 <button onClick={onAddTire} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                    <PlusIcon className="h-5 w-5 mr-2" /> Add New Tire to Inventory
                </button>
            </div>
            <div className="flex border-b border-gray-700">
                <TabButton tab="overview" label="Overview" />
                <TabButton tab="asset" label="By Asset" />
                <TabButton tab="inventory" label="Inventory" />
            </div>
            <div className="bg-gray-800 p-6 rounded-b-lg shadow-lg">
                {renderContent()}
            </div>
        </div>
    );
};

// --- OVERVIEW TAB ---
const OverviewTab: React.FC<{tires: Tire[], hrCases: HRCase[], userMap: Map<string, string>}> = ({ tires, hrCases, userMap }) => {
    
    const overviewStats = useMemo(() => {
        return tires.reduce((acc, tire) => {
            acc.total++;
            if (tire.status === 'Mounted') acc.mounted++;
            else if (tire.status === 'In Storage') acc.inStorage++;
            else if (tire.status === 'Out for Retread') acc.atRetreaders++;
            return acc;
        }, { total: 0, mounted: 0, inStorage: 0, atRetreaders: 0 });
    }, [tires]);

    const tiresAtRetreaders = useMemo(() => {
        return tires
            .filter(t => t.status === 'Out for Retread' && t.retreadDetails)
            .map(t => ({
                ...t,
                daysOverdue: differenceInDays(new Date(), new Date(t.retreadDetails!.expectedReturnDate))
            }))
            .sort((a,b) => b.daysOverdue - a.daysOverdue);
    }, [tires]);

    const recentDamageCases = useMemo(() => {
        return hrCases
            .filter(c => c.tireId)
            .map(c => ({
                ...c,
                tire: tires.find(t => t.id === c.tireId),
            }))
            .filter(c => c.tire)
            .sort((a,b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime());
    }, [hrCases, tires]);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Tires" value={overviewStats.total.toString()} />
                <StatCard title="Mounted on Vehicles" value={overviewStats.mounted.toString()} />
                <StatCard title="In Storage (On-site)" value={overviewStats.inStorage.toString()} />
                <StatCard title="At Retreaders (Off-site)" value={overviewStats.atRetreaders.toString()} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Tires at Retreaders</h3>
                    <div className="bg-gray-900/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                        {tiresAtRetreaders.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead><tr className="border-b border-gray-700"><th className="p-2 text-gray-400">Tire (S/N)</th><th className="p-2 text-gray-400">Vendor</th><th className="p-2 text-gray-400">Expected Back</th><th className="p-2 text-gray-400 text-right">Status</th></tr></thead>
                                <tbody>
                                    {tiresAtRetreaders.map(tire => (
                                        <tr key={tire.id} className="border-b border-gray-700/50">
                                            <td className="p-2"><span className="font-mono">{tire.serialNumber}</span><br/><span className="text-xs text-gray-400">{tire.brand}</span></td>
                                            <td className="p-2">{tire.retreadDetails?.vendor}</td>
                                            <td className="p-2">{format(new Date(tire.retreadDetails!.expectedReturnDate), 'dd MMM yyyy')}</td>
                                            <td className={`p-2 text-right font-semibold ${tire.daysOverdue > 0 ? 'text-red-400' : 'text-green-400'}`}>{tire.daysOverdue > 0 ? `${tire.daysOverdue} days overdue` : 'On track'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p className="text-gray-500 text-center py-8">No tires are currently out for retreading.</p>}
                    </div>
                </div>
                 <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Damage Accountability (HR Cases)</h3>
                     <div className="bg-gray-900/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                        {recentDamageCases.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead><tr className="border-b border-gray-700"><th className="p-2 text-gray-400">Tire (S/N)</th><th className="p-2 text-gray-400">Driver</th><th className="p-2 text-gray-400">Cost</th><th className="p-2 text-gray-400">Status</th></tr></thead>
                                <tbody>
                                    {recentDamageCases.map(c => (
                                        <tr key={c.id} className="border-b border-gray-700/50">
                                            <td className="p-2"><span className="font-mono">{c.tire!.serialNumber}</span><br/><span className="text-xs text-gray-400" title={c.damageReason}>{c.damageReason.substring(0,25)}...</span></td>
                                            <td className="p-2">{userMap.get(c.driverId) || c.driverId}</td>
                                            <td className="p-2 font-mono text-red-400">R{c.costToRecover.toFixed(2)}</td>
                                            <td className="p-2">{c.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p className="text-gray-500 text-center py-8">No HR cases linked to tire damage.</p>}
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- ASSET VIEW TAB ---
const AssetView: React.FC<TireManagementProps> = ({ tires, tireInspections, vehicles, users, hrCases, ...actions }) => {
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [branchFilter, setBranchFilter] = useState<'All' | string>('All');
    
    const filteredVehicles = useMemo(() => {
        return vehicles
            .filter(v => branchFilter === 'All' || v.branch === branchFilter)
            .filter(v => v.status !== 'Sold');
    }, [vehicles, branchFilter]);

    const mountedTiresByVehicle = useMemo(() => {
        const map = new Map<string, Tire[]>();
        for (const tire of tires) {
            if (tire.status === 'Mounted' && tire.assignedVehicleId) {
                if (!map.has(tire.assignedVehicleId)) map.set(tire.assignedVehicleId, []);
                map.get(tire.assignedVehicleId)!.push(tire);
            }
        }
        return map;
    }, [tires]);
    
    const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId), [selectedVehicleId, vehicles]);

    const latestInspectionsMap = useMemo(() => {
        const map = new Map<string, TireInspection>();
        for (const inspection of tireInspections) {
            const existing = map.get(inspection.tireId);
            if (!existing || new Date(inspection.date) > new Date(existing.date)) map.set(inspection.tireId, inspection);
        }
        return map;
    }, [tireInspections]);

    const selectedVehicleMountedTires = useMemo(() => {
        if (!selectedVehicleId) return [];
        const mounted = mountedTiresByVehicle.get(selectedVehicleId) || [];
        return mounted.map(tire => ({
            ...tire,
            latestTreadDepth: latestInspectionsMap.get(tire.id)?.treadDepth,
        })).sort((a,b) => (a.assignedPosition || "").localeCompare(b.assignedPosition || ""));
    }, [selectedVehicleId, mountedTiresByVehicle, latestInspectionsMap]);

    const selectedVehicleHistory = useMemo(() => {
        if (!selectedVehicleId) return [];
        const vehicleHRCases = hrCases.filter(c => c.vehicleId === selectedVehicleId && c.tireId);
        return vehicleHRCases.map(hrCase => {
            const tire = tires.find(t => t.id === hrCase.tireId);
            return tire ? { date: hrCase.reportedDate, tire: tire, reason: hrCase.damageReason } : null;
        }).filter(Boolean).sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime());
    }, [selectedVehicleId, hrCases, tires]);

    if (selectedVehicle) {
        return (
            <div>
                <button onClick={() => setSelectedVehicleId(null)} className="flex items-center text-brand-secondary hover:text-blue-400 mb-6 font-semibold">
                    <BackIcon className="h-5 w-5 mr-2" /> Back to Vehicle List
                </button>
                <h3 className="text-2xl font-bold text-white">{selectedVehicle.name} ({selectedVehicle.registration})</h3>
                <p className="text-gray-400 mb-6">Tire Overview for this Asset</p>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h4 className="text-lg font-semibold text-white mb-4">Currently Mounted Tires</h4>
                        {selectedVehicleMountedTires.length > 0 ? (
                             <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead><tr className="border-b border-gray-700"><th className="p-2 text-gray-400">Position</th><th className="p-2 text-gray-400">Serial No.</th><th className="p-2 text-gray-400 text-right">Tread</th></tr></thead>
                                    <tbody>
                                        {selectedVehicleMountedTires.map(tire => (
                                            <tr key={tire.id} className="border-b border-gray-700/50"><td className="p-2 font-semibold">{tire.assignedPosition}</td><td className="p-2 font-mono">{tire.serialNumber}</td><td className="p-2 text-right font-mono">{tire.latestTreadDepth?.toFixed(1) ?? 'N/A'} mm</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                             </div>
                        ) : <p className="text-gray-500 text-center py-8">No tires mounted.</p>}
                    </div>
                     <div>
                        <h4 className="text-lg font-semibold text-white mb-4">Scrap History</h4>
                        {selectedVehicleHistory.length > 0 ? (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {selectedVehicleHistory.map(event => (
                                    <div key={`${event!.date}-${event!.tire.id}`} className="flex items-start space-x-3 bg-gray-900/50 p-3 rounded-md">
                                        <div className="flex-shrink-0 bg-red-900/50 p-2 rounded-full"><TrashIcon className="h-5 w-5 text-red-400" /></div>
                                        <div>
                                            <p className="font-semibold text-white">Tire Scrapped: <span className="font-mono">{event!.tire.serialNumber}</span></p>
                                            <p className="text-sm text-gray-400 italic">"{event!.reason}"</p>
                                            <p className="text-xs text-gray-500 mt-1">{format(new Date(event!.date), 'dd MMM yyyy')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-gray-500 text-center py-8">No scrap history.</p>}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="mb-4">
                 <label htmlFor="branch-filter" className="block text-sm font-medium text-gray-300 mb-1">Filter by Branch</label>
                 <select id="branch-filter" onChange={(e) => setBranchFilter(e.target.value)} value={branchFilter} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600">
                    <option value="All">All Branches</option>
                    {[...BRANCHES].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVehicles.map(vehicle => (
                     <div key={vehicle.id} onClick={() => setSelectedVehicleId(vehicle.id)} className="bg-gray-700/50 p-4 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                        <div className="flex items-center mb-3"><CarIcon className="h-6 w-6 mr-3 text-brand-secondary" /><div><p className="font-bold text-white">{vehicle.name}</p><p className="text-sm text-gray-400">{vehicle.registration}</p></div></div>
                        <p className="text-sm"><strong className="text-gray-400">Mounted Tires:</strong> {mountedTiresByVehicle.get(vehicle.id)?.length || 0}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// --- INVENTORY VIEW TAB ---
interface InventoryViewProps extends TireManagementProps {
    vehicleMap: Map<string, Vehicle>;
}
const InventoryView: React.FC<InventoryViewProps> = ({ tires, onOpenMountTireModal, onOpenScrapTireModal, onOpenSendForRetreadModal, onOpenReceiveRetreadModal, onAddInspection, vehicleMap }) => {
    const [filters, setFilters] = useState({ status: 'All', brand: 'All', type: 'All' });
    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const brands = useMemo(() => ['All', ...Array.from(new Set(tires.map(t => t.brand)))], [tires]);
    const statuses: (TireStatus | 'All')[] = ['All', 'In Storage', 'Mounted', 'Out for Retread', 'Scrapped'];

    const tiresWithCalculations = useMemo(() => {
        return tires.map(tire => {
            const totalDistance = tire.mountHistory.reduce((total, h) => {
                if (h.dismountOdometer && h.mountOdometer) {
                    return total + (h.dismountOdometer - h.mountOdometer);
                }
                return total;
            }, 0);

            const cpk = totalDistance > 0 ? tire.purchasePrice / totalDistance : 0;
            return { ...tire, totalDistance, cpk };
        });
    }, [tires]);

    const filteredTires = useMemo(() => {
        return tiresWithCalculations.filter(t => 
            (filters.status === 'All' || t.status === filters.status) &&
            (filters.brand === 'All' || t.brand === filters.brand) &&
            (filters.type === 'All' || t.type === filters.type)
        ).sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    }, [tiresWithCalculations, filters]);

    const ActionButton: React.FC<{onClick: () => void, children: React.ReactNode, className: string}> = ({ onClick, children, className }) => (
        <button onClick={onClick} className={`text-xs font-semibold py-1 px-2 rounded-full transition-colors ${className}`}>{children}</button>
    );

    return (
        <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
                 <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600"><option value="All">All Statuses</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
                 <select name="brand" value={filters.brand} onChange={handleFilterChange} className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600"><option value="All">All Brands</option>{brands.map(b => <option key={b} value={b}>{b}</option>)}</select>
                 <select name="type" value={filters.type} onChange={handleFilterChange} className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600"><option value="All">All Types</option><option value="New">New</option><option value="Retread">Retread</option></select>
            </div>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-800"><tr className="border-b border-gray-700"><th className="p-2 text-gray-400">Serial No.</th><th className="p-2 text-gray-400">Details</th><th className="p-2 text-gray-400">Location</th><th className="p-2 text-gray-400">Total KM</th><th className="p-2 text-gray-400">CPK</th><th className="p-2 text-gray-400 text-right">Actions</th></tr></thead>
                    <tbody>
                        {filteredTires.map(tire => (
                            <tr key={tire.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-mono">{tire.serialNumber}</td>
                                <td className="p-2">{tire.brand} {tire.size} ({tire.type})</td>
                                <td className="p-2">
                                    {tire.status === 'Mounted' ? `Veh: ${vehicleMap.get(tire.assignedVehicleId!)?.registration}` : 
                                     tire.status === 'Out for Retread' ? `Retreader: ${tire.retreadDetails?.vendor}` : 
                                     tire.status}
                                </td>
                                <td className="p-2 font-mono">{tire.totalDistance.toLocaleString()} km</td>
                                <td className="p-2 font-mono">R{tire.cpk.toFixed(3)}</td>
                                <td className="p-2 text-right space-x-2">
                                    {tire.status === 'In Storage' && <ActionButton onClick={() => onOpenMountTireModal(tire.id)} className="bg-green-600 hover:bg-green-700">Mount</ActionButton>}
                                    {tire.status === 'Mounted' && <ActionButton onClick={() => onAddInspection(tire.id)} className="bg-blue-600 hover:bg-blue-700">Inspect</ActionButton>}
                                    {tire.status === 'In Storage' && <ActionButton onClick={() => onOpenSendForRetreadModal(tire.id)} className="bg-orange-600 hover:bg-orange-700">Retread</ActionButton>}
                                    {tire.status === 'Out for Retread' && <ActionButton onClick={() => onOpenReceiveRetreadModal(tire.id)} className="bg-teal-600 hover:bg-teal-700">Receive</ActionButton>}
                                    {(tire.status === 'In Storage' || tire.status === 'Mounted') && <ActionButton onClick={() => onOpenScrapTireModal(tire.id)} className="bg-red-600 hover:bg-red-700">Scrap</ActionButton>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default TireManagement;
