import React, { useState } from 'react';
import { Contact } from '../../types';

// Pick which of a company's people are on THIS load (multi-select), and add new ones
// inline (saved back to the company so they're there next time). The chosen emails feed
// the load's To + CC. Roles + send-flags (Order/LoadCon · POD · uploads POD · updates)
// come straight from the company's saved contacts and drive the downstream emails.
interface Props {
    contacts: Contact[];
    selectedEmails: string[];               // currently-selected (lowercased) emails
    onChange: (emails: string[]) => void;    // first = primary "To", rest = CC
    onAddContact?: (c: Contact) => void;     // persist a new person to the company
    kind: 'client' | 'supplier';
}

const ROLE_OPTIONS = ['Controller', 'Ops', 'Manager', 'Accounts', 'POD / Documents', 'Sales', 'Other'];

const RecipientPicker: React.FC<Props> = ({ contacts, selectedEmails, onChange, onAddContact, kind }) => {
    const [adding, setAdding] = useState(false);
    const [n, setN] = useState<Contact>({ name: '', email: '', role: 'Controller', getsDocs: true, getsPod: kind === 'supplier', getsUpdates: false });
    const docLabel = kind === 'client' ? 'Order' : 'LoadCon';
    const sel = new Set(selectedEmails.map(e => e.toLowerCase()));

    const toggle = (email?: string) => {
        if (!email) return;
        const e = email.toLowerCase();
        const next = sel.has(e) ? selectedEmails.filter(x => x.toLowerCase() !== e) : [...selectedEmails, email];
        onChange(next);
    };
    const flagPills = (c: Contact) => [
        (c.getsDocs ?? true) && docLabel,
        c.getsPod && 'POD',
        c.getsPodUpload && 'Uploads POD',
        c.getsUpdates && 'Updates',
    ].filter(Boolean) as string[];

    const blankNew = () => ({ name: '', email: '', role: 'Controller', getsDocs: true, getsPod: kind === 'supplier', getsUpdates: false } as Contact);
    const saveNew = () => {
        const email = (n.email || '').trim();
        if (!n.name.trim() || !email) return;
        onAddContact?.({ ...n, name: n.name.trim().toUpperCase(), email });
        // Keep it selected (it may already be selected if promoted from a one-off box).
        onChange(sel.has(email.toLowerCase()) ? selectedEmails : [...selectedEmails, email]);
        setAdding(false);
        setN(blankNew());
    };

    // Addresses on this load that were typed in by hand (or pulled from a past load)
    // but aren't saved contacts yet — offer to promote them to a permanent contact.
    const knownEmails = new Set(contacts.map(c => (c.email || '').toLowerCase()).filter(Boolean));
    const unsaved = selectedEmails.filter(e => e && !knownEmails.has(e.toLowerCase()));
    const promote = (email: string) => { setN({ ...blankNew(), email }); setAdding(true); };

    const inp = 'w-full bg-white text-slate-800 p-2 rounded-md border border-slate-300 text-sm';
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Who to send to {selectedEmails.length > 0 && <span className="text-slate-400">({selectedEmails.length})</span>}</span>
                {onAddContact && <button type="button" onClick={() => setAdding(a => !a)} className="text-xs font-bold text-[#13294b] hover:underline">{adding ? 'Cancel' : '+ Add person'}</button>}
            </div>
            {contacts.length === 0 && !adding && <p className="text-xs text-slate-400 italic">No saved contacts — add the person you deal with.</p>}
            {contacts.map((c, i) => {
                const checked = !!c.email && sel.has(c.email.toLowerCase());
                return (
                    <label key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer ${checked ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-white border border-transparent'}`}>
                        <input type="checkbox" checked={checked} disabled={!c.email} onChange={() => toggle(c.email)} className="h-4 w-4 accent-emerald-600" />
                        <span className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-slate-800">{c.name || c.email}</span>
                            {c.role && <span className="text-[11px] text-slate-500"> · {c.role}</span>}
                            {c.email ? <span className="block text-[11px] text-slate-500 truncate">{c.email}</span> : <span className="block text-[11px] text-amber-600">no email on file</span>}
                        </span>
                        <span className="flex flex-wrap gap-1 shrink-0">{flagPills(c).map(f => <span key={f} className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{f}</span>)}</span>
                    </label>
                );
            })}
            {onAddContact && unsaved.length > 0 && !adding && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-2 space-y-1">
                    <p className="text-[11px] font-bold text-amber-700">On this load but not saved yet — tap to keep for next time:</p>
                    {unsaved.map(e => (
                        <div key={e} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-600 truncate">{e}</span>
                            <button type="button" onClick={() => promote(e)} className="shrink-0 text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-white px-2 py-0.5 rounded">+ Save to company</button>
                        </div>
                    ))}
                </div>
            )}
            {adding && (
                <div className="bg-white border border-slate-200 rounded-md p-2 space-y-2 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                        <input value={n.name} onChange={e => setN({ ...n, name: e.target.value })} placeholder="Name" className={inp} />
                        <select value={n.role} onChange={e => setN({ ...n, role: e.target.value })} className={inp}>{ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}</select>
                    </div>
                    <input value={n.email} onChange={e => setN({ ...n, email: e.target.value })} placeholder="Email" type="email" className={inp} />
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={n.getsDocs ?? false} onChange={e => setN({ ...n, getsDocs: e.target.checked })} /> {docLabel}</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={n.getsPod ?? false} onChange={e => setN({ ...n, getsPod: e.target.checked })} /> POD</label>
                        {kind === 'supplier' && <label className="flex items-center gap-1"><input type="checkbox" checked={n.getsPodUpload ?? false} onChange={e => setN({ ...n, getsPodUpload: e.target.checked })} /> Uploads POD</label>}
                        <label className="flex items-center gap-1"><input type="checkbox" checked={n.getsUpdates ?? false} onChange={e => setN({ ...n, getsUpdates: e.target.checked })} /> Updates</label>
                    </div>
                    <button type="button" onClick={saveNew} disabled={!n.name.trim() || !(n.email || '').trim()} className="w-full bg-[#13294b] disabled:opacity-40 text-white text-sm font-bold py-1.5 rounded-md">Save &amp; add to this load</button>
                </div>
            )}
        </div>
    );
};

export default RecipientPicker;
