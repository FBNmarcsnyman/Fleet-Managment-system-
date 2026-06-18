import React, { useEffect, useState } from 'react';
import { directSelect, directUpdate } from '../lib/supabase';

// Super-Admin matrix: for each role, tick which modules (left-nav tabs) are
// visible. Saved straight to the DB; every user of that role inherits it
// (unless they have a per-user override set on their profile). Admins & Super
// Admins always see everything in code, so their rows are shown as full access.
const MODULES: { key: string; label: string }[] = [
    { key: 'access_management', label: 'Management' },
    { key: 'access_fleet', label: 'FBN Fleet' },
    { key: 'access_fuel', label: 'Fuel' },
    { key: 'access_operations', label: 'Broking / Clients / Quotes' },
    { key: 'access_workshop', label: 'Workshop' },
    { key: 'access_finance', label: 'Finance' },
    { key: 'access_incidents', label: 'Incidents' },
    { key: 'access_hr', label: 'HR' },
    { key: 'access_user_management', label: 'Users' },
    { key: 'access_settings', label: 'Settings' },
];

// Roles you actually configure here (Admin/Super Admin are full-access by design).
const EDITABLE: { role: string; label: string }[] = [
    { role: 'Accounts', label: 'Accounts' },
    { role: 'Ops', label: 'Ops' },
    { role: 'Workshop Manager', label: 'Workshop' },
    { role: 'Staff', label: 'Staff (Driver)' },
];

const RoleAccessMatrix: React.FC = () => {
    const [perms, setPerms] = useState<Record<string, string[]>>({});
    const [loaded, setLoaded] = useState(false);
    const [savingRole, setSavingRole] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data } = await directSelect('role_permissions?select=role,permissions');
            const map: Record<string, string[]> = {};
            if (Array.isArray(data)) data.forEach((r: any) => { map[r.role] = Array.isArray(r.permissions) ? r.permissions : []; });
            setPerms(map);
            setLoaded(true);
        })();
    }, []);

    const toggle = async (role: string, key: string) => {
        const cur = perms[role] || [];
        const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
        setPerms(p => ({ ...p, [role]: next }));       // optimistic
        setSavingRole(role);
        const { error } = await directUpdate('role_permissions', { role }, { permissions: next });
        setSavingRole(null);
        if (error) {
            setPerms(p => ({ ...p, [role]: cur }));     // revert on failure
            alert(`Could not save ${role}: ${error.message}`);
            return;
        }
        // Tell AuthContext to re-read so visibility updates immediately.
        window.dispatchEvent(new Event('role-permissions-changed'));
    };

    if (!loaded) return <div className="text-gray-400 p-4">Loading role access…</div>;

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-5 mt-8">
            <h3 className="text-xl font-bold text-white mb-1">Role Access</h3>
            <p className="text-xs text-gray-400 mb-4">Tick which sections each role can see. Changes save instantly. Admin &amp; Super Admin always have full access. (A user can be given a custom set on their own Edit screen, which overrides their role.)</p>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="p-2 text-gray-300">Module</th>
                            {EDITABLE.map(r => <th key={r.role} className="p-2 text-center text-gray-300 whitespace-nowrap">{r.label}{savingRole === r.role && <span className="text-emerald-400 text-[10px] ml-1">saving…</span>}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {MODULES.map(m => (
                            <tr key={m.key} className="border-b border-gray-700/50">
                                <td className="p-2 text-gray-200 font-medium">{m.label}</td>
                                {EDITABLE.map(r => {
                                    const on = (perms[r.role] || []).includes(m.key);
                                    return (
                                        <td key={r.role} className="p-2 text-center">
                                            <button onClick={() => toggle(r.role, m.key)}
                                                className={`w-9 h-6 rounded-full transition relative ${on ? 'bg-emerald-500' : 'bg-gray-600'}`}
                                                title={on ? 'Visible — click to hide' : 'Hidden — click to show'}>
                                                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RoleAccessMatrix;
