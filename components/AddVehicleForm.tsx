
import React, { useState, useEffect } from 'react';
import { Vehicle, Branch, VehicleStatus } from '../types';
import { BRANCHES } from '../constants';

interface AddVehicleFormProps {
    vehicleData?: Vehicle;
    onSubmit: (vehicle: Omit<Vehicle, 'id' | 'currentValue'>) => void;
    onCancel: () => void;
}

const VEHICLE_CATEGORIES = [
    'Horse',
    'Standard Trailer',
    'Superlink Trailer',
    '8 TONNER',
    '12 TONNER',
    '15 TONNER',
    '1 TONNER',
    '2 TONNER',
    'BAKKIE',
    'Forklift',
    'Other'
];

const VEHICLE_STATUSES: VehicleStatus[] = ['On the road', 'In for service', 'Off the road', 'Sold'];

const AddVehicleForm: React.FC<AddVehicleFormProps> = ({ vehicleData, onSubmit, onCancel }) => {
    const [name, setName] = useState(vehicleData?.name || '');
    const [make, setMake] = useState(vehicleData?.make || '');
    const [model, setModel] = useState(vehicleData?.model || '');
    const [year, setYear] = useState(vehicleData?.year || new Date().getFullYear());
    const [registration, setRegistration] = useState(vehicleData?.registration || '');
    const [vin, setVin] = useState(vehicleData?.vin || '');
    const [branch, setBranch] = useState<Branch>(vehicleData?.branch || BRANCHES[0]);
    const [weightCategory, setWeightCategory] = useState(vehicleData?.weightCategory || VEHICLE_CATEGORIES[0]);
    const [purchasePrice, setPurchasePrice] = useState(vehicleData?.purchasePrice || 0);
    const [status, setStatus] = useState<VehicleStatus>(vehicleData?.status || 'On the road');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            name,
            make,
            model,
            year,
            registration,
            vin,
            branch,
            weightCategory,
            status,
            purchasePrice,
            currentHours: vehicleData?.currentHours,
            assignedDriverId: vehicleData?.assignedDriverId,
            linkedVehicleId: vehicleData?.linkedVehicleId,
        });
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all";
    const labelClasses = "block text-sm font-medium text-gray-400 mb-1 ml-1";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">{vehicleData ? `Edit ${vehicleData.registration}` : 'Add New Asset'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="col-span-2 md:col-span-1">
                    <label className={labelClasses}>Asset Name / Code</label>
                    <input type="text" placeholder="e.g. JHB-TRUCK-42" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                </div>
                <div className="col-span-2 md:col-span-1">
                    <label className={labelClasses}>Registration Number</label>
                    <input type="text" placeholder="e.g. JHB 123 GP" value={registration} onChange={e => setRegistration(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Make</label>
                    <input type="text" placeholder="e.g. Scania" value={make} onChange={e => setMake(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Model</label>
                    <input type="text" placeholder="e.g. R460" value={model} onChange={e => setModel(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Year</label>
                    <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>VIN Number</label>
                    <input type="text" placeholder="Full VIN" value={vin} onChange={e => setVin(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Operating Branch</label>
                    <select value={branch} onChange={e => setBranch(e.target.value as any)} className={inputClasses}>
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClasses}>Asset Category</label>
                    <select value={weightCategory} onChange={e => setWeightCategory(e.target.value)} className={inputClasses}>
                        {VEHICLE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClasses}>Current Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as VehicleStatus)} className={inputClasses}>
                        {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClasses}>Purchase Price (R)</label>
                    <input type="number" placeholder="0" value={purchasePrice} onChange={e => setPurchasePrice(parseFloat(e.target.value))} required className={inputClasses} />
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8 pt-4 border-t border-gray-700">
                <button type="button" onClick={onCancel} className="px-6 py-2 text-gray-400 hover:text-white font-semibold">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2.5 px-8 rounded-lg shadow-lg transition-all active:scale-95">
                    {vehicleData ? 'Update Asset' : 'Register Asset'}
                </button>
            </div>
        </form>
    );
};

export default AddVehicleForm;
