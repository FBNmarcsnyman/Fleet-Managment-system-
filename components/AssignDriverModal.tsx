import React, { useState } from 'react';
import { Vehicle } from '../types';
import { useVehicles, useUIState } from '../contexts/AppContexts';
import { formatRegistration } from '../lib/vehicleRegistration';

interface AssignDriverModalProps {
    vehicle: Vehicle;
    onCancel: () => void;
}

// Assign an operational driver (from the `drivers` table — NOT login users) to a
// vehicle. Assignment is stored on the driver (assignedVehicleId), which is what
// the fleet list reads, and persists to Supabase. You can also add a new driver
// on the spot. Trailers don't use this (they're pulled by different units).
const AssignDriverModal: React.FC<AssignDriverModalProps> = ({ vehicle, onCancel }) => {
    const { drivers = [], handleUpdateDriver } = useVehicles() as any;
    const { showModal, showToast } = useUIState();
    const currentlyAssigned = (drivers as any[]).find(d => d.assignedVehicleId === vehicle?.id);
    const [selectedDriverId, setSelectedDriverId] = useState<string>(currentlyAssigned?.id || '');
    const [saving, setSaving] = useState(false);

    if (!vehicle) return <div className="p-4 text-slate-700">No vehicle selected.</div>;

    const availableDrivers = (drivers as any[])
        .filter(d => d.isActive !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Clear the previous driver on this vehicle if it changed.
            if (currentlyAssigned && currentlyAssigned.id !== selectedDriverId) {
                await handleUpdateDriver(currentlyAssigned.id, { assignedVehicleId: null });
            }
            if (selectedDriverId && selectedDriverId !== currentlyAssigned?.id) {
                const res = await handleUpdateDriver(selectedDriverId, { assignedVehicleId: vehicle.id });
                if (res && res.ok === false) { showToast(`Could not assign: ${res.error || 'error'}`); setSaving(false); return; }
            }
            showToast('Driver assignment saved.');
            onCancel();
        } catch (err) { showToast(`Could not save: ${err instanceof Error ? err.message : 'error'}`); }
        finally { setSaving(false); }
    };

    const addNew = () => showModal('addDriver', { presetVehicleId: vehicle.id });

    const inputClasses = "w-full bg-white text-slate-800 p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f5b700]";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">Assign Driver</h2>
            <p className="text-slate-500 mb-6">Select a driver for vehicle <strong className="text-slate-900">{vehicle.name} ({formatRegistration(vehicle.registration)})</strong>.</p>

            {availableDrivers.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">No drivers on file yet — add one below.</p>
            )}
            <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)} className={inputClasses}>
                <option value="">-- Unassigned --</option>
                {availableDrivers.map((driver: any) => (
                    <option key={driver.id} value={driver.id}>{driver.name}{driver.cell ? ` — ${driver.cell}` : ''}</option>
                ))}
            </select>
            <button type="button" onClick={addNew} className="mt-2 text-sm font-bold text-[#13294b] hover:underline">+ Add a new driver</button>

            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={onCancel} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg">{saving ? 'Saving…' : 'Save Assignment'}</button>
            </div>
        </form>
    );
};

export default AssignDriverModal;
