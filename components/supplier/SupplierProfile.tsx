import React, { useState } from 'react';
import { Supplier } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { supabase } from '../../lib/supabase';

const lbl = 'block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1';
const inp = 'w-full bg-gray-700 text-white p-2.5 rounded-lg border border-gray-600 text-sm focus:ring-2 focus:ring-brand-secondary outline-none';
const card = 'bg-gray-800/40 p-5 rounded-2xl border border-gray-700/50';

const SupplierProfile: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    const { handleSupplierSelfUpdate } = useOperations() as any;
    const { showToast } = useUIState();
    const [saving, setSaving] = useState(false);
    const [f, setF] = useState({
        name: supplier.name || '', address: supplier.address || '',
        controllerContact: supplier.controllerContact || supplier.contactPerson || '',
        contactEmail: supplier.contactEmail || '', contactPhone: supplier.contactPhone || '',
        accountsContact: supplier.accountsContact || '', regions: supplier.regions || '',
        vehicleTypes: (supplier.vehicleTypes || []).join(', '), trailerTypes: (supplier.trailerTypes || []).join(', '),
    });
    const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

    const save = async () => {
        if (saving) return;
        setSaving(true);
        const fields = {
            name: f.name.trim(), address: f.address.trim(), controllerContact: f.controllerContact.trim(),
            contactEmail: f.contactEmail.trim(), contactPhone: f.contactPhone.trim(), accountsContact: f.accountsContact.trim(),
            regions: f.regions.trim(),
            vehicleTypes: f.vehicleTypes.split(',').map(s => s.trim()).filter(Boolean),
            trailerTypes: f.trailerTypes.split(',').map(s => s.trim()).filter(Boolean),
        };
        const res = await handleSupplierSelfUpdate(fields);
        setSaving(false);
        showToast(res?.ok ? 'Profile saved.' : `Could not save: ${res?.error}`);
    };

    // Change password (Supabase Auth — the carrier is signed in).
    const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [pwBusy, setPwBusy] = useState(false);
    const changePw = async () => {
        if (pw.length < 8) { showToast('Use at least 8 characters.'); return; }
        if (pw !== pw2) { showToast('Passwords do not match.'); return; }
        setPwBusy(true);
        const { error } = await supabase.auth.updateUser({ password: pw });
        setPwBusy(false);
        if (error) { showToast(`Could not change password: ${error.message}`); return; }
        setPw(''); setPw2(''); showToast('Password changed.');
    };

    const agreementLink = `${window.location.origin}/?tcs=1`;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight">Company Profile</h2>
                <p className="text-gray-500 mt-1">Keep your details, fleet and routes up to date.</p>
            </div>

            <div className={card}>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Company & contacts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className={lbl}>Company name</label><input value={f.name} onChange={e => set('name', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Physical address</label><input value={f.address} onChange={e => set('address', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Controller / ops contact</label><input value={f.controllerContact} onChange={e => set('controllerContact', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Accounts contact</label><input value={f.accountsContact} onChange={e => set('accountsContact', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Email</label><input value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Phone</label><input value={f.contactPhone} onChange={e => set('contactPhone', e.target.value)} className={inp} /></div>
                </div>
            </div>

            <div className={card}>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Fleet & routes</h3>
                <div className="grid grid-cols-1 gap-3">
                    <div><label className={lbl}>Vehicle types (comma-separated)</label><input value={f.vehicleTypes} onChange={e => set('vehicleTypes', e.target.value)} placeholder="Superlink, Tri-axle, 8t" className={inp} /></div>
                    <div><label className={lbl}>Trailer types (comma-separated)</label><input value={f.trailerTypes} onChange={e => set('trailerTypes', e.target.value)} placeholder="Tautliner, Flatdeck" className={inp} /></div>
                    <div><label className={lbl}>Routes / regions you run</label><input value={f.regions} onChange={e => set('regions', e.target.value)} placeholder="e.g. DBN-JHB, JHB-CPT, cross-border" className={inp} /></div>
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-sm">{saving ? 'Saving…' : 'Save profile'}</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={card}>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Change password</h3>
                    <div className="space-y-3">
                        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="New password (min 8)" className={inp} />
                        <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Confirm new password" className={inp} />
                        <button onClick={changePw} disabled={pwBusy} className="w-full bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm">{pwBusy ? 'Updating…' : 'Update password'}</button>
                    </div>
                </div>
                <div className={card}>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Agreement</h3>
                    <p className="text-sm text-gray-400 mb-3">Your FBN Subcontractor Service Level Agreement.</p>
                    <a href={agreementLink} target="_blank" rel="noreferrer" className="inline-block bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 font-bold py-2.5 px-5 rounded-lg text-sm">View agreement</a>
                    <p className="text-[11px] text-gray-500 mt-2">Your signed copy is on file with FBN — ask us if you need it sent.</p>
                </div>
            </div>
        </div>
    );
};

export default SupplierProfile;
