
import React, { useState } from 'react';
import { Supplier } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';

const AddSupplierForm: React.FC = () => {
    const { handleAddSupplier } = useOperations();
    const { hideModal, modal, showToast } = useUIState();
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [address, setAddress] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const defaultType = modal.payload?.defaultType || 'Workshop';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            alert('Please fill in Supplier Name.');
            return;
        }
        if (submitting) return;
        setSubmitting(true);
        const newSupplier: Omit<Supplier, 'id'> = {
            name,
            contactPerson,
            contactEmail,
            contactPhone,
            address,
            type: defaultType,
            complianceStatus: 'Pending',
            complianceDocs: [],
            rateCards: [],
        };
        const result = await handleAddSupplier(newSupplier);
        setSubmitting(false);
        if (!result.ok) {
            showToast(`Failed to add supplier: ${result.error}`);
            return;
        }
        hideModal();
        showToast(`${defaultType === 'Transport' ? 'Subcontractor' : 'Supplier'} "${result.value!.name}" added.`);
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add New {defaultType === 'Transport' ? 'Subcontractor' : 'Supplier'}</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Supplier Name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Primary Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className={inputClasses} />
                <div className="grid grid-cols-2 gap-4">
                    <input type="email" placeholder="Contact Email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputClasses} />
                    <input type="tel" placeholder="Contact Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputClasses} />
                </div>
                 <textarea placeholder="Address (Optional)" value={address} onChange={e => setAddress(e.target.value)} rows={3} className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={hideModal} disabled={submitting} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Adding…' : `Add ${defaultType === 'Transport' ? 'Subcontractor' : 'Supplier'}`}</button>
            </div>
        </form>
    );
};

export default AddSupplierForm;
