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
    kind?: 'client' | 'supplier'; // a client gets the ORDER; a subcontractor the LOADCON
}> = ({ contacts, onChange, accent = 'text-brand-secondary', label, kind = 'supplier' }) => {
    // A client is NEVER offered "LoadCon" — they get the Client Order. This label
    // is the visual half of the hard client/subbie separation rule.
    const docLabel = kind === 'client' ? 'Order' : 'LoadCon';

    const update = (i: number, field: keyof Contact, value: string) => {
        const next = contacts.map((c, idx) => {
            if (idx !== i) return c;
            const merged: Contact = { ...c, [field]: value };
            // When a Role is chosen, default the send toggles sensibly (only if the
            // user hasn't set them yet) — Controller gets order/loadcon + POD +
            // updates, Accounts gets order/loadcon + POD only, others updates only.
            if (field === 'role' && c.getsDocs === undefined && c.getsUpdates === undefined && c.getsPod === undefined) {
                const r = value.toLowerCase();
                if (r.includes('account')) { merged.getsDocs = true; merged.getsPod = true; merged.getsUpdates = false; }
                else if (r.includes('controller')) { merged.getsDocs = true; merged.getsPod = true; merged.getsUpdates = true; }
                else if (r.includes('pod') || r.includes('doc')) { merged.getsDocs = false; merged.getsPod = true; merged.getsUpdates = false; }
                else { merged.getsDocs = false; merged.getsPod = false; merged.getsUpdates = true; }
            }
            return merged;
        });
        onChange(next);
    };
    const toggle = (i: number, field: 'getsDocs' | 'getsPod' | 'getsUpdates') => {
        onChange(contacts.map((c, idx) => idx === i ? { ...c, [field]: !(c[field] ?? false) } : c));
    };
    const add = () => onChange([...contacts, { name: '', email: '', phone: '', getsDocs: true, getsPod: true, getsUpdates: true }]);
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
                <div key={i} className="space-y-1.5 bg-gray-900/30 rounded-lg p-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                        <input className={`${inputCls} col-span-3`} placeholder="Name" value={c.name} onChange={e => update(i, 'name', e.target.value)} />
                        <input className={`${inputCls} col-span-2`} placeholder="Role" list="contactRoles" value={c.role || ''} onChange={e => update(i, 'role', e.target.value)} />
                        <input className={`${inputCls} col-span-4`} type="email" placeholder="Email" value={c.email || ''} onChange={e => update(i, 'email', e.target.value)} />
                        <input className={`${inputCls} col-span-2`} placeholder="Phone" value={c.phone || ''} onChange={e => update(i, 'phone', e.target.value)} />
                        <button type="button" onClick={() => remove(i)} title="Remove" className="col-span-1 text-gray-500 hover:text-red-400 text-lg font-bold">×</button>
                    </div>
                    <div className="flex items-center gap-4 pl-1 text-[11px] text-gray-400 flex-wrap">
                        <span className="uppercase tracking-wider text-gray-500">Send them:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={c.getsDocs ?? false} onChange={() => toggle(i, 'getsDocs')} /> {docLabel}</label>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={c.getsPod ?? false} onChange={() => toggle(i, 'getsPod')} /> POD</label>
                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={c.getsUpdates ?? false} onChange={() => toggle(i, 'getsUpdates')} /> Status updates</label>
                    </div>
                </div>
            ))}
            <datalist id="contactRoles"><option value="Controller" /><option value="Accounts" /><option value="Ops" /><option value="POD / Documents" /><option value="Other" /></datalist>
        </div>
    );
};

export default ContactsEditor;
