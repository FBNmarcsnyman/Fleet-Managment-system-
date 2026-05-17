import React, { useState, useMemo } from 'react';
import { Vehicle } from '../types';

interface LinkTrailerModalProps {
    truck: Vehicle;
    allVehicles: Vehicle[];
    onLink: (truckId: string, trailerId: string) => void;
    onCancel: () => void;
}

const LinkTrailerModal: React.FC<LinkTrailerModalProps> = ({ truck, allVehicles = [], onLink, onCancel }) => {
    const [selectedTrailerId, setSelectedTrailerId] = useState('');

    const availableTrailers = useMemo(() => {
        const safeVehicles = allVehicles || [];
        const linkedVehicleIds = new Set(safeVehicles.map(v => v.linkedVehicleId).filter(Boolean));
        return safeVehicles.filter(v =>
            v.weightCategory.toLowerCase().includes('trailer') &&
            v.status === 'On the road' &&
            !v.linkedVehicleId &&
            !linkedVehicleIds.has(v.id)
        );
    }, [allVehicles]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTrailerId) {
            alert('Please select a trailer to link.');
            return;
        }
        onLink(truck.id, selectedTrailerId);
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Link Trailer</h2>
            <p className="text-gray-400 mb-6">Select an available trailer to link to <strong className="text-white">{truck.registration}</strong>.</p>
            <select
                value={selectedTrailerId}
                onChange={e => setSelectedTrailerId(e.target.value)}
                className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            >
                <option value="" disabled>-- Select Trailer --</option>
                {availableTrailers.map(trailer => (
                    <option key={trailer.id} value={trailer.id}>{trailer.registration} ({trailer.name})</option>
                ))}
            </select>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Link Trailer</button>
            </div>
        </form>
    );
};

export default LinkTrailerModal;