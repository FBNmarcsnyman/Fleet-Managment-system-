import React, { useMemo } from 'react';
import { Vehicle, JobCard } from '../../types';
import { formatRegistration } from '../../lib/vehicleRegistration';
import { CarIcon } from '../icons/CarIcon';
import { BellAlertIcon } from '../icons/BellAlertIcon';
import { SpeedometerIcon } from '../icons/SpeedometerIcon';
import { ClipboardIcon } from '../icons/ClipboardIcon';
import { QrCodeIcon } from '../icons/QrCodeIcon';
import { UserIcon } from '../icons/UserIcon';
import { EditIcon } from '../icons/EditIcon';
import { useVehicles, useUIState, useWorkshop, useAuth } from '../../contexts/AppContexts';

interface VehicleCardProps {
    vehicle: Vehicle;
    onSelect: () => void;
}

const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-green-400 bg-green-900/20 border-green-500/20';
    if (score >= 65) return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/20';
    return 'text-red-400 bg-red-900/20 border-red-500/20';
};

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onSelect }) => {
    const { fuelEntries = [], serviceStatuses = new Map(), handleUpdateVehicle, drivers = [] } = useVehicles();
    // The driver is linked in the drivers table (drivers.assignedVehicleId === this vehicle).
    // Reactive: re-linking a driver to another truck updates every card automatically.
    const driverName = useMemo(() => {
        const d = (drivers as any[]).find(x => x.assignedVehicleId === vehicle.id);
        return d?.name || 'Unassigned';
    }, [drivers, vehicle.id]);
    const { showModal, hideModal, showToast } = useUIState();
    const { jobCards = [], handleCreateJobCard } = useWorkshop();
    const { currentUser } = useAuth();
    const isAdmin = ['Admin', 'Super Admin'].includes(currentUser?.role as string);
    const toggleHidden = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const r = await handleUpdateVehicle(vehicle.id, { hidden: !vehicle.hidden } as any);
        if (r?.ok) showToast(vehicle.hidden ? `${vehicle.registration} back in the fleet.` : `${vehicle.registration} hidden from fleet, fuel & map.`);
        else showToast(`Could not update: ${(r as any)?.error ?? 'error'}`);
    };

    const openEditModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        showModal('addVehicle', {
            vehicleData: vehicle,
            onSubmit: async (data: any) => {
                const result = await handleUpdateVehicle(vehicle.id, data);
                if (result?.ok) {
                    hideModal();
                    showToast(`Vehicle "${vehicle.name}" updated.`);
                } else {
                    showToast(`Failed to update vehicle: ${result?.error ?? 'Unknown error'}`);
                }
            },
            onCancel: hideModal,
        });
    };

    const cardData = useMemo(() => {
        const vehicleFuelEntries = (fuelEntries || []).filter((f: any) => f.vehicleId === vehicle.id);
        const latestOdometer = vehicleFuelEntries.length > 0 ? Math.max(0, ...vehicleFuelEntries.map((f: any) => f.odometer)) : vehicle.currentOdometer || 0;
        
        const openJobs = (jobCards || []).filter((jc: JobCard) => jc.vehicleId === vehicle.id && jc.status !== 'Resolved');
        const vehicleServiceStatus = (serviceStatuses || new Map()).get(vehicle.id) || [];
        const overdueServicesCount = (vehicleServiceStatus || []).filter(s => s.status === 'Overdue').length;
        
        return { latestOdometer, openJobsCount: openJobs.length, overdueServicesCount };
    }, [vehicle, fuelEntries, jobCards, serviceStatuses]);

    return (
        <div
            onClick={onSelect}
            className="bg-gray-800 rounded-2xl shadow-lg p-5 cursor-pointer hover:shadow-blue-600/10 hover:ring-1 hover:ring-blue-500/50 transition-all duration-300 flex flex-col justify-between border-l-4 border-transparent group"
        >
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-3 rounded-xl mr-4 shadow-xl shadow-blue-900/40 group-hover:scale-110 transition-transform">
                            <CarIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white leading-tight">{vehicle.name}</h3>
                            <p className="mt-1"><span className="inline-block font-mono font-bold text-sm text-white tracking-wide bg-gray-700/60 px-2 py-0.5 rounded">{formatRegistration(vehicle.registration)}</span></p>
                        </div>
                    </div>
                    {/* Health Score Badge */}
                    <div className="flex items-center gap-1.5">
                        {vehicle.hidden && <span className="px-2 py-1 rounded border border-amber-500/30 bg-amber-900/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">Hidden</span>}
                        <div className={`px-2 py-1 rounded border text-[10px] font-black uppercase tracking-widest ${getHealthColor(vehicle.healthScore || 0)}`}>
                            {vehicle.healthScore}% HEALTH
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-500/10">
                            {vehicle.branch}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {cardData.overdueServicesCount > 0 && (
                            <div className="flex items-center text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded border border-red-500/20 animate-pulse">
                                <BellAlertIcon className="h-4 w-4" />
                            </div>
                        )}
                        {cardData.openJobsCount > 0 && (
                            <div className="flex items-center text-yellow-400 bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                <ClipboardIcon className="h-4 w-4" />
                                <span className="ml-1 font-black text-xs">{cardData.openJobsCount}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-gray-900/40 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-gray-400">
                    <div>
                        <div className="uppercase tracking-widest font-black mb-1 text-[10px] text-gray-500">Driver</div>
                        <div className="text-sm text-gray-100">{driverName}</div>
                    </div>
                    <div>
                        <div className="uppercase tracking-widest font-black mb-1 text-[10px] text-gray-500">Make</div>
                        <div className="text-sm text-gray-100">{vehicle.make || 'Unknown'}</div>
                    </div>
                    <div>
                        <div className="uppercase tracking-widest font-black mb-1 text-[10px] text-gray-500">Model</div>
                        <div className="text-sm text-gray-100">{vehicle.model || 'Unknown'}</div>
                    </div>
                    <div>
                        <div className="uppercase tracking-widest font-black mb-1 text-[10px] text-gray-500">Size</div>
                        <div className="text-sm text-gray-100">{vehicle.weightCategory || 'N/A'}</div>
                    </div>
                </div>
            </div>
            <div className="border-t border-gray-700/50 pt-2 flex justify-around">
                <button onClick={openEditModal} className="p-2 text-gray-500 hover:text-blue-400" title="Edit asset / reassign fleet number"><EditIcon className="h-5 w-5" /></button>
                <button onClick={(e) => { e.stopPropagation(); showModal('createJobCard', { vehicleId: vehicle.id, onSubmit: handleCreateJobCard, onCancel: hideModal }); }} className="p-2 text-gray-500 hover:text-white" title="New Job Card"><ClipboardIcon className="h-5 w-5" /></button>
                <button onClick={(e) => { e.stopPropagation(); showModal('assignDriver', { vehicle, onCancel: hideModal }); }} className="p-2 text-gray-500 hover:text-white" title="Assign Driver"><UserIcon className="h-5 w-5" /></button>
                <button onClick={(e) => { e.stopPropagation(); showModal('qrCode', { vehicle, onCancel: hideModal }); }} className="p-2 text-gray-500 hover:text-white" title="View QR Code"><QrCodeIcon className="h-5 w-5" /></button>
                {vehicle.weightCategory === 'Horse' && (
                    <button onClick={(e) => { e.stopPropagation(); showModal('rigTrailers', { truck: vehicle }); }} className="p-2 text-gray-500 hover:text-white" title="Manage rig trailers (6m / 12m)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                    </button>
                )}
                {isAdmin && (
                    <button onClick={toggleHidden} className={`p-2 ${vehicle.hidden ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-amber-400'}`} title={vehicle.hidden ? 'Unhide — show in fleet, fuel & map' : 'Hide this vehicle (personal / off-book) from fleet, fuel & map'}>
                        {vehicle.hidden
                            ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>}
                    </button>
                )}
            </div>
        </div>
    );
};

export default React.memo(VehicleCard);