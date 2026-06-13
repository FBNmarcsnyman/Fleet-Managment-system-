import React, { useState } from 'react';
import { Client, Contact } from '../../types';
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
    const [address, setAddress] = useState(editing?.address || '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('Please fill in the Company Name.');
            return;
        }
        if (submitting) return;
        setSubmitting(true);
        const cleanContacts = contacts.filter(c => (c.name || '').trim() || (c.email || '').trim());

        if (editing) {
            const result = await handleUpdateClient(editing.id, { name, contactPerson, contactEmail, contactPhone, contacts: cleanContacts, address });
            setSubmitting(false);
            if (!result.ok) { showToast(`Failed to update client: ${result.error}`); return; }
            hideModal();
            showToast(`Client "${name}" updated.`);
            return;
        }

        const newClient = { name, contactPerson, contactEmail, contactPhone, contacts: cleanContacts, address };
        const result = await handleAddClient(newClient);
        setSubmitting(false);
        if (!result.ok) {
            showToast(`Failed to add client: ${result.error}`);
            return; // keep modal open so user can correct + retry
        }
        if (modal.payload?.onSuccess) {
            modal.payload.onSuccess(result.value!.id);
        }
        hideModal();
        showToast(`Client "${result.value!.name}" added.`);
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
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={hideModal} disabled={submitting} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Saving…' : (editing ? 'Save Changes' : 'Add Client')}</button>
            </div>
        </form>
    );
};

export default AddClientForm;
