import React, { useState, useMemo } from 'react';
import { FuelEntry, Vehicle, FuelPriceRecord, Bowser, BowserRefill, OtherCost } from '../types';
import FuelFillingForm from './FuelFillingForm';
import FuelPriceManagement from './FuelPriceManagement';
import { PlusIcon } from './icons/PlusIcon';
import { UploadIcon } from './icons/UploadIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { LinkIcon } from './icons/LinkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EditIcon } from './icons/EditIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { useUIState, useVehicles } from '../contexts/AppContexts';
import { format } from 'date-fns';
import DateField from './operations/DateField';

interface FuelManagementProps {
    vehicles: Vehicle[];
    prices: FuelPriceRecord[];
    bowsers: Bowser[];
    bowserRefills: BowserRefill[];
    onSubmitSingle: (entry: Omit<FuelEntry, 'id'>) => void;
    onSetPrice: (price: Omit<FuelPriceRecord, 'id'>) => void;
    onAddBowser: () => void;
    onAddBowserRefill: (refill: Omit<BowserRefill, 'id' | 'finalCostPerLiter'>) => void;
    availableBranches: string[];
    onFileUpload: (file: File) => void;
    onConnectSheet: () => void;
    isSheetConnected: boolean;
    onSyncNow: () => void;
    isSyncing?: boolean;
}

