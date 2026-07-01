import React, { useState } from 'react';
import { useAuth, useUIState } from '../contexts/AppContexts';
import { supabase, runWrite } from '../lib/supabase';
import { TAB_SECTIONS, tabKey } from '../lib/tabCatalog';

// Super-Admin screen: hide/show any section's tabs for a role, optionally for one depot.
// Writes section-namespaced keys to role_tab_visibility (role + branch). Each user's
// effective hidden set is computed in AuthContext (myHiddenTabs) and applied per portal.
// Super Admin + Manager see all tabs (not restricted here). Admin is the limited role.
const ROLES = ['Admin', 'Ops', 'Staff', 'Workshop Manager', 'Accounts'];
const BRANCHES = [{ v: '', l: 'All depots' }, { v: 'DBN', l: 'DBN only' }, { v: 'JHB', l: 'JHB only' }, { v: 'CPT', l: 'CPT only' }];

const RoleTabAccess: React.FC = () => {
    const { roleHiddenTabs, currentUser } = useAuth();
    const { showToast } = useUIState();
    const [role, setRole] = useState('Ops');
    const [branch, setBranch] = useState('');
    const [busy, setBusy] = useState(false);

    if (currentUser?.role !== 'Super Admin') return null;

    const hidden: string[] = roleHiddenTabs?.[`${role}|${branch}`] || [];

    const toggle = async (section: string, view: string) => {
        const key = tabKey(section, view);
        const cur = roleHiddenTabs?.[`${role}|${branch}`] || [];
        const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
        setBusy(true);
        const { error } = await runWrite(() => (supabase.from as any)('role_tab_visibility')
            .upsert({ role, branch, hidden: next, updated_at: new Date().toISOString() }, { onConflict: 'role,branch' }));
        setBusy(false);
        if (error) { showToast(`Could not save: ${error.message}`); return; }
        window.dispatchEvent(new Event('role-tabs-changed'));
        showToast(`${next.includes(key) ? 'Hid' : 'Restored'} "${view}" for ${role}${branch ? ` · ${branch}` : ''}`);
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-8">
            <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 className="text-lg font-black text-[#13294b]">Tab Access</h3>
                <select value={role} onChange={e => setRole(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 py-1.5">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={branch} onChange={e => setBranch(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 py-1.5" title="Apply to the whole role, or just one depot">
                    {BRANCHES.map(b => <option key={b.v} value={b.v}>{b.l}</option>)}
                </select>
                {busy && <span className="text-xs text-slate-400">saving…</span>}
            </div>
            <p className="text-xs text-slate-500 mb-4">Click a tab to hide/show it for <b>{role}{branch ? ` · ${branch}` : ' (all depots)'}</b>. Green = visible, grey = hidden. Admins always see everything. Depot rules add on top of the “all depots” baseline.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {TAB_SECTIONS.map(sec => (
                    <div key={sec.key}>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{sec.label}</p>
                        <div className="flex flex-wrap gap-2">
                            {sec.tabs.map(t => {
                                const isHidden = hidden.includes(tabKey(sec.key, t.view));
                                return (
                                    <button key={t.view} disabled={busy} onClick={() => toggle(sec.key, t.view)}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border disabled:opacity-50 ${isHidden ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
                                        {isHidden ? '✕ ' : '✓ '}{t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RoleTabAccess;
