import React, { useState } from 'react';
import { User, Role, Branch } from '../types';
import { BRANCHES } from '../constants';
import { useCommonData } from '../contexts/AppContexts';
import { directUpdate } from '../lib/supabase';
import DateField from './operations/DateField';

const ACCESS_MODULES: { key: string; label: string }[] = [
    { key: 'access_management', label: 'Management' },
    { key: 'access_fleet', label: 'FBN Fleet' },
    { key: 'access_fuel', label: 'Fuel' },
    { key: 'access_operations', label: 'Broking / Clients / Quotes' },
    { key: 'access_loadcons', label: 'Floor team — LoadCons + Operations boards (Dashboard/Day/Shipments/Daily), their branch only' },
    { key: 'access_workshop', label: 'Workshop' },
    { key: 'access_finance', label: 'Finance' },
    { key: 'access_incidents', label: 'Incidents' },
    { key: 'access_hr', label: 'HR' },
    { key: 'access_user_management', label: 'Users' },
    { key: 'access_settings', label: 'Settings' },
];

interface EditUserFormProps {
    user: User;
    onClose: () => void;
}

// Edit an existing team member (name, role, branches, active) and optionally
// reset their password. Uses the secure admin-update-user edge function.
const EditUserForm: React.FC<EditUserFormProps> = ({ user, onClose }) => {
    const { handleUpdateUser } = useCommonData();
    const [name, setName] = useState(user.name || '');
    const [role, setRole] = useState<Role>(user.role);
    const [assignedBranches, setAssignedBranches] = useState<Branch[]>(user.assignedBranches || []);
    const [isActive, setIsActive] = useState((user as any).isActive !== false);
    const [licenseNumber, setLicenseNumber] = useState(user.licenseNumber || '');
    const [licenseExpiry, setLicenseExpiry] = useState(user.licenseExpiry || '');
    const [pdpExpiry, setPdpExpiry] = useState(user.pdpExpiry || '');
    const [doResetPassword, setDoResetPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    // Per-user override: a non-empty permissions list overrides the role defaults.
    const [customAccess, setCustomAccess] = useState((user.permissions || []).length > 0);
    const [perms, setPerms] = useState<string[]>((user.permissions as string[]) || []);
    const togglePerm = (k: string) => setPerms(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

    const toggleBranch = (b: Branch) =>
        setAssignedBranches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

    const inputCls = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        if (!name.trim()) { alert('Name is required.'); return; }
        setSaving(true);
        const updates: any = {
            name: name.trim(), role, assignedBranches, isActive,
            licenseNumber: role === 'Staff' ? licenseNumber : undefined,
            licenseExpiry: role === 'Staff' ? licenseExpiry : undefined,
            pdpExpiry: role === 'Staff' ? pdpExpiry : undefined,
        };
        const res = await handleUpdateUser(user, updates, doResetPassword ? { resetPassword: true, newPassword: newPassword || undefined } : undefined);
        // Persist the per-user access override directly (empty = inherit role).
        const finalPerms = (role === 'Super Admin' || role === 'Admin') ? [] : (customAccess ? perms : []);
        await directUpdate('profiles', { id: user.id }, { permissions: finalPerms as any });
        setSaving(false);
        if (!res.ok) { alert(`Could not update the user: ${res.error || 'unknown error'}`); return; }
        if (res.tempPassword) {
            alert(`Saved.\n\nNew password for ${user.email}:\n${res.tempPassword}\n\nShare it with them — they can change it after logging in.`);
        }
        onClose();
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-1 text-white">Edit User</h2>
            <p className="text-sm text-gray-400 mb-5">{user.email}</p>
            <div className="space-y-4">
                <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
                <select value={role} onChange={e => setRole(e.target.value as Role)} className={inputCls}>
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
                            {BRANCHES.map(b => (
                                <label key={b} className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={assignedBranches.includes(b)} onChange={() => toggleBranch(b)} className="form-checkbox h-5 w-5 text-brand-primary bg-gray-600 border-gray-500 rounded" />
                                    <span className="text-gray-300">{b}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
                {role === 'Staff' && (
                    <>
                        <input type="text" placeholder="Licence Number" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className={inputCls} />
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm text-gray-300 mb-1">Licence Expiry</label><DateField value={licenseExpiry} onChange={setLicenseExpiry} className={inputCls} /></div>
                            <div><label className="block text-sm text-gray-300 mb-1">PDP Expiry</label><DateField value={pdpExpiry} onChange={setPdpExpiry} className={inputCls} /></div>
                        </div>
                    </>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-5 w-5" />
                    Active (can log in and work)
                </label>

                {role !== 'Super Admin' && role !== 'Admin' && (
                    <div className="border-t border-gray-700 pt-4">
                        <label className="flex items-center gap-2 text-sm text-gray-200">
                            <input type="checkbox" checked={customAccess} onChange={e => setCustomAccess(e.target.checked)} className="h-5 w-5" />
                            Custom access for this person (overrides their role's defaults)
                        </label>
                        {customAccess && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {ACCESS_MODULES.map(m => (
                                    <label key={m.key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                        <input type="checkbox" checked={perms.includes(m.key)} onChange={() => togglePerm(m.key)} className="h-4 w-4" />
                                        {m.label}
                                    </label>
                                ))}
                            </div>
                        )}
                        {!customAccess && <p className="text-xs text-gray-500 mt-1">Leaving this off means they see whatever their role ({role}) is set to in Role Access.</p>}
                    </div>
                )}

                <div className="border-t border-gray-700 pt-4">
                    <label className="flex items-center gap-2 text-sm text-gray-200">
                        <input type="checkbox" checked={doResetPassword} onChange={e => setDoResetPassword(e.target.checked)} className="h-5 w-5" />
                        Reset this user's password
                    </label>
                    {doResetPassword && (
                        <input type="text" placeholder="New password (leave blank to auto-generate)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`${inputCls} mt-2`} />
                    )}
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
        </form>
    );
};

export default EditUserForm;
