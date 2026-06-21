import React, { useMemo } from 'react';
import { Driver } from '../../types';
import { useUIState, useVehicles } from '../../contexts/AppContexts';
import { PlusIcon } from '../icons/PlusIcon';

// Days until a date string; null if no date.
const daysUntil = (d?: string): number | null => {
    if (!d) return null;
    const ms = new Date(d).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const ExpiryPill: React.FC<{ label: string; date?: string }> = ({ label, date }) => {
    const days = daysUntil(date);
    if (days === null) return <span className="text-gray-600 text-xs">—</span>;
    const color = days < 0 ? 'bg-red-900/40 text-red-300' : days < 30 ? 'bg-amber-900/40 text-amber-300' : 'bg-gray-700/50 text-gray-300';
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${color}`}>{label} {days < 0 ? `expired` : `${days}d`}</span>;
};

const DriversManagementView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { drivers = [], vehicles = [], handleDeleteDriver } = useVehicles();

    const handleDelete = async (d: Driver) => {
        if (!confirm(`Delete driver ${d.name}? This cannot be undone.`)) return;
        const res = await handleDeleteDriver(d.id);
        if (!res.ok) showToast(`Could not delete: ${res.error}`); else showToast(`${d.name} deleted.`);
    };

    const vehicleReg = useMemo(() => {
        const m = new Map<string, string>();
        (vehicles || []).forEach((v: any) => m.set(v.id, v.registration));
        return m;
    }, [vehicles]);

    const sorted = useMemo(() => [...(drivers || [])].sort((a: Driver, b: Driver) => a.name.localeCompare(b.name)), [drivers]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white">Drivers</h3>
                    <p className="text-xs text-gray-500 mt-1">Operational driver list — used for dispatch and POD/tracking. No login required.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => showModal('addDriver', { bulk: true })} className="flex items-center font-bold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm">Bulk Add</button>
                    <button onClick={() => showModal('addDriver')} className="flex items-center font-bold py-2 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white">
                        <PlusIcon className="h-5 w-5 mr-2" /> Add Driver
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-400">Name</th>
                            <th className="p-2 text-gray-400">Cell</th>
                            <th className="p-2 text-gray-400">Assigned Vehicle</th>
                            <th className="p-2 text-gray-400">Branch</th>
                            <th className="p-2 text-gray-400">Licence / PDP</th>
                            <th className="p-2 text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((d: Driver) => (
                            <tr key={d.id} className="border-b border-gray-700/50">
                                <td className="p-2 font-semibold text-white">{d.name}{d.isActive === false && <span className="ml-2 text-[10px] text-gray-500">(inactive)</span>}</td>
                                <td className="p-2 text-gray-300">{d.cell || '—'}</td>
                                <td className="p-2 text-gray-300">{d.assignedVehicleId ? (vehicleReg.get(d.assignedVehicleId) || '—') : '—'}</td>
                                <td className="p-2 text-gray-300">{d.branch || '—'}</td>
                                <td className="p-2 space-x-1"><ExpiryPill label="Lic" date={d.licenceExpiry} /> <ExpiryPill label="PDP" date={d.pdpExpiry} /></td>
                                <td className="p-2 text-right space-x-2">
                                    <button onClick={() => showModal('driverDocs', { driver: d })} className="px-3 py-1 rounded bg-gray-700 hover:bg-emerald-600 text-white text-xs font-bold">Docs</button>
                                    <button onClick={() => showModal('addDriver', { driver: d })} className="px-3 py-1 rounded bg-gray-700 hover:bg-brand-secondary text-white text-xs font-bold">Edit</button>
                                    <button onClick={() => handleDelete(d)} className="px-3 py-1 rounded bg-gray-700 hover:bg-red-600 text-white text-xs font-bold">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {sorted.length === 0 && (
                            <tr><td colSpan={6} className="p-6 text-center text-gray-500">No drivers yet. Add them here, then assign them to loads in Operations → Assign Dispatch.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DriversManagementView;
