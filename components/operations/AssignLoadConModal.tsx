
import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Vehicle, User, Supplier, Branch } from '../../types';
import { useOperations, useUIState, useVehicles } from '../../contexts/AppContexts';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';
import { TruckIcon } from '../icons/TruckIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

interface AssignLoadConModalProps {
    loadCon: LoadConfirmation;
    onCancel: () => void;
}

const AssignLoadConModal: React.FC<AssignLoadConModalProps> = ({ loadCon, onCancel }) => {
    const { suppliers, handleUpdateLoadConfirmation } = useOperations();
    const { vehicles, users } = useVehicles();
    const { hideModal, showToast } = useUIState();

    const [assignmentType, setAssignmentType] = useState<'internal' | 'subcontractor'>(loadCon.supplierId ? 'subcontractor' : 'internal');
    
    // Internal State
    const [vehicleId, setVehicleId] = useState(loadCon.vehicleId || '');
    const [driverId, setDriverId] = useState(loadCon.driverId || '');
    const [collectionDate, setCollectionDate] = useState(loadCon.collectionDate?.split('T')[0] || new Date().toISOString().split('T')[0]);

    // Subcontractor State
    const [supplierId, setSupplierId] = useState(loadCon.supplierId || '');
    const [supplierRate, setSupplierRate] = useState(loadCon.supplierRate?.toString() || '');
    const [subVehicleReg, setSubVehicleReg] = useState(loadCon.subcontractorVehicleReg || '');
    const [subDriverName, setSubDriverName] = useState(loadCon.subcontractorDriverName || '');
    const [subDriverCell, setSubDriverCell] = useState(loadCon.subcontractorDriverCell || '');

    // Filtering logic based on Load's collection branch
    // Robustness: Include both 'Staff' and 'Driver' roles as they are used interchangeably for operations.
    // If branch is LOADMASTER, show assets from JHB and DBN as they service the hub.
    const availableVehicles = useMemo(() => {
        const allVehicles = vehicles || [];
        return allVehicles.filter(v => {
            const isStatusOk = v.status === 'On the road';
            const isBranchOk = v.branch === loadCon.collectionBranch || 
                               (loadCon.collectionBranch === 'LOADMASTER' && (v.branch === 'FBN JHB' || v.branch === 'FBN DBN'));
            return isStatusOk && isBranchOk;
        });
    }, [vehicles, loadCon.collectionBranch]);

    const availableDrivers = useMemo(() => {
        const allUsers = users || [];
        return allUsers.filter(u => {
            const isDriverRole = u.role === 'Staff' || u.role === 'Driver';
            const isBranchOk = u.assignedBranches.length === 0 || 
                               u.assignedBranches.includes(loadCon.collectionBranch as Branch) ||
                               (loadCon.collectionBranch === 'LOADMASTER' && (u.assignedBranches.includes('FBN JHB') || u.assignedBranches.includes('FBN DBN')));
            return isDriverRole && isBranchOk;
        });
    }, [users, loadCon.collectionBranch]);

    const transportSuppliers = useMemo(() => 
        (suppliers || []).filter((s: Supplier) => s.type === 'Transport')
    , [suppliers]);

    const selectedSupplier = useMemo(() => 
        transportSuppliers.find((s: Supplier) => s.id === supplierId)
    , [supplierId, transportSuppliers]);

    const isNonCompliant = selectedSupplier?.complianceStatus !== 'Compliant';

    const handleInternalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId || !driverId) {
            alert('Please select both a vehicle and a driver.');
            return;
        }
        
        handleUpdateLoadConfirmation(loadCon.id, {
            vehicleId,
            driverId,
            collectionDate: new Date(collectionDate).toISOString(),
            status: 'Driver Assigned',
            supplierId: undefined, // Clear subcontractor info if moving to internal
            supplierRate: undefined
        });
        
        showToast(`Load ${loadCon.loadConNumber} assigned to internal fleet.`);
        hideModal();
    };

    const handleSubbieSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId || !supplierRate) {
            alert('Please select a supplier and enter the agreed buy-rate.');
            return;
        }
        if (isNonCompliant) {
            alert('Cannot assign load to a non-compliant supplier. Please update their credentials first.');
            return;
        }

        handleUpdateLoadConfirmation(loadCon.id, { 
            supplierId, 
            supplierRate: parseFloat(supplierRate),
            subcontractorVehicleReg: subVehicleReg,
            subcontractorDriverName: subDriverName,
            subcontractorDriverCell: subDriverCell,
            status: 'Driver Assigned',
            vehicleId: undefined, // Clear internal fleet info if moving to subbie
            driverId: undefined
        });
        
        showToast(`Load ${loadCon.loadConNumber} assigned to ${selectedSupplier?.name}.`);
        hideModal();
    };

    const inputClasses = "w-full bg-gray-700 text-white p-2.5 rounded-lg border border-gray-600 focus:ring-1 focus:ring-blue-500 outline-none text-sm";
    const labelClasses = "block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1";

    const marginAmount = loadCon.totalAmount - (parseFloat(supplierRate) || 0);
    const marginPercent = loadCon.totalAmount > 0 ? (marginAmount / loadCon.totalAmount) * 100 : 0;

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-black text-white leading-tight">Assign Dispatch</h2>
                <p className="text-gray-500 text-xs font-mono uppercase tracking-tighter mt-1">{loadCon.loadConNumber} | {loadCon.collectionPoint} → {loadCon.deliveryPoint}</p>
            </header>

            <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-700/50">
                <button 
                    onClick={() => setAssignmentType('internal')} 
                    className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${assignmentType === 'internal' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <TruckIcon className="h-4 w-4 mr-2" /> Internal Fleet
                </button>
                <button 
                    onClick={() => setAssignmentType('subcontractor')} 
                    className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${assignmentType === 'subcontractor' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <CheckCircleIcon className="h-4 w-4 mr-2" /> Subcontractor
                </button>
            </div>

            {assignmentType === 'internal' ? (
                <form onSubmit={handleInternalSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Internal Vehicle</label>
                            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} required className={inputClasses}>
                                <option value="" disabled>-- Select Asset --</option>
                                {availableVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.weightCategory})</option>)}
                            </select>
                            {availableVehicles.length === 0 && <p className="text-[10px] text-red-400 mt-1 ml-1 font-bold">No assets available for branch {loadCon.collectionBranch}</p>}
                        </div>
                        <div>
                            <label className={labelClasses}>Assigned Driver</label>
                             <select value={driverId} onChange={e => setDriverId(e.target.value)} required className={inputClasses}>
                                <option value="" disabled>-- Select Driver --</option>
                                {availableDrivers.map(d => <option key={d.email} value={d.email}>{d.name}</option>)}
                            </select>
                            {availableDrivers.length === 0 && <p className="text-[10px] text-red-400 mt-1 ml-1 font-bold">No drivers available for branch {loadCon.collectionBranch}</p>}
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>Scheduled Collection Date</label>
                        <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} required className={inputClasses} />
                    </div>
                    <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-700">
                        <button type="button" onClick={onCancel} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-white transition-colors">Cancel</button>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-8 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider text-xs">Confirm Dispatch</button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleSubbieSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Select Subcontractor</label>
                            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required className={inputClasses}>
                                <option value="" disabled>-- Select a carrier --</option>
                                {transportSuppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.complianceStatus})</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>Supplier Rate (ZAR)</label>
                                <input type="number" value={supplierRate} onChange={e => setSupplierRate(e.target.value)} required className={inputClasses} placeholder="0.00" />
                            </div>
                            <div>
                                <label className={labelClasses}>Margin</label>
                                <div className={`p-2.5 rounded-lg border ${marginPercent < 10 ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-green-400'} text-sm font-bold`}>
                                    {marginAmount.toLocaleString()} ({marginPercent.toFixed(1)}%)
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClasses}>Subbie Vehicle Reg</label>
                                <input type="text" value={subVehicleReg} onChange={e => setSubVehicleReg(e.target.value)} required className={inputClasses} placeholder="ABC 123 GP" />
                            </div>
                            <div>
                                <label className={labelClasses}>Driver Name</label>
                                <input type="text" value={subDriverName} onChange={e => setSubDriverName(e.target.value)} required className={inputClasses} placeholder="John Doe" />
                            </div>
                            <div>
                                <label className={labelClasses}>Driver Cell</label>
                                <input type="tel" value={subDriverCell} onChange={e => setSubDriverCell(e.target.value)} required className={inputClasses} placeholder="082..." />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-700">
                        <button type="button" onClick={onCancel} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-white transition-colors">Cancel</button>
                        <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-black py-2.5 px-8 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider text-xs">Confirm Subcontractor</button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default AssignLoadConModal;