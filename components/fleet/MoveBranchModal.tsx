import React, { useState } from 'react';
import { Vehicle, Branch } from '../../types';
import { useVehicles } from '../../contexts/AppContexts';
import { BRANCHES } from '../../constants';

interface MoveBranchModalProps {
    vehicle: Vehicle;
    onSuccess: () => void;
    onCancel: () => void;
}

const MoveBranchModal: React.FC<MoveBranchModalProps> = ({ vehicle, onSuccess, onCancel }) => {
    const { handleUpdateVehicle } = useVehicles();
    const [newBranch, setNewBranch] = useState<Branch>(vehicle.branch);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleUpdateVehicle(vehicle.id, { branch: newBranch });
        onSuccess();
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Move Asset</h2>
            <p className="text-gray-400 mb-6">
                Move <strong className="text-white">{vehicle.name} ({vehicle.registration})</strong> to a new branch.
            </p>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">New Branch</label>
                <select
                    value={newBranch}
                    onChange={e => setNewBranch(e.target.value as Branch)}
                    className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                >
                    {BRANCHES.map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                    ))}
                </select>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Move Asset</button>
            </div>
        </form>
    );
};

export default MoveBranchModal;