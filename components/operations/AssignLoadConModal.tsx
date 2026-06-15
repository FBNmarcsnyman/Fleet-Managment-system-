
import React, { useState, useMemo } from 'react';
import { LoadConfirmation, Vehicle, User, Supplier, Branch } from '../../types';
import { useOperations, useUIState, useVehicles } from '../../contexts/AppContexts';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';

interface AssignLoadConModalProps {
    loadCon: LoadConfirmation;
    onCancel: () => void;
}

const AssignLoadConModal: React.FC<AssignLoadConModalProps> = ({ loadCon, onCancel }) => {
    const { suppliers, loadConfirmations = [], handleUpdateLoadConfirmation } = useOperations();
    const { vehicles, users, drivers = [] } = useVehicles();
    const { hideModal, showToast } = useUIState();

    // Subcontractor-first: internal-fleet local collections are archived for now,
    // so assignment defaults to (and only shows) the subcontractor flow.
    const [assignmentType, setAssignmentType] = useState<'internal' | 'subcontractor'>('subcontractor');
    
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

    // Drivers come from the drivers table (fleet list, no login needed) plus any
    // staff/driver users. We don't hard-filter by branch — that left the list
    // empty; we sort the load's branch to the top instead. Value = the driver's
    // name (driver_id is free text and displays as the name everywhere).
    const driverOptions = useMemo(() => {
        const opts: { key: string; label: string; value: string; branch?: string }[] = [];
        (drivers || []).filter((d: any) => d.isActive !== false).forEach((d: any) => {
            opts.push({ key: `d-${d.id}`, label: d.cell ? `${d.name} — ${d.cell}` : d.name, value: d.name, branch: d.branch });
        });
        (users || []).filter((u: any) => u.role === 'Staff' || u.role === 'Driver').forEach((u: any) => {
            if (!opts.some(o => o.value.toLowerCase() === (u.name || '').toLowerCase())) {
                opts.push({ key: `u-${u.email}`, label: u.name, value: u.name });
            }
        });
        const branch = loadCon.collectionBranch;
        return opts.sort((a, b) => {
            const aHit = a.branch === branch ? 0 : 1;
            const bHit = b.branch === branch ? 0 : 1;
            return aHit - bHit || a.label.localeCompare(b.label);
        });
    }, [drivers, users, loadCon.collectionBranch]);

    // When an internal vehicle is picked, auto-fill the driver linked to it.
    const onVehicleChange = (vid: string) => {
        setVehicleId(vid);
        const linked = (drivers || []).find((d: any) => d.assignedVehicleId === vid);
        if (linked && !driverId) setDriverId(linked.name);
    };

    const transportSuppliers = useMemo(() => 
        (suppliers || []).filter((s: Supplier) => s.type === 'Transport')
    , [suppliers]);

    const selectedSupplier = useMemo(() => 
        transportSuppliers.find((s: Supplier) => s.id === supplierId)
    , [supplierId, transportSuppliers]);

    const isNonCompliant = selectedSupplier?.complianceStatus !== 'Compliant';

    // Lane rate history: what we've paid carriers on this same lane before.
    const laneHistory = useMemo(() => {
        const lane = (loadCon.route || `${loadCon.collectionPoint || ''}→${loadCon.deliveryPoint || ''}`).toLowerCase().trim();
        return (loadConfirmations || [])
            .filter((o: LoadConfirmation) => o.id !== loadCon.id && (o.supplierRate || 0) > 0 &&
                ((o.route || `${o.collectionPoint || ''}→${o.deliveryPoint || ''}`).toLowerCase().trim() === lane))
            .sort((a: LoadConfirmation, b: LoadConfirmation) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 4);
    }, [loadConfirmations, loadCon]);
    const laneAvg = laneHistory.length ? laneHistory.reduce((s: number, o: LoadConfirmation) => s + (o.supplierRate || 0), 0) / laneHistory.length : 0;

    const [saving, setSaving] = useState(false);

    const handleInternalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId || !driverId) {
            alert('Please select both a vehicle and a driver.');
            return;
        }
        setSaving(true);
        const res = await handleUpdateLoadConfirmation(loadCon.id, {
            vehicleId,
            driverId,
            collectionDate: new Date(collectionDate).toISOString(),
            status: loadCon.status === 'Booked' ? 'Driver Assigned' : loadCon.status,
            supplierId: undefined, // Clear subcontractor info if moving to internal
            supplierRate: undefined
        });
        setSaving(false);
        if (res && res.ok === false) { showToast(`Could not assign: ${res.error}`); return; }
        showToast(`Load ${loadCon.loadConNumber} assigned to internal fleet.`);
        hideModal();
    };

    const handleSubbieSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId || !supplierRate) {
            alert('Please select a supplier and enter the agreed buy-rate.');
            return;
        }
        setSaving(true);
        // Non-compliant carriers are ALLOWED (so ops isn't blocked), but the load
        // gets flagged to management automatically via the live alerts.

        // Auto-populate the LoadCon document fields from the chosen subcontractor
        // (company, controller + email) so the LoadCon is ready to send to them —
        // no need to re-enter the details that are already on the supplier record.
        const primaryContact = selectedSupplier?.contacts?.[0];
        const subEmail = primaryContact?.email || selectedSupplier?.contactEmail || '';
        const subAttention = primaryContact?.name || selectedSupplier?.contactPerson || '';

        try {
            const res = await handleUpdateLoadConfirmation(loadCon.id, {
                supplierId,
                supplierRate: parseFloat(supplierRate),
                subcontractorName: selectedSupplier?.name,
                subcontractorEmail: subEmail || undefined,
                forAttention: subAttention || undefined,
                subcontractorVehicleReg: subVehicleReg,
                subcontractorDriverName: subDriverName,
                subcontractorDriverCell: subDriverCell,
                status: loadCon.status === 'Booked' ? 'Driver Assigned' : loadCon.status,
                vehicleId: undefined, // Clear internal fleet info if moving to subbie
                driverId: undefined
            });
            if (res && res.ok === false) { showToast(`Could not assign: ${res.error}`); return; }
            showToast(`Load ${loadCon.loadConNumber} assigned to ${selectedSupplier?.name}.${isNonCompliant ? ' ⚠ Flagged — carrier not compliant.' : ' LoadCon ready to send.'}`);
            hideModal();
        } catch (err) {
            showToast(`Could not assign: ${err instanceof Error ? err.message : 'error'}`);
        } finally {
            setSaving(false);
        }
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

            {assignmentType === 'internal' ? (
                <form onSubmit={handleInternalSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Internal Vehicle</label>
                            <select value={vehicleId} onChange={e => onVehicleChange(e.target.value)} required className={inputClasses}>
                                <option value="" disabled>-- Select Asset --</option>
                                {availableVehicles.map(v => <option key={v.id} value={v.id}>{v.registration} ({v.weightCategory})</option>)}
                            </select>
                            {availableVehicles.length === 0 && <p className="text-[10px] text-red-400 mt-1 ml-1 font-bold">No assets available for branch {loadCon.collectionBranch}</p>}
                        </div>
                        <div>
                            <label className={labelClasses}>Assigned Driver</label>
                             <select value={driverId} onChange={e => setDriverId(e.target.value)} required className={inputClasses}>
                                <option value="" disabled>-- Select Driver --</option>
                                {driverOptions.map(d => <option key={d.key} value={d.value}>{d.label}</option>)}
                            </select>
                            {driverOptions.length === 0 && <p className="text-[10px] text-amber-400 mt-1 ml-1 font-bold">No drivers yet — add them under Fleet → Drivers.</p>}
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>Scheduled Collection Date</label>
                        <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} required className={inputClasses} />
                    </div>
                    <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-700">
                        <button type="button" onClick={onCancel} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-white transition-colors">Cancel</button>
                        <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-2.5 px-8 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider text-xs">{saving ? 'Saving…' : 'Confirm Dispatch'}</button>
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
                            {supplierId && isNonCompliant && (
                                <div className="mt-2 flex items-start gap-2 bg-amber-900/30 border border-amber-700/60 rounded-lg p-2.5">
                                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-300 font-semibold">
                                        {selectedSupplier?.name} is <strong>{selectedSupplier?.complianceStatus}</strong>. You can still use them — the load will be flagged to management to chase paperwork.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>Supplier Rate (ZAR)</label>
                                <input type="number" value={supplierRate} onChange={e => setSupplierRate(e.target.value)} required className={inputClasses} placeholder="0.00" />
                                {laneHistory.length > 0 && (
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Lane avg <strong className="text-blue-300">R {Math.round(laneAvg).toLocaleString('en-ZA')}</strong> · last: {laneHistory.map((o: any) => `R${Math.round(o.supplierRate).toLocaleString('en-ZA')}`).join(', ')}</p>
                                )}
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
                        <button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black py-2.5 px-8 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider text-xs">{saving ? 'Saving…' : 'Confirm Subcontractor'}</button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default AssignLoadConModal;