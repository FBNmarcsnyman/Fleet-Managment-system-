import React, { useMemo, useState } from 'react';
import { Vehicle, Branch } from '../../types';
import { useVehicles, useUIState } from '../../contexts/AppContexts';
import { BRANCHES, CATEGORY_ORDER } from '../../constants';
import VehicleCard from './VehicleCard';
import VehicleDetail from './VehicleDetail';
import { PlusIcon } from '../icons/PlusIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { LinkIcon } from '../icons/LinkIcon';
import { QrCodeIcon } from '../icons/QrCodeIcon';

const BRANCH_DISPLAY_NAMES: Record<Branch, string> = {
    'FBN JHB': 'JHB Fleet',
    'FBN DBN': 'DBN Fleet',
    'FBN CPT': 'CPT Fleet',
    'LOADMASTER': 'LM Fleet',
};

const BRANCH_SORT_ORDER: Branch[] = ['LOADMASTER', 'FBN DBN', 'FBN JHB'];

const branchLabel = (branch: Branch) => BRANCH_DISPLAY_NAMES[branch];
const trailerGroupLabel = (branch: Branch) => `${BRANCH_DISPLAY_NAMES[branch].replace(/ Fleet$/, '')} Trailers`;

const isTrailerCategory = (category: string | undefined) => {
    if (!category) return false;
    return /trailer|triaxle|skeleton/i.test(category);
};

const sortVehiclesByRegistration = (vehicles: Vehicle[]) => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration));

// Trailer-style categories where auto-pairing makes sense.
const TRAILER_CATEGORIES = new Set(['Standard Trailer', 'Superlink Trailer']);

// Reg-similarity helpers (mirrors the form-level logic). One-char difference
// between two normalised regs = treat as a pair candidate.
const normReg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const regDistance = (a: string, b: string): number => {
    if (a.length !== b.length) return Infinity;
    let d = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            d++;
            if (d > 2) return Infinity;
        }
    }
    return d;
};

type GroupByType = 'branch' | 'category';
type BranchFilter = Branch | 'All';

// Re-order a list so that vehicles linked via `linkedVehicleId` sit next
// to each other (e.g. superlink 6m + 12m trailers as a pair). The first
// vehicle of each pair keeps its original position; the partner is
// inserted immediately after.
const pairLinkedVehicles = (vehicles: Vehicle[]): Vehicle[] => {
    const byId = new Map(vehicles.map(v => [v.id, v]));
    const seen = new Set<string>();
    const result: Vehicle[] = [];
    for (const v of vehicles) {
        if (seen.has(v.id)) continue;
        result.push(v);
        seen.add(v.id);
        if (v.linkedVehicleId && byId.has(v.linkedVehicleId) && !seen.has(v.linkedVehicleId)) {
            result.push(byId.get(v.linkedVehicleId)!);
            seen.add(v.linkedVehicleId);
        }
    }
    return result;
};

