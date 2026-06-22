import React, { useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { directInsert, directUpdate, directDelete } from '../../lib/supabase';
import { FBN_ORGANIZATION_ID } from '../../lib/mappers';

// Add / edit / delete a controller (an agent's person, e.g. Bongumusa @ DHL) with
// their email + cell, so status updates can be pushed to the right contact.
const LclControllerModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const existing = modal.payload?.existing;
    const onSaved = modal.payload?.onSaved as (() => void) | undefined;
    const [name, setName] = useState(existing?.name || modal.payload?.name || '');
    const [agent, setAgent] = useState(existing?.agent || modal.payload?.agent || '');
    const [email, setEmail] = useState(existing?.email || '');
    const [phone, setPhone] = useState(existing?.phone || '');
    const [busy, setBusy] = useState(false);

    const save = async () => {
        if (!name.trim()) { showToast('Add the controller name.'); return; }
        setBusy(true);
        const row = { agent: agent.trim().toUpperCase() || null, name: name.trim().toUpperCase(), email: email.trim() || null, phone: phone.trim() || null, updated_at: new Date().toISOString() };
        const res = existing?.id
            ? await directUpdate('lcl_controllers', { id: existing.id }, row)
            : await directInsert('lcl_controllers', { ...row, organization_id: FBN_ORGANIZATION_ID });
        setBusy(false);
        if (res.error) { showToast(`Could not save: ${res.error.message}`); return; }
        onSaved?.(); hideModal();
        showToast(`Controller ${row.name} saved.`);
    };

    const remove = async () => {
        if (!existing?.id) { hideModal(); return; }
        if (!window.confirm(`Delete controller ${existing.name}?`)) return;
        setBusy(true);
        const res = await directDelete('lcl_controllers', { id: existing.id });
        setBusy(false);
        if (res.error) { showToast(`Could not delete: ${res.error.message}`); return; }
        onSaved?.(); hideModal();
        showToast('Controller deleted.');
    };

    const inp = 'w-full bg-gray-700 text-white p-2.5 rounded-lg border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <h2 className="text-xl font-black text-white mb-1">{existing?.id ? 'Edit' : 'Add'} Controller</h2>
            <p className="text-xs text-gray-400 mb-4">The agent's contact we push shipment updates to.</p>
            <div className="space-y-3">
                <div><label className={lbl}>Agent</label><input value={agent} onChange={e => setAgent(e.target.value)} className={inp} placeholder="e.g. DHL" /></div>
                <div><label className={lbl}>Controller name *</label><input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="e.g. BONGUMUSA" /></div>
                <div><label className={lbl}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inp} placeholder="controller@agent.co.za" /></div>
                <div><label className={lbl}>Contact no</label><input value={phone} onChange={e => setPhone(e.target.value)} className={inp} placeholder="0xx xxx xxxx" /></div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-6">
                {existing?.id ? <button type="button" onClick={remove} disabled={busy} className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2.5 px-4 rounded-lg text-sm disabled:opacity-50">Delete</button> : <span />}
                <div className="flex gap-3">
                    <button type="button" onClick={hideModal} disabled={busy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 px-5 rounded-lg disabled:opacity-50">Cancel</button>
                    <button type="button" onClick={save} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-6 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
        </div>
    );
};

export default LclControllerModal;
