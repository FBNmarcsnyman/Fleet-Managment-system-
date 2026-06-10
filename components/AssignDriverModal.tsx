import React, { useState } from 'react';
import { Vehicle } from '../types';
import { useAuth, useVehicles } from '../contexts/AppContexts';
import { formatRegistration } from '../lib/vehicleRegistration';

interface AssignDriverModalProps {
    vehicle: Vehicle;
    onCancel: () => void;
}

const AssignDriverModal: React.FC<AssignDriverModalProps> = ({ vehicle, onCancel }) => {
    const { users, handleAssignDriverToVehicle } = useVehicles();
    const [selectedDriverId, setSelectedDriverId] = useState(vehicle.assignedDriverId || '');

    const availableDrivers = users
        .filter((u: any) => u.role === 'Driver' || u.role === 'Staff')
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleAssignDriverToVehicle(vehicle.id, selectedDriverId || null);
        onCancel();
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Assign Driver</h2>
            <p className="text-gray-400 mb-6">Select a driver for vehicle <strong className="text-white">{vehicle.name} ({formatRegistration(vehicle.registration)})</strong>.</p>
            
            <select
                value={selectedDriverId}
                onChange={e => setSelectedDriverId(e.target.value)}
                className={inputClasses}
            >
                <option value="">-- Unassigned --</option>
                {availableDrivers.map((driver: any) => (
                    <option key={driver.email} value={driver.email}>{driver.name}</option>
                ))}
            </select>

            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Save Assignment</button>
            </div>
        </form>
    );
};

export default AssignDriverModal;