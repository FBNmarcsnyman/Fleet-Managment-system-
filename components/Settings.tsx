
import React, { useState, useMemo, useEffect } from 'react';
import { NOTIFICATION_TRIGGERS } from '../constants';
import { useAuth, useUIState } from '../contexts/AppContexts';
import { directSelect, directUpdate } from '../lib/supabase';
import { loadBranchConfig } from '../lib/branchConfig';
import { loadEmailRecipients } from '../lib/emailRecipients';
import { ALL_NAV_ITEMS } from './shared/navConfig';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';
import { EyeIcon } from './icons/EyeIcon';
import { EyeSlashIcon } from './icons/EyeSlashIcon';

const Settings: React.FC = () => {
    const { currentUser, updateNavPreferences, hasPermission } = useAuth();
    const { showToast } = useUIState();

    // Branch routing config (Super-Admin) — ops inbox + depot address per branch. These
    // feed load/collection routing, manifests and inter-branch emails via lib/branchConfig.
    const isSuperAdmin = currentUser?.role === 'Super Admin';
    const [branches, setBranches] = useState<any[]>([]);
    const [savingId, setSavingId] = useState<string | null>(null);
    useEffect(() => {
        if (!isSuperAdmin) return;
        directSelect('branches?select=id,code,name,email,address&order=code.asc').then(({ data }: any) => { if (Array.isArray(data)) setBranches(data); });
    }, [isSuperAdmin]);
    const setBranchField = (id: string, field: 'email' | 'address', value: string) =>
        setBranches(bs => bs.map(b => b.id === id ? { ...b, [field]: value } : b));
    const saveBranch = async (b: any) => {
        setSavingId(b.id);
        const { error } = await directUpdate('branches', { id: b.id }, { email: (b.email || '').trim() || null, address: (b.address || '').trim() || null } as any);
        if (error) showToast(`Could not save ${b.code}: ${error.message}`);
        else { await loadBranchConfig(); showToast(`${b.code} routing saved — applies everywhere now.`); }
        setSavingId(null);
    };

    // Standing email CC recipients (Super-Admin) — the fixed department addresses that
    // are CC'd on system emails. Editable here; applied via lib/emailRecipients. Each row
    // notes which emails it covers so this screen doubles as the "what do we send" list.
    const CC_GROUPS: { key: 'cc_loadcons' | 'cc_ops' | 'cc_debtors'; label: string; covers: string }[] = [
        { key: 'cc_loadcons', label: 'LoadCons monitoring', covers: 'CC on every LoadCon, Client Order, amended LoadCon, and POD request/chase.' },
        { key: 'cc_ops', label: 'Ops general', covers: 'CC on status / phase updates, POD emails, ETA changes, inter-branch handover.' },
        { key: 'cc_debtors', label: 'Accounts / debtors', covers: 'CC on proforma invoices and carrier-invoice notifications.' },
    ];
    const [ccSettings, setCcSettings] = useState<Record<string, string>>({});
    const [ccSaving, setCcSaving] = useState(false);
    useEffect(() => {
        if (!isSuperAdmin) return;
        directSelect('email_settings?id=eq.1&select=cc_loadcons,cc_ops,cc_debtors').then(({ data }: any) => {
            const row = Array.isArray(data) ? data[0] : data;
            if (row) setCcSettings({ cc_loadcons: row.cc_loadcons || '', cc_ops: row.cc_ops || '', cc_debtors: row.cc_debtors || '' });
        });
    }, [isSuperAdmin]);
    const saveCc = async () => {
        setCcSaving(true);
        const { error } = await directUpdate('email_settings', { id: '1' }, {
            cc_loadcons: (ccSettings.cc_loadcons || '').trim() || null,
            cc_ops: (ccSettings.cc_ops || '').trim() || null,
            cc_debtors: (ccSettings.cc_debtors || '').trim() || null,
        } as any);
        if (error) showToast(`Could not save recipients: ${error.message}`);
        else { await loadEmailRecipients(); showToast('Email recipients saved — applied to new emails now.'); }
        setCcSaving(false);
    };

    const allowedTabs = useMemo(() => {
        const baseAllowed = ALL_NAV_ITEMS.filter(item => hasPermission(item.permission));
        const prefs = currentUser?.navigationPreferences;
        
        if (!prefs) return baseAllowed;

        // Ensure all currently allowed items are represented in the order
        const currentOrder = [...prefs.order];
        baseAllowed.forEach(item => {
            if (!currentOrder.includes(item.view)) {
                currentOrder.push(item.view);
            }
        });

        // Filter out items that are no longer allowed (e.g. permission changed)
        const finalOrder = currentOrder.filter(view => baseAllowed.some(item => item.view === view));

        return finalOrder.map(view => baseAllowed.find(item => item.view === view)!);
    }, [currentUser, hasPermission]);

    const handleReorder = (index: number, direction: 'up' | 'down') => {
        if (!currentUser) return;
        const newOrder = allowedTabs.map(t => t.view);
        const item = newOrder[index];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;

        newOrder.splice(index, 1);
        newOrder.splice(targetIndex, 0, item);

        updateNavPreferences({
            order: newOrder,
            hidden: currentUser.navigationPreferences?.hidden || []
        });
    };

    const handleToggleVisibility = (view: any) => {
        if (!currentUser) return;
        const hidden = currentUser.navigationPreferences?.hidden || [];
        const newHidden = hidden.includes(view) 
            ? hidden.filter(v => v !== view) 
            : [...hidden, view];

        updateNavPreferences({
            order: allowedTabs.map(t => t.view),
            hidden: newHidden
        });
    };

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white mb-6">Settings</h2>
            
            {/* Nav Personalization */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-2">Workspace Personalization</h3>
                <p className="text-gray-400 text-sm mb-6">Customize the order and visibility of your navigation tabs. Changes are saved to your profile immediately.</p>
                
                <div className="space-y-2">
                    {allowedTabs.map((item, index) => {
                        const isHidden = currentUser?.navigationPreferences?.hidden.includes(item.view);
                        return (
                            <div key={item.view} className={`flex items-center justify-between p-3 rounded-xl border ${isHidden ? 'bg-gray-900/40 border-gray-800 opacity-60' : 'bg-gray-700/40 border-gray-700'}`}>
                                <div className="flex items-center space-x-4">
                                    <div className="p-2 bg-gray-800 rounded-lg">
                                        <item.icon className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <span className="font-semibold text-white">{item.label}</span>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <button 
                                        disabled={index === 0}
                                        onClick={() => handleReorder(index, 'up')}
                                        className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-md disabled:opacity-0 transition-all"
                                    >
                                        <ArrowUpIcon className="h-4 w-4" />
                                    </button>
                                    <button 
                                        disabled={index === allowedTabs.length - 1}
                                        onClick={() => handleReorder(index, 'down')}
                                        className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded-md disabled:opacity-0 transition-all"
                                    >
                                        <ArrowDownIcon className="h-4 w-4" />
                                    </button>
                                    <div className="w-px h-4 bg-gray-700 mx-2"></div>
                                    <button 
                                        onClick={() => handleToggleVisibility(item.view)}
                                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isHidden ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'}`}
                                    >
                                        {isHidden ? <EyeSlashIcon className="h-4 w-4 mr-2" /> : <EyeIcon className="h-4 w-4 mr-2" />}
                                        {isHidden ? 'Hidden' : 'Visible'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4">Notification Rules</h3>
                <div className="space-y-4">
                    {NOTIFICATION_TRIGGERS.map(trigger => (
                        <div key={trigger.key} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
                            <p className="text-gray-200">{trigger.label}</p>
                            <select className="bg-gray-600 p-2 rounded-md text-sm">
                                <option>Workshop Manager</option>
                                <option>Admin</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {/* Branch routing — Super-Admin edits the ops inbox + depot address per branch.
                One source of truth (branches table via lib/branchConfig); applies everywhere. */}
            {isSuperAdmin && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-1">Branch Routing</h3>
                    <p className="text-gray-400 text-sm mb-4">The ops inbox and depot address for each branch — used for load/collection routing, manifests and inter-branch handover emails. Changes apply everywhere immediately (no code needed).</p>
                    <div className="space-y-3">
                        {branches.length === 0 && <p className="text-gray-500 text-sm">Loading branches…</p>}
                        {branches.map(b => (
                            <div key={b.id} className="bg-gray-700/40 border border-gray-700 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-white">{b.code} <span className="text-gray-400 font-normal text-sm">· {b.name}</span></span>
                                    <button onClick={() => saveBranch(b)} disabled={savingId === b.id} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-1.5 px-4 rounded-lg">{savingId === b.id ? 'Saving…' : 'Save'}</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ops inbox email</label>
                                        <input type="email" value={b.email || ''} onChange={e => setBranchField(b.id, 'email', e.target.value)} placeholder="ops@fbn-transport.co.za" className="w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm" style={{ textTransform: 'none' }} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Depot address</label>
                                        <input value={b.address || ''} onChange={e => setBranchField(b.id, 'address', e.target.value)} placeholder="Street, suburb, city" className="w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Standing email recipients (Super-Admin) — the fixed department CCs on system emails. */}
            {isSuperAdmin && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xl font-bold text-white">System Email Recipients</h3>
                        <button onClick={saveCc} disabled={ccSaving} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-1.5 px-4 rounded-lg">{ccSaving ? 'Saving…' : 'Save recipients'}</button>
                    </div>
                    <p className="text-gray-400 text-sm mb-4">The standing addresses that are automatically CC'd on outgoing emails. Add or remove people here (comma-separated) — it applies to new emails immediately. Client &amp; subcontractor addresses are handled automatically per load and are never mixed.</p>
                    <div className="space-y-3">
                        {CC_GROUPS.map(g => (
                            <div key={g.key} className="bg-gray-700/40 border border-gray-700 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-white">{g.label}</span>
                                </div>
                                <p className="text-[11px] text-gray-400 mb-2">{g.covers}</p>
                                <input value={ccSettings[g.key] ?? ''} onChange={e => setCcSettings(s => ({ ...s, [g.key]: e.target.value }))} placeholder="name@fbn-transport.co.za, another@…" className="w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm" style={{ textTransform: 'none' }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