const BowserManagement: React.FC<{
    bowsers: Bowser[];
    bowserRefills: BowserRefill[];
    onAddBowser: () => void;
    onAddBowserRefill: (refill: Omit<BowserRefill, 'id' | 'finalCostPerLiter'>) => void;
    onUpdateBowserRefill: (id: string, updates: Partial<BowserRefill>) => void;
    onDeleteBowserRefill: (id: string) => void;
}> = ({ bowsers, bowserRefills, onAddBowser, onAddBowserRefill, onUpdateBowserRefill, onDeleteBowserRefill }) => {
    const { showToast } = useUIState();
    const [selectedBowser, setSelectedBowser] = useState(bowsers[0]?.id || '');
    const [liters, setLiters] = useState('');
    const [costPerLiter, setCostPerLiter] = useState('');
    const [supplier, setSupplier] = useState('');
    const [rebate, setRebate] = useState('');
    const [refDate, setRefDate] = useState(new Date().toISOString().split('T')[0]);
    const [refNo, setRefNo] = useState('');

    // Editing State
    const [editingRefillId, setEditingRefillId] = useState<string | null>(null);
    const [editLiters, setEditLiters] = useState('');
    const [editRefNo, setEditRefNo] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editSupplier, setEditSupplier] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!selectedBowser || !liters || !costPerLiter || !supplier || !refNo) {
            alert('Please fill all required refill fields, including Reference Number.');
            return;
        }
        onAddBowserRefill({
            bowserId: selectedBowser,
            date: refDate,
            liters: parseFloat(liters),
            costPerLiter: parseFloat(costPerLiter),
            supplier,
            referenceNumber: refNo,
            rebatePercentage: rebate ? parseFloat(rebate) : undefined,
        });
        // Reset form
        setLiters('');
        setCostPerLiter('');
        setSupplier('');
        setRebate('');
        setRefNo('');
        showToast("Bowser refill recorded and stock updated.");
    };

    const handleStartEdit = (refill: BowserRefill) => {
        setEditingRefillId(refill.id);
        setEditLiters(refill.liters.toString());
        setEditRefNo(refill.referenceNumber);
        setEditDate(refill.date.split('T')[0]);
        setEditSupplier(refill.supplier);
    };

    const handleSaveEdit = (id: string) => {
        onUpdateBowserRefill(id, {
            liters: parseFloat(editLiters),
            referenceNumber: editRefNo,
            date: editDate,
            supplier: editSupplier
        });
        setEditingRefillId(null);
        showToast("Refill record updated.");
    };

    const recentRefills = useMemo(() => {
        return [...(bowserRefills || [])]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 15);
    }, [bowserRefills]);
    
    return (
        <div className="space-y-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-white mb-4 flex justify-between items-center">
                    <span>Bowser Management</span>
                    <button onClick={onAddBowser} type="button" className="flex items-center text-sm font-semibold py-2 px-3 rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Add Bowser
                    </button>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {bowsers.map(bowser => (
                        <div key={bowser.id} className="bg-gray-700/50 p-4 rounded-lg">
                            <h3 className="font-bold text-white">{bowser.name}</h3>
                            <p className="text-gray-400 text-sm">Capacity: {bowser.capacity.toLocaleString()} L</p>
                            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${(bowser.currentStock / bowser.capacity) * 100}%` }}></div>
                            </div>
                            <p className="text-right text-sm font-mono mt-1">{bowser.currentStock.toLocaleString()} L</p>
                        </div>
                    ))}
                </div>
                
                <form onSubmit={handleSubmit} className="mt-6 border-t border-gray-700 pt-6 space-y-4">
                    <h3 className="font-semibold text-white">Log Bowser Refill</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Select Bowser</label>
                            <select value={selectedBowser} onChange={e => setSelectedBowser(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md"><option disabled value="">Select Bowser</option>{bowsers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Refill Date</label>
                            <DateField value={refDate} onChange={setRefDate} className="w-full bg-gray-700 p-2 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Reference No.</label>
                            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="e.g., INV-001" className="w-full bg-gray-700 p-2 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Liters</label>
                            <input type="number" value={liters} onChange={e => setLiters(e.target.value)} placeholder="0.00" className="w-full bg-gray-700 p-2 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Cost/L (Ex VAT)</label>
                            <input type="number" value={costPerLiter} onChange={e => setCostPerLiter(e.target.value)} placeholder="R 0.00" className="w-full bg-gray-700 p-2 rounded-md" step="0.01" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Supplier</label>
                            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Vendor Name" className="w-full bg-gray-700 p-2 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Rebate %</label>
                            <input type="number" value={rebate} onChange={e => setRebate(e.target.value)} placeholder="%" className="w-full bg-gray-700 p-2 rounded-md" step="0.01" />
                        </div>
                    </div>
                     <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs mt-2">Log Restock Entry</button>
                </form>
            </div>

            {/* Bowser Audit Log */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Recent Bowser Refills (Audit Log)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-700 text-gray-400">
                                <th className="p-3">Date</th>
                                <th className="p-3">Bowser</th>
                                <th className="p-3">Reference #</th>
                                <th className="p-3">Supplier</th>
                                <th className="p-3 text-right">Liters</th>
                                <th className="p-3 text-right">Cost/L</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentRefills.map(refill => {
                                const isEditing = editingRefillId === refill.id;
                                return (
                                    <tr key={refill.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 group">
                                        <td className="p-3 text-gray-300 font-mono">
                                            {isEditing ? (
                                                <DateField value={editDate} onChange={setEditDate} className="bg-gray-900 text-white p-1 rounded border border-blue-500 w-32" />
                                            ) : (
                                                format(new Date(refill.date), 'dd MMM yy')
                                            )}
                                        </td>
                                        <td className="p-3 text-white font-bold">{bowsers.find(b => b.id === refill.bowserId)?.name || 'N/A'}</td>
                                        <td className="p-3">
                                            {isEditing ? (
                                                <input value={editRefNo} onChange={e => setEditRefNo(e.target.value)} className="bg-gray-900 text-white p-1 rounded border border-blue-500 w-24" />
                                            ) : (
                                                <span className="text-gray-400 font-mono">{refill.referenceNumber}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-gray-300">
                                            {isEditing ? (
                                                <input value={editSupplier} onChange={e => setEditSupplier(e.target.value)} className="bg-gray-900 text-white p-1 rounded border border-blue-500 w-32" />
                                            ) : (
                                                refill.supplier
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            {isEditing ? (
                                                <input type="number" value={editLiters} onChange={e => setEditLiters(e.target.value)} className="bg-gray-900 text-white p-1 rounded border border-blue-500 w-24 text-right" />
                                            ) : (
                                                <span className="text-white font-bold">{refill.liters.toLocaleString()} L</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right text-gray-400 font-mono">R {refill.finalCostPerLiter.toFixed(2)}</td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end space-x-2">
                                                {isEditing ? (
                                                    <button onClick={() => handleSaveEdit(refill.id)} className="text-green-400 hover:text-green-300">
                                                        <CheckCircleIcon className="h-5 w-5" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleStartEdit(refill)} className="text-gray-500 hover:text-blue-400 transition-colors">
                                                        <EditIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => onDeleteBowserRefill(refill.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {recentRefills.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-gray-500 italic">No refill history found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


const FuelManagement: React.FC<FuelManagementProps> = ({
    vehicles, prices, bowsers, bowserRefills, onSubmitSingle, onSetPrice, onAddBowser, onAddBowserRefill, 
    availableBranches, onFileUpload, onConnectSheet, isSheetConnected, onSyncNow, isSyncing = false
}) => {
    const { showModal, hideModal, showToast } = useUIState();
    const { otherCosts, handleBulkAddOtherCosts, handleBulkAddFuelEntries, handleUpdateBowserRefill, handleDeleteBowserRefill } = useVehicles();

    const handleBulkSubmit = (entries: Omit<FuelEntry, 'id'>[]) => {
        handleBulkAddFuelEntries(entries);
        showToast(`Bulk fuel upload successful (${entries.length} entries).`);
    };

    const openCostImport = () => {
        showModal('bulkImportCosts', {
            vehicles,
            onImport: (costs: any[]) => {
                handleBulkAddOtherCosts(costs);
                hideModal();
                showToast("Expenses imported successfully.");
            },
            onClose: hideModal
        });
    };

    const openQuickBooksSync = () => {
        showModal('quickbooksSync', {
            vehicles,
            onSync: (costs: any[]) => {
                handleBulkAddOtherCosts(costs);
                hideModal();
                showToast("QuickBooks sync completed.");
            },
            onClose: hideModal
        });
    };

    const recentCosts = useMemo(() => {
        return (otherCosts || []).slice(0, 10).sort((a: OtherCost, b: OtherCost) => b.date.localeCompare(a.date));
    }, [otherCosts]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white px-2">Costing Controls</h3>
                <div className="flex items-center gap-2">
                    <button onClick={onConnectSheet} className={`flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 rounded-xl border transition-all ${isSheetConnected ? 'text-emerald-400 border-emerald-500/20' : 'text-gray-400 border-gray-700'}`}>
                        <LinkIcon className="h-4 w-4 mr-2" /> {isSheetConnected ? 'Connected' : 'Live Sheet'}
                    </button>
                    <button onClick={openQuickBooksSync} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-[#2ca01c] rounded-xl border border-[#2ca01c]/20 transition-all">
                        <RefreshIcon className="h-4 w-4 mr-2" /> Sync QuickBooks
                    </button>
                    <button onClick={openCostImport} className="flex items-center px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-xl border border-blue-500/20 transition-all">
                        <UploadIcon className="h-4 w-4 mr-2" /> Import Expenses
                    </button>
                </div>
            </div>

            <FuelFillingForm
                vehicles={vehicles}
                onSubmitSingle={onSubmitSingle}
                onSubmitBulk={handleBulkSubmit}
                isSheetConnected={isSheetConnected}
                onSyncNow={onSyncNow}
                onConnectSheet={onConnectSheet}
                availableBranches={availableBranches}
                isSyncing={isSyncing}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <FuelPriceManagement
                    prices={prices}
                    onSetPrice={onSetPrice}
                />
                
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold text-white mb-4">Recent General Costs</h2>
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-400">
                                    <th className="p-2">Date</th>
                                    <th className="p-2">Asset</th>
                                    <th className="p-2">Category</th>
                                    <th className="p-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentCosts.map((cost: any) => (
                                    <tr key={cost.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                        <td className="p-2 font-mono">{cost.date}</td>
                                        <td className="p-2 font-bold text-blue-400">{vehicles.find(v => v.id === cost.vehicleId)?.registration || 'N/A'}</td>
                                        <td className="p-2 text-gray-300">{cost.category}</td>
                                        <td className="p-2 text-right font-mono text-red-400">R {cost.amount.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {recentCosts.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">No recent expenses logged.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <BowserManagement 
                bowsers={bowsers}
                bowserRefills={bowserRefills}
                onAddBowser={onAddBowser}
                onAddBowserRefill={onAddBowserRefill}
                onUpdateBowserRefill={handleUpdateBowserRefill}
                onDeleteBowserRefill={handleDeleteBowserRefill}
            />
        </div>
    );
};

export default FuelManagement;