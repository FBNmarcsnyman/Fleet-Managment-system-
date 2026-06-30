import React, { useMemo, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { invokeFn } from '../../lib/supabase';
import { brandedEmail } from '../../lib/emailTemplate';

// Clients > Comms & Marketing — segment the client base by category / contact
// flag, then send ONE branded email to the chosen audience via the existing
// send-email engine. First cut: no templates/scheduling/tracking yet. Email
// TEST MODE (if on) still redirects everything to Marc, so it's safe to trial.
const CATEGORIES = ['Clearing & Forwarding Agent', 'Consolidator', 'Broker', 'Manufacturer / Shipper', 'Carrier / Transporter', 'Other', 'Uncategorised'];
const catOf = (c: any) => c.category || 'Uncategorised';

type Audience = 'primary' | 'updates' | 'all';

const ClientCommsView: React.FC = () => {
    const { clients = [] } = useOperations() as any;
    const { showToast } = useUIState();
    const [cat, setCat] = useState<string>('ALL');
    const [audience, setAudience] = useState<Audience>('primary');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [showList, setShowList] = useState(false);

    // The clients in the current category filter.
    const inCat = useMemo(
        () => (clients as any[]).filter(c => cat === 'ALL' || catOf(c) === cat),
        [clients, cat]);

    // Resolve the audience to a de-duplicated list of {email, name, company}.
    const recipients = useMemo(() => {
        const seen = new Set<string>();
        const out: { email: string; name: string; company: string }[] = [];
        const push = (email?: string, name?: string, company?: string) => {
            const e = (email || '').trim();
            if (!e || seen.has(e.toLowerCase())) return;
            seen.add(e.toLowerCase());
            out.push({ email: e, name: name || '', company: company || '' });
        };
        inCat.forEach(c => {
            const contacts = (c.contacts || []) as any[];
            if (audience === 'all') contacts.forEach(p => push(p.email, p.name, c.name));
            else if (audience === 'updates') contacts.filter(p => p.getsUpdates).forEach(p => push(p.email, p.name, c.name));
            else { const main = contacts.find(p => p.getsUpdates) || contacts[0]; push(main?.email || c.contactEmail, main?.name || c.contactPerson, c.name); }
        });
        return out;
    }, [inCat, audience]);

    const counts = useMemo(() => {
        const m: Record<string, number> = {};
        (clients as any[]).forEach(c => { const k = catOf(c); m[k] = (m[k] || 0) + 1; });
        return m;
    }, [clients]);

    const send = async () => {
        if (!subject.trim() || !body.trim()) { showToast('Add a subject and a message first.'); return; }
        if (!recipients.length) { showToast('No recipients in this segment.'); return; }
        if (!window.confirm(`Send this email to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}? (If Email TEST MODE is on, it routes to you only.)`)) return;
        const html = brandedEmail(body.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join(''));
        setSending(true);
        let ok = 0, fail = 0;
        // Send individually (one recipient each) so addresses aren't exposed to one another.
        for (let i = 0; i < recipients.length; i += 5) {
            const batch = recipients.slice(i, i + 5);
            await Promise.all(batch.map(async r => {
                try {
                    const { data, error } = await invokeFn('send-email', { body: { to: r.email, subject: subject.trim(), html, fromName: 'FBN Transport' } });
                    if (error || (data as any)?.error) fail++; else ok++;
                } catch { fail++; }
            }));
        }
        setSending(false);
        showToast(`Sent ${ok} email${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}.`);
        if (ok && !fail) { setSubject(''); setBody(''); }
    };

    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-lg border ${active ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`;
    const inp = 'w-full bg-white text-slate-800 p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#f5b700] focus:outline-none';

    return (
        <div className="space-y-4 max-w-3xl">
            <div>
                <h3 className="text-lg font-bold text-slate-900">Comms &amp; Marketing</h3>
                <p className="text-xs text-slate-500">Segment your clients and send one branded email to the whole audience.</p>
            </div>

            <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Segment by category</p>
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setCat('ALL')} className={chip(cat === 'ALL')}>All ({clients.length})</button>
                    {CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className={chip(cat === c)}>{c} ({counts[c] || 0})</button>)}
                </div>
            </div>

            <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Who at each company</p>
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setAudience('primary')} className={chip(audience === 'primary')}>Primary contact</button>
                    <button onClick={() => setAudience('updates')} className={chip(audience === 'updates')}>Contacts flagged "Updates"</button>
                    <button onClick={() => setAudience('all')} className={chip(audience === 'all')}>All contacts</button>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-bold text-[#13294b]">{recipients.length} recipient{recipients.length === 1 ? '' : 's'} in this segment</span>
                <button onClick={() => setShowList(s => !s)} disabled={!recipients.length} className="text-xs font-bold text-blue-600 hover:underline disabled:text-slate-400">{showList ? 'Hide' : 'Preview list'}</button>
            </div>
            {showList && (
                <div className="max-h-44 overflow-auto bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-600 space-y-0.5">
                    {recipients.map(r => <div key={r.email} className="truncate"><span className="font-semibold text-slate-800">{r.email}</span>{r.company ? ` · ${r.company}` : ''}</div>)}
                </div>
            )}

            <div className="space-y-2">
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={inp} />
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Write your message… (blank lines start a new paragraph)" className={inp} />
            </div>

            <div className="flex justify-end">
                <button onClick={send} disabled={sending || !recipients.length} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2.5 px-8 rounded-xl">
                    {sending ? 'Sending…' : `Send to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`}
                </button>
            </div>
        </div>
    );
};

export default ClientCommsView;
