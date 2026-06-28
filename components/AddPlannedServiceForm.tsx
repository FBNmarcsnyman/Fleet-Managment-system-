import React, { useState } from 'react';
import { PlannedService, Vehicle } from '../types';
import DateField from './operations/DateField';

interface AddPlannedServiceFormProps {
    vehicles: Vehicle[];
    onSubmit: (service: Omit<PlannedService, 'id'>) => void;
    onCancel: () => void;
}

const AddPlannedServiceForm: React.FC<AddPlannedServiceFormProps> = ({ vehicles, onSubmit, onCancel }) => {
    const [vehicleId, setVehicleId] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicleId || !description || !startDate || !endDate) {
            alert('Please fill all fields.');
            return;
        }
        onSubmit({ vehicleId, description, startDate, endDate });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Plan New Service</h2>
            <div className="space-y-4">
                <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className={inputClasses}>
                    <option value="">-- Select Vehicle --</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration})</option>)}
                </select>
                <input type="text" placeholder="Service Description (e.g., Major Service)" value={description} onChange={e => setDescription(e.target.value)} className={inputClasses} />
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                        <DateField value={startDate} onChange={setStartDate} className={inputClasses} />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">End Date</label>
                        <DateField value={endDate} onChange={setEndDate} className={inputClasses} />
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Schedule Service</button>
            </div>
        </form>
    );
};

export default AddPlannedServiceForm;
