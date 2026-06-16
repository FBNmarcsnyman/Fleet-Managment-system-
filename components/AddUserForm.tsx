import React, { useState } from 'react';
import { User, Role, Branch } from '../types';
import { BRANCHES } from '../constants';

interface AddUserFormProps {
    onSubmit: (user: Omit<User, 'permissions' | 'assignedVehicleIds' | 'clientId' | 'supplierId'>) => void | Promise<any>;
    onCancel: () => void;
}

const AddUserForm: React.FC<AddUserFormProps> = ({ onSubmit, onCancel }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('Staff');
    const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
    const [licenseNumber, setLicenseNumber] = useState('');
    const [licenseExpiry, setLicenseExpiry] = useState('');
    const [pdpExpiry, setPdpExpiry] = useState('');
    const [emailError, setEmailError] = useState('');

    const handleBranchChange = (branch: Branch) => {
        setAssignedBranches(prev => 
            prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
        );
    };

    const validateEmail = (value: string) => {
        if (!value.toLowerCase().includes('@')) {
            setEmailError('Please enter a valid email address.');
        } else {
            setEmailError('');
        }
        setEmail(value);
    };

    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (emailError || !name || !email) {
            alert('Please fill all required fields correctly.');
            return;
        }
        setSaving(true);
        await onSubmit({
            name,
            email,
            role,
            assignedBranches,
            licenseNumber: role === 'Staff' ? licenseNumber : undefined,
            licenseExpiry: role === 'Staff' ? licenseExpiry : undefined,
            pdpExpiry: role === 'Staff' ? pdpExpiry : undefined,
        });
        setSaving(false);
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add New User</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className={inputClasses} required />
                <div>
                    <input type="email" placeholder="user@example.com" value={email} onChange={e => validateEmail(e.target.value)} className={`${inputClasses} ${emailError ? 'border-red-500' : ''}`} required />
                    {emailError && <p className="text-red-400 text-sm mt-1">{emailError}</p>}
                </div>
                <select value={role} onChange={e => setRole(e.target.value as Role)} className={inputClasses}>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Ops">Ops</option>
                    <option value="Workshop Manager">Workshop</option>
                    <option value="Staff">Staff (Driver)</option>
                </select>
                {role !== 'Staff' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Assigned Branches</label>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {BRANCHES.map(branch => (
                                <label key={branch} className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={assignedBranches.includes(branch)}
                                        onChange={() => handleBranchChange(branch)}
                                        className="form-checkbox h-5 w-5 text-brand-primary bg-gray-600 border-gray-500 rounded focus:ring-brand-secondary"
                                    />
                                    <span className="text-gray-300">{branch}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
                 {role === 'Staff' && (
                    <>
                        <input type="text" placeholder="License Number" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className={inputClasses} />
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="licenseExpiry" className="block text-sm font-medium text-gray-300 mb-1">License Expiry</label>
                                <input id="licenseExpiry" type="date" value={licenseExpiry} onChange={e => setLicenseExpiry(e.target.value)} className={inputClasses} />
                            </div>
                            <div>
                                <label htmlFor="pdpExpiry" className="block text-sm font-medium text-gray-300 mb-1">PDP Expiry</label>
                                <input id="pdpExpiry" type="date" value={pdpExpiry} onChange={e => setPdpExpiry(e.target.value)} className={inputClasses} />
                            </div>
                        </div>
                    </>
                )}
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Cancel</button>
                <button type="submit" disabled={saving} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:opacity-60">{saving ? 'Adding…' : 'Add User'}</button>
            </div>
        </form>
    );
};

export default AddUserForm;