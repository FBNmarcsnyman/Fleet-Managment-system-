import React from 'react';
import { Contact } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';

// Manage the list of named people at a client / subcontractor. Each row is a
// person + email + (optional) phone, so the Transport Order form can offer them
// as a "Contact Person" dropdown and auto-fill the email.
const ContactsEditor: React.FC<{
    contacts: Contact[];
    onChange: (contacts: Contact[]) => void;
    accent?: string; // tailwind text colour for the accent, e.g. 'text-blue-400'
    label?: string;  // override the default "Contacts · the people you liaise with"
}> = ({ contacts, onChange, accent = 'text-brand-secondary', label }) => {

    const update = (i: number, field: keyof Contact, value: string) => {
        const next = contacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c);
        onChange(next);
    };
    const add = () => onChange([...contacts, { name: '', email: '', phone: '' }]);
    const remove = (i: number) => onChange(contacts.filter((_, idx) => idx !== i));

    const inputCls = "w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary";

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {label ? <span className={`${accent} normal-case`}>{label}</span> : <>Contacts <span className={`${accent} normal-case`}>· the people you liaise with</span></>}
                </label>
                <button type="button" onClick={add} className="flex items-center text-xs font-bold text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg">
                    <PlusIcon className="h-4 w-4 mr-1" /> Add person
                </button>
            </div>
            {contacts.length === 0 && (
                <p className="text-xs text-gray-500 italic py-2">No contacts yet — add the controller / booking person and their email.</p>
            )}
            {contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input className={`${inputCls} col-span-4`} placeholder="Name" value={c.name} onChange={e => update(i, 'name', e.target.value)} />
                    <input className={`${inputCls} col-span-4`} type="email" placeholder="Email" value={c.email || ''} onChange={e => update(i, 'email', e.target.value)} />
                    <input className={`${inputCls} col-span-3`} placeholder="Phone" value={c.phone || ''} onChange={e => update(i, 'phone', e.target.value)} />
                    <button type="button" onClick={() => remove(i)} title="Remove" className="col-span-1 text-gray-500 hover:text-red-400 text-lg font-bold">×</button>
                </div>
            ))}
        </div>
    );
};

export default ContactsEditor;
