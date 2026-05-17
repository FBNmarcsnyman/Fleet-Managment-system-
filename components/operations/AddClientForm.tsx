import React, { useState } from 'react';
import { Client } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';

const AddClientForm: React.FC = () => {
    const { handleAddClient } = useOperations();
    const { hideModal, modal } = useUIState();
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [address, setAddress] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !contactPerson || !contactEmail) {
            alert('Please fill in Name, Contact Person, and Email.');
            return;
        }
        const newClient = { name, contactPerson, contactEmail, contactPhone, address };
        const newClientId = handleAddClient(newClient);
        
        if (modal.payload?.onSuccess) {
            modal.payload.onSuccess(newClientId);
        }
        
        hideModal();
    };

    const inputClasses = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-6 text-white">Add New Client</h2>
            <div className="space-y-4">
                <input type="text" placeholder="Company Name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
                <input type="text" placeholder="Primary Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} required className={inputClasses} />
                <div className="grid grid-cols-2 gap-4">
                    <input type="email" placeholder="Contact Email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required className={inputClasses} />
                    <input type="tel" placeholder="Contact Phone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputClasses} />
                </div>
                <textarea placeholder="Company Address" value={address} onChange={e => setAddress(e.target.value)} rows={3} className={inputClasses} />
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Add Client</button>
            </div>
        </form>
    );
};

export default AddClientForm;