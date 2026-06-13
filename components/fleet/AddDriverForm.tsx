import React, { useState } from 'react';
import { Driver } from '../../types';
import { useUIState, useVehicles } from '../../contexts/AppContexts';
import { BRANCHES } from '../../constants';

// Add / edit a driver, or bulk-add several at once (one "Name, Cell" per line).
const AddDriverForm: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { vehicles = [], handleAddDriver, handleUpdateDriver, handleBulkAddDrivers } = useVehicles();
    const editing: Driver | undefined = modal.payload?.driver;
    const bulk: boolean = !!modal.payload?.bulk;

    const [name, setName] = useState(editing?.name || '');
    const [cell, setCell] = useState(editing?.cell || '');
    const [licenceNo, setLicenceNo] = useState(editing?.licenceNo || '');
    const [licenceCode, setLicenceCode] = useState(editing?.licenceCode || '');
    const [licenceExpiry, setLicenceExpiry] = useState(editing?.licenceExpiry || '');
    const [pdpExpiry, setPdpExpiry] = useState(editing?.pdpExpiry || '');
    const [assignedVehicleId, setAssignedVehicleId] = useState(editing?.assignedVehicleId || '');
    const [branch, setBranch] = useState(editing?.branch || '');
    const [isActive, setIsActive] = useState(editing?.isActive !== false);
    const [bulkText, setBulkText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const inputCls = "w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary text-sm";
    const labelCls = "block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1";

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            if (bulk) {
                const rows = bulkText.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
                    const [n, c] = line.split(',').map(s => s.trim());
                    return { name: n, cell: c || '', isActive: true };
                }).filter(r => r.name);
                if (rows.length === 0) { showToast('Add at least one driver (one per line).'); return; }
                const res = await handleBulkAddDrivers(rows);
                if (!res.ok) { showToast(`Could not add drivers: ${res.error}`); return; }
                hideModal();
                showToast(`Added ${res.count} driver(s).`);
                return;
            }
            if (!name.trim()) { showToast('Driver name is required.'); return; }
            const payload = { name: name.trim(), cell, licenceNo, licenceCode, licenceExpiry, pdpExpiry, assignedVehicleId: assignedVehicleId || undefined, branch, isActive };
            if (editing) {
                const res = await handleUpdateDriver(editing.id, payload);
                if (!res.ok) { showToast(`Could not update driver: ${res.error}`); return; }
                hideModal();
                showToast(`Driver "${name}" updated.`);
            } else {
                const res = await handleAddDriver(payload);
                if (!res.ok) { showToast(`Could not add driver: ${res.error}`); return; }
                hideModal();
                showToast(`Driver "${name}" added.`);
            }
        } catch (err) {
            showToast(`Could not save: ${err instanceof Error ? err.message : 'unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (bulk) {
        return (
            <form onSubmit={submit}>
                <h2 className="text-2xl font-bold mb-2 text-white">Bulk Add Drivers</h2>
                <p className="text-sm text-gray-400 mb-4">One driver per line, as <span className="text-gray-200 font-semibold">Name, Cell</span> (cell optional).</p>
                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={10} className={inputCls} placeholder={"Thabo Nkosi, 082 123 4567\nSipho Dlamini, 083 555 1212\nJohn Smith"} />
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">{submitting ? 'Adding…' : 'Add Drivers'}</button>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={submit}>
            <h2 className="text-2xl font-bold mb-6 text-white">{editing ? 'Edit' : 'Add'} Driver</h2>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Name *</label><input value={name} onChange={e => setName(e.target.value)} required className={inputCls} /></div>
                    <div><label className={labelCls}>Cell</label><input value={cell} onChange={e => setCell(e.target.value)} className={inputCls} placeholder="for POD / tracking" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Licence No</label><input value={licenceNo} onChange={e => setLicenceNo(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Licence Code</label><input value={licenceCode} onChange={e => setLicenceCode(e.target.value)} className={inputCls} placeholder="e.g. EC" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Licence Expiry</label><input type="date" value={licenceExpiry} onChange={e => setLicenceExpiry(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>PDP Expiry</label><input type="date" value={pdpExpiry} onChange={e => setPdpExpiry(e.target.value)} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Assigned Vehicle</label>
                        <select value={assignedVehicleId} onChange={e => setAssignedVehicleId(e.target.value)} className={inputCls}>
                            <option value="">-- None --</option>
                            {(vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registration}</option>)}
                        </select>
                    </div>
                    <div><label className={labelCls}>Branch</label>
                        <select value={branch} onChange={e => setBranch(e.target.value)} className={inputCls}>
                            <option value="">-- None --</option>
                            {BRANCHES.map((b: string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active</label>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">{submitting ? 'Saving…' : (editing ? 'Save Changes' : 'Add Driver')}</button>
            </div>
        </form>
    );
};

export default AddDriverForm;
