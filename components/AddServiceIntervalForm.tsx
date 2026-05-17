import React, { useState } from 'react';
import { ServiceInterval } from '../types';

interface AddServiceIntervalFormProps {
    onSubmit: (interval: Omit<ServiceInterval, 'id' | 'vehicleId'>) => void;
    onCancel: () => void;
}

const AddServiceIntervalForm: React.FC<AddServiceIntervalFormProps> = ({ onSubmit, onCancel }) => {
    const [description, setDescription] = useState('');
    const [distance, setDistance] = useState('');
    const [time, setTime] = useState('');
    const [hours, setHours] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || (!distance && !time && !hours)) {
            alert('Please provide a description and at least one interval (distance, time, or hours).');
            return;
        }
        onSubmit({
            description,
            distanceInterval: distance ? parseInt(distance, 10) : null,
            timeIntervalDays: time ? parseInt(time, 10) : null,
            hoursInterval: hours ? parseInt(hours, 10) : null,
        });
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Service Interval</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Service Description (e.g., Minor Service)" value={description} onChange={e => setDescription(e.target.value)} className={inputClasses} required />
                <input type="number" placeholder="Distance Interval (km)" value={distance} onChange={e => setDistance(e.target.value)} className={inputClasses} />
                <input type="number" placeholder="Time Interval (days)" value={time} onChange={e => setTime(e.target.value)} className={inputClasses} />
                <input type="number" placeholder="Hours Interval" value={hours} onChange={e => setHours(e.target.value)} className={inputClasses} />
            </div>
             <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Interval</button>
            </div>
        </form>
    );
};

export default AddServiceIntervalForm;