import React, { useState } from 'react';
import { Client, Contact, ClientBranch } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import ContactsEditor from './ContactsEditor';

const AddClientForm: React.FC = () => {
    const { handleAddClient, handleUpdateClient } = useOperations();
    const { hideModal, modal, showToast } = useUIState();
    const editing: Client | undefined = modal.payload?.client;
    const [name, setName] = useState(editing?.name || '');
    const [contactPerson, setContactPerson] = useState(editing?.contactPerson || '');
    const [contactEmail, setContactEmail] = useState(editing?.contactEmail || '');
    const [contactPhone, setContactPhone] = useState(editing?.contactPhone || '');
    const [contacts, setContacts] = useState<Contact[]>(editing?.contacts || []);
    const [branches, setBranches] = useState<ClientBranch[]>(editing?.branches || []);
    const [address, setAddress] = useState(editing?.address || '');
    const [submitting, setSubmitting] = useState(false);

    const setBranch = (i: number, field: keyof ClientBranch, v: string) => setBranches(p => p.map((b, idx) => idx === i ? { ...b, [field]: v } : b));
    const setBranchContacts = (i: number, cs: Contact[]) => setBranches(p => p.map((b, idx) => idx === i ? { ...b, contacts: cs } : b));
    const addBranch = () => setBranches(p => [...p, { name: '', address: '', contactPerson: '', contactEmail: '', contactPhone: '', contacts: [] }]);
    const removeBranch = (i: number) => setBranches(p => p.filter((_, idx) => idx !== i));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('Please fill in the Company Name.');
            return;
        }
        if (submitting) return;
        setSubmitting(true);
        const cleanContacts = contacts.filter(c => (c.name || '').trim() || (c.email || '').trim());
        const cleanBranches = branches
            .filter(b => (b.name || '').trim())
            .map(b => ({ ...b, contacts: (b.contacts || []).filter(c => (c.name || '').trim() || (c.email || '').trim()) }));
        try {
            if (editing) {
                // Close immediately and save in the background (free-tier DB can be slow).
                hideModal();
                showToast('Saving client…');
                handleUpdateClient(editing.id, { name, contactPerson, contactEmail, contactPhone, contacts: cleanContacts, branches: cleanBranches, address })
                    .then((result: any) => showToast(result?.ok === false ? `Failed to update client: ${result.error}` : `Client "${name}" updated.`))
                    .catch((err: any) => showToast(`Could not save: ${err?.message || 'error'}`));
                return;
            }

            const newClient = { name, contactPerson, contactEmail, contactPhone, contacts: cleanContacts, branches: cleanBranches, address };
            const result = await handleAddClient(newClient);
            if (!result.ok) { showToast(`Failed to add client: ${result.error}`); return; } // keep modal open so user can correct + retry
            if (modal.payload?.onSuccess) {
                modal.payload.onSuccess(result.value!.id);
            }
            hideModal();
            showToast(`Client "${result.value!.name}" added.`);
        } catch (err) {
            showToast(`Could not save client: ${err instanceof Error ? err.message : 'unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">{editing ? 'Edit' : 'Add New'} Client</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Company Name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Primary Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputClasses} />
                <div className="grid grid-cols-2 gap-4">
                    <input type="email" placeholder="Contact Email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputClasses} />
                    <input type="tel" placeholder="Contact Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputClasses} />
                </div>
                <textarea placeholder="Company Address" value={address} onChange={e => setAddress(e.target.value)} rows={3} className={inputClasses} />
                <div className="border-t border-gray-700 pt-4">
                    <ContactsEditor contacts={contacts} onChange={setContacts} accent="text-blue-400" />
                </div>
                <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Branches <span className="text-blue-400 normal-case">· locations on this one account (e.g. DBN / JHB / CPT)</span></label>
                        <button type="button" onClick={addBranch} className="text-xs font-bold text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg">+ Add branch</button>
                    </div>
                    {branches.length === 0 && <p className="text-xs text-gray-500 italic py-1">No branches — add them if this client has multiple sites billed on one account.</p>}
                    <div className="space-y-2">
                        {branches.map((b, i) => (
                            <div key={i} className="bg-gray-900/40 rounded-lg p-2 space-y-2">
                                <div className="flex gap-2 items-center">
                                    <input className="w-28 bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm" placeholder="Branch (DBN)" value={b.name} onChange={e => setBranch(i, 'name', e.target.value)} />
                                    <input className="flex-1 bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm" placeholder="Delivery / site address" value={b.address || ''} onChange={e => setBranch(i, 'address', e.target.value)} />
                                    <button type="button" onClick={() => removeBranch(i)} title="Remove" className="text-gray-500 hover:text-red-400 text-lg font-bold px-1">×</button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <input className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm" placeholder="Site / delivery contact" value={b.contactPerson || ''} onChange={e => setBranch(i, 'contactPerson', e.target.value)} />
                                    <input className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm" placeholder="Email" value={b.contactEmail || ''} onChange={e => setBranch(i, 'contactEmail', e.target.value)} />
                                    <input className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm" placeholder="Phone" value={b.contactPhone || ''} onChange={e => setBranch(i, 'contactPhone', e.target.value)} />
                                </div>
                                <div className="pl-1 pt-1 border-t border-gray-700/50">
                                    <ContactsEditor
                                        contacts={b.contacts || []}
                                        onChange={cs => setBranchContacts(i, cs)}
                                        accent="text-emerald-400"
                                        label={`People at ${b.name || 'this branch'} who give us loads`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={hideModal} disabled={submitting} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Saving…' : (editing ? 'Save Changes' : 'Add Client')}</button>
            </div>
        </form>
    );
};

export default AddClientForm;
