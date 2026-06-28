import React, { useState } from 'react';
import { ServiceEntry } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import DateField from './operations/DateField';

interface AddServiceEntryFormProps {
    onSubmit: (entry: Omit<ServiceEntry, 'id' | 'vehicleId'>) => void;
    onCancel: () => void;
}

const AddServiceEntryForm: React.FC<AddServiceEntryFormProps> = ({ onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [odometer, setOdometer] = useState('');
    const [hours, setHours] = useState('');
    const [description, setDescription] = useState('');
    const [cost, setCost] = useState('');
    const [attachment, setAttachment] = useState<{ name: string; type: string; data: string; } | undefined>();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setAttachment({
                    name: file.name,
                    type: file.type,
                    data: event.target?.result as string,
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !description || !cost) {
            alert('Please fill all required fields');
            return;
        }
        if (!odometer && !hours) {
            alert('Please provide either an odometer reading or an hours reading.');
            return;
        }
        onSubmit({
            date,
            startOdometer: odometer ? parseFloat(odometer) : 0,
            endOdometer: odometer ? parseFloat(odometer) : 0,
            startHours: hours ? parseFloat(hours) : undefined,
            endHours: hours ? parseFloat(hours) : undefined,
            description,
            cost: parseFloat(cost),
            attachment,
        });
    };
    
    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Service Record</h2>
            <div className="space-y-4">
                <DateField value={date} onChange={setDate} className={inputClasses} />
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Odometer at Service" value={odometer} onChange={e => setOdometer(e.target.value)} className={inputClasses} />
                    <input type="number" placeholder="Hours at Service" value={hours} onChange={e => setHours(e.target.value)} className={inputClasses} />
                </div>
                <input type="text" placeholder="Service Description" value={description} onChange={e => setDescription(e.target.value)} className={inputClasses} />
                <input type="number" placeholder="Total Cost (R)" value={cost} onChange={e => setCost(e.target.value)} step="0.01" className={inputClasses} />
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Attach Invoice (Optional)</label>
                    <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-700 rounded-md border-2 border-dashed border-gray-500 cursor-pointer hover:border-brand-secondary">
                        <UploadIcon className="h-6 w-6 text-gray-400 mr-2" />
                        <span className="text-gray-400">{attachment ? attachment.name : 'Click to upload'}</span>
                        <input type="file" onChange={handleFileChange} className="hidden" />
                    </label>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Add Record</button>
            </div>
        </form>
    );
};

export default AddServiceEntryForm;