import React, { useEffect, useMemo, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { invokeFn, directSelect, directUpdate } from '../../lib/supabase';
import { brandedEmail } from '../../lib/emailTemplate';
import { fetchMarketingContacts, prefsLink, MarketingContact } from '../../lib/marketingContacts';

// Ready, branded message templates (subject + body) to start from. Split by who
// they're for — CLIENT templates sell our services; CARRIER templates recruit
// transporters into the network. The picker shows the right set for the audience.
type Tpl = { name: string; subject: string; body: string };
const CLIENT_TEMPLATES: Tpl[] = [
    { name: 'Who we are', subject: 'FBN Transport — your freight partner', body: 'Good day,\n\nFBN Transport moves commercial freight nationwide — full loads, part loads, containers and abnormal cargo — backed by a vetted carrier network and live tracking.\n\nWe would love to quote on your next load. Simply reply with the collection, delivery and cargo details and we will come back to you promptly.\n\nRegards,\nFBN Transport' },
    { name: 'All services we offer', subject: 'Everything FBN Transport can move for you', body: 'Good day,\n\nUnder one roof, FBN Transport handles:\n\n• Full loads (FTL) and part loads (LTL) nationwide\n• Containers — import, export and depot cartage (FCL & LCL)\n• Abnormal and project cargo\n• Cross-border and inter-depot line-haul\n• Warehousing, storage, palletising and shrink-wrapping\n• Live tracking and proof-of-delivery on every load\n\nWhatever you need moved, we have a lane and a truck for it. Reply and let us quote.\n\nRegards,\nFBN Transport' },
    { name: 'What can we quote today?', subject: 'What cargo can we quote on for you today?', body: 'Good day,\n\nGot freight sitting and waiting? Let us take it off your hands.\n\nSend us the route, the cargo and the dates and we will have a competitive rate back to you the same day.\n\nWhat can we quote on for you today?\n\nRegards,\nFBN Transport' },
    { name: 'Big or small, we move it all', subject: 'Nationwide — big, small, we move it all', body: 'Good day,\n\nOne pallet or fifty. A single carton or a full superlink. Across town or across the country — if it needs to move, FBN Transport moves it.\n\nWe move nationwide. What have you got?\n\nReply with the details and we will quote.\n\nRegards,\nFBN Transport' },
    { name: 'Can we quote you?', subject: 'Can we quote you? It takes 2 minutes', body: 'Good day,\n\nQuick one — can we quote you on your next load?\n\nNo obligation. Send us the route and cargo, and we will show you what FBN Transport can do on price, on time and on service.\n\nRegards,\nFBN Transport' },
    { name: 'Quirky — still using the same guys?', subject: 'Still using the same transporter out of habit?', body: 'Good day,\n\nWhen last did you actually compare your transport rates?\n\nMost people stick with who they know — until they see what they have been overpaying. Give FBN Transport one load to prove the point.\n\nSend us a route and let us surprise you.\n\nRegards,\nFBN Transport' },
    { name: 'Quirky — a truck near you', subject: 'There is probably an FBN truck near you right now', body: 'Good day,\n\nOur fleet and partner network criss-cross the country every single day — which means there is a very good chance we are already running your lane.\n\nEmpty space on a truck is wasted money — for us and for you. Let us fill it with your freight at a sharp rate.\n\nWhere do you need to move something? Reply and we will quote.\n\nRegards,\nFBN Transport' },
];
const CARRIER_TEMPLATES: Tpl[] = [
    { name: 'Become a carrier partner', subject: 'Join the FBN Transport carrier network', body: 'Good day,\n\nWe are growing our carrier network. If you own trucks and want consistent, well-priced loads, partner with FBN Transport.\n\nRegister your fleet, routes and certifications below and — once vetted — you will start receiving load offers that suit your lanes:\n\n{{REGISTER_LINK}}\n\nReply to this email for anything you need.\n\nRegards,\nFBN Transport' },
    { name: 'Loads on your lanes', subject: 'Consistent loads on the lanes you already run', body: 'Good day,\n\nRunning empty kilometres? FBN Transport has freight on routes across the country and we are looking for reliable carriers to move it.\n\nRegister your fleet and lanes with us — once vetted, we match you to loads that fit your trucks:\n\n{{REGISTER_LINK}}\n\nRegards,\nFBN Transport' },
];

// Clients > Comms & Marketing — segment the client base by category / contact
// flag, then send ONE branded email to the chosen audience via the existing
// send-email engine. First cut: no templates/scheduling/tracking yet. Email
// TEST MODE (if on) still redirects everything to Marc, so it's safe to trial.
const CATEGORIES = ['Clearing & Forwarding Agent', 'Consolidator', 'Broker', 'Manufacturer / Shipper', 'Carrier / Transporter', 'Other', 'Uncategorised'];
const catOf = (c: any) => c.category || 'Uncategorised';

type Audience = 'primary' | 'updates' | 'all';

// carrierMode = launched from the Transporters screen → default to the carrier
// marketing audience + carrier-recruitment templates.
const ClientCommsView: React.FC<{ carrierMode?: boolean }> = ({ carrierMode }) => {
    const { clients = [] } = useOperations() as any;
    const { showToast } = useUIState();
    const [cat, setCat] = useState<string>('ALL');
    const [audience, setAudience] = useState<Audience>('primary');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [showList, setShowList] = useState(false);
    // Test send — fire the exact email to a few addresses before the real blast.
    const [testTo, setTestTo] = useState('marcsnyman@fbn-transport.co.za');
    const [testing, setTesting] = useState(false);
    // Audience source: the operational client CRM, or the marketing list (incl prospects/carriers).
    const [source, setSource] = useState<'clients' | 'marketing'>(carrierMode ? 'marketing' : 'clients');
    const [mkKind, setMkKind] = useState<string>(carrierMode ? 'carrier' : 'all');
    const [mkAll, setMkAll] = useState<MarketingContact[]>([]);
    useEffect(() => { fetchMarketingContacts().then(setMkAll); }, []);
    // Saved audiences — a named, reusable segment (source + filters). Stored on email_settings.
    type SavedAudience = { name: string; source: 'clients' | 'marketing'; cat: string; audience: Audience; mkKind: string };
    const [saved, setSaved] = useState<SavedAudience[]>([]);
    const loadSaved = async () => {
        try { const { data } = await directSelect('email_settings?id=eq.1&select=marketing_audiences'); const row = Array.isArray(data) ? data[0] : data; setSaved((row?.marketing_audiences as SavedAudience[]) || []); } catch { /* ignore */ }
    };
    useEffect(() => { loadSaved(); }, []);
    const persistSaved = async (list: SavedAudience[]) => { setSaved(list); try { await directUpdate('email_settings', { id: '1' }, { marketing_audiences: list }); } catch { /* non-blocking */ } };
    const saveAudience = async () => {
        const name = window.prompt('Name this audience (e.g. "DBN agents", "Carrier prospects"):')?.trim();
        if (!name) return;
        const a: SavedAudience = { name, source, cat, audience, mkKind };
        await persistSaved([...saved.filter(x => x.name.toLowerCase() !== name.toLowerCase()), a]);
        showToast(`Audience "${name}" saved.`);
    };
    const applyAudience = (a: SavedAudience) => { setSource(a.source); setCat(a.cat); setAudience(a.audience); setMkKind(a.mkKind); showToast(`Loaded audience "${a.name}".`); };
    const deleteAudience = async (name: string) => { if (!window.confirm(`Delete saved audience "${name}"?`)) return; await persistSaved(saved.filter(x => x.name !== name)); };
    // Exclude both opted-out AND bounced (invalid mailbox) addresses from every send.
    const blocked = useMemo(() => new Set(mkAll.filter(c => c.optedOut || c.bounced).map(c => c.email.toLowerCase())), [mkAll]);

    // The clients in the current category filter.
    const inCat = useMemo(
        () => (clients as any[]).filter(c => cat === 'ALL' || catOf(c) === cat),
        [clients, cat]);

    // Resolve the audience to a de-duplicated list, EXCLUDING opted-out emails.
    // Marketing recipients carry id+token so each email gets a personal manage link.
    const recipients = useMemo(() => {
        const seen = new Set<string>();
        const out: { email: string; name: string; company: string; link?: string }[] = [];
        if (source === 'marketing') {
            mkAll.filter(c => !c.optedOut && !c.bounced).filter(c => mkKind === 'all' || c.kind === mkKind).forEach(c => {
                const e = (c.email || '').trim(); if (!e || seen.has(e.toLowerCase())) return; seen.add(e.toLowerCase());
                out.push({ email: e, name: c.name || '', company: c.company || '', link: prefsLink(c) });
            });
            return out;
        }
        const push = (email?: string, name?: string, company?: string) => {
            const e = (email || '').trim();
            if (!e || seen.has(e.toLowerCase()) || blocked.has(e.toLowerCase())) return;
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
    }, [source, mkAll, mkKind, inCat, audience, blocked]);

    const counts = useMemo(() => {
        const m: Record<string, number> = {};
        (clients as any[]).forEach(c => { const k = catOf(c); m[k] = (m[k] || 0) + 1; });
        return m;
    }, [clients]);

    const send = async () => {
        if (!subject.trim() || !body.trim()) { showToast('Add a subject and a message first.'); return; }
        if (!recipients.length) { showToast('No recipients in this segment.'); return; }
        if (!window.confirm(`Send this email to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}? (If Email TEST MODE is on, it routes to you only.)`)) return;
        const bodyHtml = fillLinks(body).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        setSending(true);
        let ok = 0, fail = 0;
        // Send individually (one recipient each) so addresses aren't exposed to one another.
        for (let i = 0; i < recipients.length; i += 5) {
            const batch = recipients.slice(i, i + 5);
            await Promise.all(batch.map(async r => {
                try {
                    // Marketing recipients get a personal manage/unsubscribe footer (legal + opt-out).
                    const footer = r.link ? `<p style="font-size:11px;color:#94a3b8;margin-top:18px">You're receiving this because you're on FBN Transport's contact list. <a href="${r.link}" style="color:#64748b">Update your details or unsubscribe</a>.</p>` : '';
                    const html = brandedEmail(bodyHtml + footer);
                    const { data, error } = await invokeFn('send-email', { body: { to: r.email, subject: subject.trim(), html, fromName: 'FBN Transport' } });
                    if (error || (data as any)?.error) fail++; else ok++;
                } catch { fail++; }
            }));
        }
        setSending(false);
        showToast(`Sent ${ok} email${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}.`);
        if (ok && !fail) { setSubject(''); setBody(''); }
    };

    // Carrier-recruitment templates carry a {{REGISTER_LINK}} → the public sign-up page (CRM Phase 3 funnel).
    const registerLink = typeof window !== 'undefined' ? `${window.location.origin}/supplier-register` : '/supplier-register';
    const isCarrierAudience = source === 'marketing' && mkKind === 'carrier';
    const templateSet = isCarrierAudience ? CARRIER_TEMPLATES : CLIENT_TEMPLATES;
    const fillLinks = (s: string) => s.replace(/\{\{REGISTER_LINK\}\}/g, registerLink);
    const applyTemplate = (t: Tpl) => { setSubject(t.subject); setBody(fillLinks(t.body)); };

    // Send the exact email to a handful of test addresses first (ignores the audience).
    const sendTest = async () => {
        if (!subject.trim() || !body.trim()) { showToast('Add a subject and a message first.'); return; }
        const addrs = testTo.split(/[,;\s]+/).map(s => s.trim()).filter(s => /\S+@\S+\.\S+/.test(s));
        if (!addrs.length) { showToast('Add at least one valid test email address.'); return; }
        const bodyHtml = fillLinks(body).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        setTesting(true);
        let ok = 0, fail = 0;
        await Promise.all(addrs.map(async to => {
            try {
                const footer = `<p style="font-size:11px;color:#94a3b8;margin-top:18px">This is a TEST send. The real campaign adds a personal unsubscribe / update link per recipient.</p>`;
                const html = brandedEmail(bodyHtml + footer);
                const { data, error } = await invokeFn('send-email', { body: { to, subject: `[TEST] ${subject.trim()}`, html, fromName: 'FBN Transport' } });
                if (error || (data as any)?.error) fail++; else ok++;
            } catch { fail++; }
        }));
        setTesting(false);
        showToast(`Test sent: ${ok} ok${fail ? ` · ${fail} failed` : ''}. Check the inbox before the real send.`);
    };

    const chip = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-lg border ${active ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`;
    const inp = 'w-full bg-white text-slate-800 p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#f5b700] focus:outline-none';

    return (
        <div className="space-y-4 max-w-3xl">
            <div>
                <h3 className="text-lg font-bold text-slate-900">Comms &amp; Marketing</h3>
                <p className="text-xs text-slate-500">Pick an audience + a template, and send one branded email. Marketing recipients get a personal unsubscribe / update link.</p>
            </div>

            <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Audience</p>
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setSource('clients')} className={chip(source === 'clients')}>Client CRM</button>
                    <button onClick={() => setSource('marketing')} className={chip(source === 'marketing')}>Marketing list (incl. prospects/carriers)</button>
                </div>
            </div>

            {/* Saved audiences — load a named segment, or save the current one. */}
            <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Saved audiences</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {saved.length === 0 && <span className="text-[11px] text-slate-400">None yet — set an audience below and save it for reuse.</span>}
                    {saved.map(a => (
                        <span key={a.name} className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
                            <button onClick={() => applyAudience(a)} className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">{a.name}</button>
                            <button onClick={() => deleteAudience(a.name)} title="Delete saved audience" className="px-2 py-1.5 text-xs text-slate-400 hover:text-rose-600 border-l border-slate-200">✕</button>
                        </span>
                    ))}
                    <button onClick={saveAudience} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50">＋ Save current</button>
                </div>
            </div>

            {/* Templates — client (sell our services) vs carrier (recruit transporters) */}
            <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start from a template {isCarrierAudience ? '· carrier recruitment' : '· client / sales'}</p>
                <div className="flex flex-wrap gap-1.5">
                    {templateSet.map(t => <button key={t.name} onClick={() => applyTemplate(t)} className={chip(subject === t.subject)}>{t.name}</button>)}
                </div>
                {isCarrierAudience && <p className="text-[11px] text-slate-500 mt-1.5">Carrier templates include a sign-up link to <span className="font-mono">/supplier-register</span> — recipients register their fleet &amp; lanes, then go through vetting before they receive loads.</p>}
            </div>

            {source === 'clients' ? (
                <>
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
                </>
            ) : (
                <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Marketing segment (opted-out excluded)</p>
                    <div className="flex flex-wrap gap-1.5">
                        {['all', 'prospect', 'client', 'carrier'].map(k => <button key={k} onClick={() => setMkKind(k)} className={chip(mkKind === k)}>{k === 'all' ? 'Everyone' : k}</button>)}
                    </div>
                </div>
            )}

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

            {/* Test send first — fire to yourself + a few people to check it looks right */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Test it first</p>
                <p className="text-[11px] text-amber-700/80">Send this exact email to yourself (and a few colleagues) before the real blast. Separate addresses with commas or spaces.</p>
                <div className="flex flex-wrap items-center gap-2">
                    <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@fbn-transport.co.za, colleague@…" className={`${inp} flex-1 min-w-[16rem]`} />
                    <button onClick={sendTest} disabled={testing || !subject.trim() || !body.trim()} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl whitespace-nowrap">
                        {testing ? 'Sending test…' : '✉️ Send test'}
                    </button>
                </div>
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
