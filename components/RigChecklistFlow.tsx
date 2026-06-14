import React, { useMemo, useState } from 'react';
import { Vehicle, User, ChecklistTemplate } from '../types';
import PerformChecklistForm from './PerformChecklistForm';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

// Given any unit a driver scanned (truck OR a trailer), work out the whole rig:
// the horse (truck) plus every trailer linked to it. Handles links recorded in
// either direction and de-dupes.
export const getRigUnits = (start: Vehicle, all: Vehicle[]): Vehicle[] => {
    const horse = start.linkedVehicleId ? (all.find(v => v.id === start.linkedVehicleId) || start) : start;
    const trailers = all.filter(v => v.linkedVehicleId === horse.id);
    const extra = horse.linkedVehicleId ? all.filter(v => v.id === horse.linkedVehicleId) : [];
    const ordered = [horse, ...trailers, ...extra];
    return ordered.filter((u, i, a) => a.findIndex(z => z.id === u.id) === i);
};

interface RigChecklistFlowProps {
    startVehicle: Vehicle;
    user: User;
    vehicles: Vehicle[];
    templates: ChecklistTemplate[];
    onSubmitUnit: (data: any, user: User) => Promise<any>;
    onDone: () => void;
    onCancel: () => void;
}

// Runs the daily checklist across every unit of a rig, one section at a time
// (e.g. Horse → 6m trailer → 12m trailer). Each unit is submitted on its own,
// so failures/damages raise job cards against the right unit.
const RigChecklistFlow: React.FC<RigChecklistFlowProps> = ({ startVehicle, user, vehicles, templates, onSubmitUnit, onDone, onCancel }) => {
    const units = useMemo(() => getRigUnits(startVehicle, vehicles), [startVehicle, vehicles]);
    const [i, setI] = useState(0);
    const [doneIds, setDoneIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const unit = units[i];

    const handleUnitSubmit = async (data: any) => {
        if (saving) return;
        setSaving(true);
        const res = await onSubmitUnit(data, user);
        setSaving(false);
        if (res && res.ok === false) { alert(`Could not submit ${unit.name}: ${res.error || 'unknown error'}`); return; }
        setDoneIds(prev => [...prev, unit.id]);
        setI(prev => prev + 1);
    };

    return (
        <div className="bg-gray-900 min-h-screen py-6 px-3">
            <div className="max-w-5xl mx-auto">
                {/* Rig progress header */}
                <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="text-lg font-black text-white">Daily Rig Checklist</h1>
                        <span className="text-xs text-gray-400">{Math.min(i, units.length)} / {units.length} done · {user.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {units.map((u, idx) => {
                            const done = doneIds.includes(u.id);
                            const active = idx === i;
                            return (
                                <div key={u.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${done ? 'bg-emerald-900/40 text-emerald-300' : active ? 'bg-blue-600 text-white' : 'bg-gray-700/50 text-gray-400'}`}>
                                    {done && <CheckCircleIcon className="h-4 w-4" />}
                                    {u.registration} <span className="opacity-60">({u.weightCategory})</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {unit ? (
                    <PerformChecklistForm
                        key={unit.id}
                        vehicle={unit}
                        currentUser={user}
                        templates={templates}
                        onSubmit={handleUnitSubmit}
                        onCancel={onCancel}
                        isStandalonePage
                    />
                ) : (
                    <div className="bg-gray-800 rounded-xl p-10 text-center border border-gray-700">
                        <CheckCircleIcon className="h-14 w-14 text-emerald-400 mx-auto mb-3" />
                        <h2 className="text-2xl font-black text-white mb-1">Rig checklist complete</h2>
                        <p className="text-gray-400 mb-6">{units.length} unit{units.length !== 1 ? 's' : ''} checked. Any faults have been sent to the workshop.</p>
                        <button onClick={onDone} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2.5 px-8 rounded-xl">Done</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RigChecklistFlow;
