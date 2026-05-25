import React, { useMemo, useState } from 'react';
import { Vehicle } from '../../types';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import VehicleCard from './VehicleCard';
import VehicleDetail from './VehicleDetail';
import { PlusIcon } from '../icons/PlusIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { LinkIcon } from '../icons/LinkIcon';

type GroupByType = 'branch' | 'category';

const VehicleList: React.FC = () => {
    const {
        vehicles = [],
        selectedVehicleId,
        handleSelectVehicle,
        handleAddVehicle,
        handleBulkAddVehicles
    } = useVehicles();
    const { showModal, hideModal, showToast } = useUIState();
    const [groupBy, setGroupBy] = useState<GroupByType>('branch');

    const groupedVehicles = useMemo(() => {
        const activeVehicles = (vehicles || []).filter((v: Vehicle) => v.status !== 'Sold');
        
        const groups = activeVehicles.reduce((acc, vehicle) => {
            const key = groupBy === 'branch' ? vehicle.branch : (vehicle.weightCategory || 'Uncategorized');
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(vehicle);
            return acc;
        }, {} as Record<string, Vehicle[]>);

        const sortedGroupKeys = Object.keys(groups).sort();
        
        return sortedGroupKeys.reduce((sortedObj, key) => {
            sortedObj[key] = groups[key];
            return sortedObj;
        }, {} as Record<string, Vehicle[]>);

    }, [vehicles, groupBy]);

    if (selectedVehicleId) {
        return <VehicleDetail />;
    }
    
    const GroupButton: React.FC<{type: GroupByType, label: string}> = ({type, label}) => (
        <button onClick={() => setGroupBy(type)} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === type ? 'bg-brand-primary text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {label}
        </button>
    );

    const openAddAsset = () => {
        showModal('addVehicle', {
            onSubmit: async (data: any) => {
                const result = await handleAddVehicle(data);
                if (result?.ok) {
                    hideModal();
                    showToast(`Vehicle "${result.vehicle.name}" created.`);
                } else {
                    // Surface the actual Supabase error so we stop guessing.
                    // Modal stays open so the user can correct + retry.
                    showToast(`Failed to create vehicle: ${result?.error ?? 'Unknown error'}`);
                }
            },
            onCancel: hideModal
        });
    };

    const openBulkImport = () => {
        showModal('bulkImportAssets', {
            onImport: async (data: any[]) => {
                hideModal();
                const result = await handleBulkAddVehicles(data);
                if (result?.ok) {
                    showToast(`Imported ${result.count} vehicle${result.count === 1 ? '' : 's'}.`);
                } else {
                    showToast(`Bulk import failed: ${result?.error ?? 'Unknown error'}`);
                }
            },
            onClose: hideModal
        });
    };

    const openConnectSheet = () => {
        showModal('connectAssetSheet', {
            onImport: async (data: any[]) => {
                hideModal();
                const result = await handleBulkAddVehicles(data);
                if (result?.ok) {
                    showToast(`Synced ${result.count} vehicle${result.count === 1 ? '' : 's'} from sheet.`);
                } else {
                    showToast(`Sheet sync failed: ${result?.error ?? 'Unknown error'}`);
                }
            },
            onClose: hideModal
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                <div className="flex items-center space-x-2 p-1 bg-gray-900/60 rounded-xl w-fit border border-white/5">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-3">View By:</span>
                    <GroupButton type="branch" label="Branch" />
                    <GroupButton type="category" label="Category" />
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={openConnectSheet} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-green-400 rounded-xl border border-green-500/20 transition-all">
                        <LinkIcon className="h-4 w-4 mr-2" /> Live Sheet
                    </button>
                    <button onClick={openBulkImport} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-xl border border-blue-500/20 transition-all">
                        <UploadIcon className="h-4 w-4 mr-2" /> Bulk Import
                    </button>
                    <button onClick={openAddAsset} className="flex items-center px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-900/30 transition-all active:scale-95">
                        <PlusIcon className="h-4 w-4 mr-2" /> Add Asset
                    </button>
                </div>
            </div>

            <div className="space-y-10">
                {Object.keys(groupedVehicles).map(groupName => {
                    const vehiclesInGroup = groupedVehicles[groupName];
                    if (!vehiclesInGroup || vehiclesInGroup.length === 0) return null;
                    return (
                        <div key={groupName} className="animate-fade-in">
                            <h3 className="text-xl font-black text-white mb-6 flex items-center">
                                <span className="w-2 h-8 bg-blue-600 rounded-full mr-4"></span>
                                {groupName} 
                                <span className="ml-3 text-sm font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-md uppercase tracking-tighter">{vehiclesInGroup.length} Assets</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {vehiclesInGroup.map(vehicle => (
                                    <VehicleCard
                                        key={vehicle.id}
                                        vehicle={vehicle}
                                        onSelect={() => handleSelectVehicle(vehicle.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(VehicleList);