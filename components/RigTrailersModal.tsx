import React, { useMemo, useState } from 'react';
import { Vehicle } from '../types';
import { useUIState, useVehicles } from '../contexts/AppContexts';

// Assign a truck's trailers (supports a superlink's 6m + 12m). Tick the trailers
// that run on this horse; they become sections in the rig's daily checklist.
const RigTrailersModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { vehicles = [], handleSetRigTrailers } = useVehicles();
    const truck: Vehicle | undefined = modal.payload?.truck;
    const [selected, setSelected] = useState<string[]>(
        (vehicles || []).filter((v: Vehicle) => v.linkedVehicleId === truck?.id).map((v: Vehicle) => v.id)
    );
    const [saving, setSaving] = useState(false);

    // Trailers that are free, or already on this truck.
    const trailers = useMemo(() =>
        (vehicles || []).filter((v: Vehicle) =>
            (v.weightCategory || '').toLowerCase().includes('trailer') &&
            (!v.linkedVehicleId || v.linkedVehicleId === truck?.id)
        ), [vehicles, truck]);

    if (!truck) return <div className="p-4 text-white">No truck selected.</div>;

    const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const save = async () => {
        if (saving) return;
        setSaving(true);
        const res = await handleSetRigTrailers(truck.id, selected);
        setSaving(false);
        if (!res.ok) { showToast(`Could not save rig: ${res.error}`); return; }
        hideModal();
        showToast(`Rig updated for ${truck.registration} (${selected.length} trailer${selected.length !== 1 ? 's' : ''}).`);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-1 text-white">Rig Trailers</h2>
            <p className="text-sm text-gray-400 mb-4">Pick the trailers that run on <strong className="text-white">{truck.registration}</strong> ({truck.name}). For a superlink, tick both the 6m and 12m.</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {trailers.map((t: Vehicle) => (
                    <label key={t.id} className="flex items-center gap-3 bg-gray-700/50 hover:bg-gray-700 p-3 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="h-5 w-5" />
                        <span className="font-semibold text-white">{t.registration}</span>
                        <span className="text-gray-400 text-sm">{t.name} · {t.weightCategory}</span>
                    </label>
                ))}
                {trailers.length === 0 && <p className="text-gray-500 text-sm py-6 text-center">No available trailers. Add trailers as assets in Fleet first.</p>}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
                <button onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button onClick={save} disabled={saving} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">{saving ? 'Saving…' : 'Save Rig'}</button>
            </div>
        </div>
    );
};

export default RigTrailersModal;
