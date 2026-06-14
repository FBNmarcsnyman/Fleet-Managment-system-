
import React, { useState } from 'react';
import { Supplier, Contact } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import ContactsEditor from './ContactsEditor';

const AddSupplierForm: React.FC = () => {
    const { handleAddSupplier, handleUpdateSupplier } = useOperations();
    const { hideModal, modal, showToast } = useUIState();
    const editing: Supplier | undefined = modal.payload?.supplier;
    const [name, setName] = useState(editing?.name || '');
    const [contactPerson, setContactPerson] = useState(editing?.contactPerson || '');
    const [contactEmail, setContactEmail] = useState(editing?.contactEmail || '');
    const [contactPhone, setContactPhone] = useState(editing?.contactPhone || '');
    const [contacts, setContacts] = useState<Contact[]>(editing?.contacts || []);
    const [address, setAddress] = useState(editing?.address || '');
    const [submitting, setSubmitting] = useState(false);

    const defaultType = editing?.type || modal.payload?.defaultType || 'Workshop';
    const noun = defaultType === 'Transport' ? 'Subcontractor' : 'Supplier';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('Please fill in Supplier Name.');
            return;
        }
        if (submitting) return;
        setSubmitting(true);
        const cleanContacts = contacts.filter(c => (c.name || '').trim() || (c.email || '').trim());
        try {
            if (editing) {
                // Close immediately and save in the background — the database can
                // be slow to wake on the free tier, so we don't make the user wait.
                hideModal();
                showToast(`Saving ${noun.toLowerCase()}…`);
                handleUpdateSupplier(editing.id, { name, contactPerson, contactEmail, contactPhone, contacts: cleanContacts, address })
                    .then((result: any) => showToast(result?.ok === false ? `Failed to update ${noun.toLowerCase()}: ${result.error}` : `${noun} "${name}" updated.`))
                    .catch((err: any) => showToast(`Could not save: ${err?.message || 'error'}`));
                return;
            }
            const newSupplier: Omit<Supplier, 'id'> = {
                name,
                contactPerson,
                contactEmail,
                contactPhone,
                contacts: cleanContacts,
                address,
                type: defaultType,
                complianceStatus: 'Pending',
                complianceDocs: [],
                rateCards: [],
            };
            const result = await handleAddSupplier(newSupplier);
            if (!result.ok) { showToast(`Failed to add supplier: ${result.error}`); return; }
            hideModal();
            showToast(`${noun} "${result.value!.name}" added.`);
        } catch (err) {
            showToast(`Could not save ${noun.toLowerCase()}: ${err instanceof Error ? err.message : 'unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">{editing ? 'Edit' : 'Add New'} {noun}</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Supplier Name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Primary Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputClasses} />
                <div className="grid grid-cols-2 gap-4">
                    <input type="email" placeholder="Contact Email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputClasses} />
                    <input type="tel" placeholder="Contact Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputClasses} />
                </div>
                 <textarea placeholder="Address (Optional)" value={address} onChange={e => setAddress(e.target.value)} rows={3} className={inputClasses} />
                <div className="border-t border-gray-700 pt-4">
                    <ContactsEditor contacts={contacts} onChange={setContacts} accent="text-amber-400" />
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={hideModal} disabled={submitting} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Saving…' : (editing ? 'Save Changes' : `Add ${noun}`)}</button>
            </div>
        </form>
    );
};

export default AddSupplierForm;
