import React, { useEffect, useMemo, useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { fetchMarketingContacts, addMarketingContacts, setOptOut, setBounced, prefsLink, MarketingContact } from '../../lib/marketingContacts';

// CRM Phase 1 — the marketing audience + opt-in/out. Import emails (clients,
// carriers, prospects), segment by kind/tag, and manage opt-out. Campaigns +
// designed templates build on top of this list (phase 2).
const KINDS = ['prospect', 'client', 'carrier'] as const;

const MarketingContactsView: React.FC = () => {
    const { showToast } = useUIState();
    const [rows, setRows] = useState<MarketingContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [kindFilter, setKindFilter] = useState<string>('all');
    const [optFilter, setOptFilter] = useState<'all' | 'in' | 'out' | 'bounced'>('all');
    // Import
    const [importing, setImporting] = useState(false);
    const [text, setText] = useState('');
    const [importKind, setImportKind] = useState<string>('prospect');
    const [importTag, setImportTag] = useState('');

    const load = async () => { setLoading(true); setRows(await fetchMarketingContacts()); setLoading(false); };
    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return rows
            .filter(r => kindFilter === 'all' || r.kind === kindFilter)
            .filter(r => optFilter === 'all' || (optFilter === 'out' ? r.optedOut : optFilter === 'bounced' ? r.bounced : (!r.optedOut && !r.bounced)))
            .filter(r => !needle || `${r.email} ${r.name || ''} ${r.company || ''} ${(r.tags || []).join(' ')}`.toLowerCase().includes(needle));
    }, [rows, q, kindFilter, optFilter]);

    const counts = useMemo(() => ({
        total: rows.length, optedOut: rows.filter(r => r.optedOut).length,
        prospect: rows.filter(r => r.kind === 'prospect').length, client: rows.filter(r => r.kind === 'client').length, carrier: rows.filter(r => r.kind === 'carrier').length,
        bounced: rows.filter(r => r.bounced).length,
    }), [rows]);
    const markBounced = async (c: MarketingContact) => {
        const res = await setBounced(c.id, !c.bounced);
        if (!res.ok) { showToast(`Could not update: ${res.error}`); return; }
        setRows(rs => rs.map(r => r.id === c.id ? { ...r, bounced: !c.bounced } : r));
    };

    // Parse pasted lines: "email, name, company" (comma-separated) or just an email per line.
    const doImport = async () => {
        const parsed = text.split(/\r?\n/).map(line => {
            const parts = line.split(/[,\t]/).map(p => p.trim());
            const email = parts.find(p => /\S+@\S+\.\S+/.test(p)) || '';
            const rest = parts.filter(p => p !== email);
            return { email, name: rest[0] || undefined, company: rest[1] || undefined, kind: importKind, tags: importTag.trim() ? [importTag.trim()] : [], source: 'import' };
        }).filter(r => r.email);
        if (!parsed.length) { showToast('No valid email addresses in the paste box.'); return; }
        setImporting(true);
        const res = await addMarketingContacts(parsed);
        setImporting(false);
        if (!res.ok) { showToast(`Import failed: ${res.error}`); return; }
        showToast(`Imported ${res.count} contact${res.count === 1 ? '' : 's'} (duplicates skipped).`);
        setText(''); load();
    };
    const toggleOpt = async (c: MarketingContact) => {
        const res = await setOptOut(c.id, !c.optedOut);
        if (!res.ok) { showToast(`Could not update: ${res.error}`); return; }
        setRows(rs => rs.map(r => r.id === c.id ? { ...r, optedOut: !c.optedOut } : r));
    };

    const inp = 'bg-white text-slate-800 p-2 rounded-lg border border-slate-300 text-sm';
    const Card: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone }) => (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className={`text-lg font-black ${tone || 'text-slate-900'}`}>{value}</div></div>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card label="Contacts" value={counts.total} />
                <Card label="Clients" value={counts.client} />
                <Card label="Carriers" value={counts.carrier} />
                <Card label="Prospects" value={counts.prospect} />
                <Card label="Opted out" value={counts.optedOut} tone="text-rose-600" />
            </div>

            {/* Import */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Import / add contacts</p>
                <p className="text-[11px] text-slate-500">Paste straight from <strong>Google Sheets / Excel</strong> (copy the cells) or type one per line — email, name, company. Duplicates are skipped.</p>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={'Paste from a sheet (email · name · company columns), or:\nops@acme.co.za, John, ACME Logistics'} className={`${inp} w-full font-mono text-xs`} />
                <div className="flex flex-wrap items-center gap-2">
                    <select value={importKind} onChange={e => setImportKind(e.target.value)} className={inp}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
                    <input value={importTag} onChange={e => setImportTag(e.target.value)} placeholder="tag (optional, e.g. PE-prospects)" className={inp} />
                    <button onClick={doImport} disabled={importing || !text.trim()} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-sm">{importing ? 'Importing…' : 'Import'}</button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email / name / company / tag…" className={`${inp} w-56`} />
                <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className={inp}><option value="all">All kinds</option>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {(['all', 'in', 'out', 'bounced'] as const).map(f => <button key={f} onClick={() => setOptFilter(f)} className={`px-2.5 py-1 text-xs font-bold rounded-md ${optFilter === f ? 'bg-[#13294b] text-white' : 'text-slate-600'}`}>{f === 'all' ? 'All' : f === 'in' ? 'Opted in' : f === 'out' ? `Opted out (${counts.optedOut})` : `Bounced (${counts.bounced})`}</button>)}
                </div>
                <span className="text-xs text-slate-400 ml-auto">{filtered.length} shown</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2 pl-3 px-2">Email</th><th className="py-2 px-2">Name</th><th className="py-2 px-2">Company</th><th className="py-2 px-2">Kind</th><th className="py-2 px-2">Tags</th><th className="py-2 px-2 text-right pr-3">Status</th>
                    </tr></thead>
                    <tbody>
                        {loading && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>}
                        {!loading && filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No contacts. Paste some above to get started.</td></tr>}
                        {filtered.map(c => (
                            <tr key={c.id} className={`border-b border-slate-100 ${c.bounced ? 'bg-orange-50/50' : c.optedOut ? 'bg-rose-50/40' : 'hover:bg-slate-50'}`}>
                                <td className="py-2 pl-3 px-2 text-blue-700">{c.email}{c.bounced && <span className="ml-2 text-[9px] font-black uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">bounced</span>}</td>
                                <td className="py-2 px-2 text-slate-700">{c.name || '—'}</td>
                                <td className="py-2 px-2 text-slate-600">{c.company || '—'}</td>
                                <td className="py-2 px-2"><span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{c.kind}</span></td>
                                <td className="py-2 px-2 text-slate-500 text-xs">{(c.tags || []).join(', ') || '—'}</td>
                                <td className="py-2 px-2 text-right pr-3 whitespace-nowrap">
                                    <button onClick={() => { navigator.clipboard?.writeText(prefsLink(c)); showToast('Self-service link copied — send it to them to update/opt-out.'); }} title="Copy a link they can click to update their details / add colleagues / opt out" className="text-[11px] font-bold text-blue-600 hover:underline mr-3">🔗 link</button>
                                    {c.optedOut
                                        ? <button onClick={() => toggleOpt(c)} className="text-[11px] font-bold text-rose-600">opted out · re-opt-in</button>
                                        : <button onClick={() => toggleOpt(c)} className="text-[11px] font-bold text-emerald-700 hover:underline">opted in · opt out</button>}
                                    <button onClick={() => markBounced(c)} title="Mark this address as invalid/bounced — it stays on file but is excluded from all sends" className={`text-[11px] font-bold ml-3 ${c.bounced ? 'text-orange-600' : 'text-slate-400 hover:text-orange-600'}`}>{c.bounced ? 'bounced · clear' : 'mark invalid'}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[11px] text-slate-400">Opted-out contacts are never emailed. A one-click unsubscribe link will be added to campaign emails (phase 2).</p>
        </div>
    );
};

export default MarketingContactsView;