const VehicleList: React.FC = () => {
    const {
        vehicles = [],
        selectedVehicleId,
        handleSelectVehicle,
        handleAddVehicle,
        handleBulkAddVehicles,
        handleUpdateVehicle
    } = useVehicles();
    const { showModal, hideModal, showToast } = useUIState();
    const [groupBy, setGroupBy] = useState<GroupByType>('branch');
    const [branchFilter, setBranchFilter] = useState<BranchFilter>('All');

    const groupedVehicles = useMemo(() => {
        const activeVehicles: Vehicle[] = (vehicles || []).filter((v: Vehicle) => v.status !== 'Sold');

        const filteredVehicles: Vehicle[] = activeVehicles.filter((v: Vehicle) => branchFilter === 'All' || v.branch === branchFilter);

        const groups = filteredVehicles.reduce((acc: Record<string, Vehicle[]>, vehicle: Vehicle) => {
            const key = groupBy === 'branch'
                ? (isTrailerCategory(vehicle.weightCategory) ? trailerGroupLabel(vehicle.branch) : branchLabel(vehicle.branch))
                : (vehicle.weightCategory || 'Uncategorized');
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(vehicle);
            return acc;
        }, {} as Record<string, Vehicle[]>);

        if (groupBy === 'branch') {
            const sortedGroupKeys: string[] = [];
            for (const branch of BRANCH_SORT_ORDER) {
                const fleetKey = branchLabel(branch);
                const trailerKey = trailerGroupLabel(branch);
                if (groups[fleetKey]) sortedGroupKeys.push(fleetKey);
                if (groups[trailerKey]) sortedGroupKeys.push(trailerKey);
            }
            const remaining = Object.keys(groups).filter(k => !sortedGroupKeys.includes(k)).sort();
            const allKeys = [...sortedGroupKeys, ...remaining];
            return allKeys.reduce((sortedObj, key) => {
                sortedObj[key] = pairLinkedVehicles(sortVehiclesByRegistration(groups[key]));
                return sortedObj;
            }, {} as Record<string, Vehicle[]>);
        }

        const orderList: string[] = CATEGORY_ORDER;
        const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
            const ai = orderList.indexOf(a);
            const bi = orderList.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });

        return sortedGroupKeys.reduce((sortedObj, key) => {
            sortedObj[key] = pairLinkedVehicles(sortVehiclesByRegistration(groups[key]));
            return sortedObj;
        }, {} as Record<string, Vehicle[]>);

    }, [vehicles, groupBy, branchFilter]);

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

    // One-click pass over the fleet: find unlinked trailers whose registrations
    // differ by exactly one character (typical SA superlink pair convention)
    // and persist linkedVehicleId on each pair via Supabase. Existing links
    // are left alone.
    const handleAutoPairTrailers = async () => {
        const trailers = (vehicles as Vehicle[])
            .filter(v => TRAILER_CATEGORIES.has(v.weightCategory || ''))
            .filter(v => !v.linkedVehicleId);
        if (trailers.length < 2) {
            showToast('No unpaired trailers found to auto-pair.');
            return;
        }
        // Build pairs greedily. Each trailer can only be in one pair.
        const used = new Set<string>();
        const pairs: Array<[Vehicle, Vehicle]> = [];
        for (const t of trailers) {
            if (used.has(t.id)) continue;
            const tn = normReg(t.registration);
            let best: { partner: Vehicle; d: number } | null = null;
            for (const c of trailers) {
                if (c.id === t.id || used.has(c.id)) continue;
                const d = regDistance(tn, normReg(c.registration));
                if (d === 1) {
                    best = { partner: c, d };
                    break; // distance-1 is as good as it gets
                }
                if (d === 2 && !best) best = { partner: c, d };
            }
            if (best) {
                pairs.push([t, best.partner]);
                used.add(t.id);
                used.add(best.partner.id);
            }
        }
        if (pairs.length === 0) {
            showToast('No similar-registration trailer pairs detected.');
            return;
        }
        // Persist: set linkedVehicleId on the first trailer of each pair.
        // The display-sort (pairLinkedVehicles) is unidirectional-aware so
        // one-way linkage is enough.
        let okCount = 0;
        const failures: string[] = [];
        for (const [a, b] of pairs) {
            const result = await handleUpdateVehicle(a.id, { linkedVehicleId: b.id });
            if (result?.ok) okCount++;
            else failures.push(`${a.registration}: ${result?.error ?? 'unknown'}`);
        }
        if (failures.length === 0) {
            showToast(`Auto-paired ${okCount} trailer${okCount === 1 ? '' : 's'}.`);
        } else {
            showToast(`Paired ${okCount}, ${failures.length} failed. Check console.`);
            console.error('[fleet] auto-pair failures:', failures);
        }
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

                <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto">
                    {groupBy === 'branch' && (
                        <div className="flex items-center gap-2 bg-gray-900/60 rounded-xl border border-gray-700 px-3 py-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Branch</label>
                            <select
                                value={branchFilter}
                                onChange={e => setBranchFilter(e.target.value as BranchFilter)}
                                className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="All">All branches</option>
                                {BRANCH_SORT_ORDER.map(branch => (
                                    <option key={branch} value={branch}>{branch === 'LOADMASTER' ? 'LM' : branch.replace('FBN ', '')}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={handleAutoPairTrailers} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-purple-400 rounded-xl border border-purple-500/20 transition-all" title="Pair trailers whose registrations differ by one character (typical SA superlink convention)">
                            <LinkIcon className="h-4 w-4 mr-2" /> Auto-pair Trailers
                        </button>
                        <button onClick={openConnectSheet} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-green-400 rounded-xl border border-green-500/20 transition-all">
                            <LinkIcon className="h-4 w-4 mr-2" /> Live Sheet
                        </button>
                        <button onClick={openBulkImport} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-xl border border-blue-500/20 transition-all">
                            <UploadIcon className="h-4 w-4 mr-2" /> Bulk Import
                        </button>
                        <button onClick={() => showModal('qrSheet', { onCancel: hideModal })} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-amber-400 rounded-xl border border-amber-500/20 transition-all" title="Print scannable checklist QR labels for every vehicle & trailer">
                            <QrCodeIcon className="h-4 w-4 mr-2" /> QR Labels
                        </button>
                        <button onClick={openAddAsset} className="flex items-center px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-900/30 transition-all active:scale-95">
                            <PlusIcon className="h-4 w-4 mr-2" /> Add Asset
                        </button>
                    </div>
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