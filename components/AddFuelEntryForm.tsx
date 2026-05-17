
import React, { useState } from 'react';
import { FuelEntry } from '../types';

interface AddFuelEntryFormProps {
    onSubmit: (entry: Omit<FuelEntry, 'id' | 'vehicleId'>) => void;
    onCancel: () => void;
}

const AddFuelEntryForm: React.FC<AddFuelEntryFormProps> = ({ onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [odometer, setOdometer] = useState('');
    const [liters, setLiters] = useState('');
    const [tripDistance, setTripDistance] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !odometer || !liters) {
             alert('Please fill all fields');
            return;
        }
        onSubmit({
            date,
            odometer: parseFloat(odometer),
            liters: parseFloat(liters),
            tripDistance: tripDistance ? parseFloat(tripDistance) : undefined,
        });
    };

    const renderInput = (id: string, label: string, type: string, value: string, onChange: (val: string) => void) => (
         <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
            <input 
                id={id}
                type={type} 
                value={value} 
                onChange={e => onChange(e.target.value)} 
                className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary" 
                step={type === 'number' ? '0.01' : undefined}
            />
        </div>
    );

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Fuel Entry</h2>
            <div className="space-y-4">
                {renderInput("date", "Date", "date", date, setDate)}
                {renderInput("odometer", "Odometer (km)", "number", odometer, setOdometer)}
                {renderInput("liters", "Fuel (Liters)", "number", liters, setLiters)}
                {renderInput("tripDistance", "Trip Distance (km) - Optional", "number", tripDistance, setTripDistance)}
            </div>
             <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Add Entry</button>
            </div>
        </form>
    );
};

export default AddFuelEntryForm;
