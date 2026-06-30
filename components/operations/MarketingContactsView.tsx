import React, { useEffect, useMemo, useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { fetchMarketingContacts, addMarketingContacts, setOptOut, setBounced, prefsLink, importFromSheet, parseCsvContacts, MarketingContact } from '../../lib/marketingContacts';

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
    const [sheetUrl, setSheetUrl] = useState('');
    const [pulling, setPulling] = useState(false);
    const fileRef = React.useRef<HTMLInputElement>(null);

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

    // Shared: apply the chosen kind/tag to parsed rows and upsert.
    const addRows = async (parsed: { email: string; name?: string; company?: string }[], sourceLabel: string) => {
        if (!parsed.length) { showToast('No valid email addresses found.'); return; }
        const rows = parsed.map(r => ({ ...r, kind: importKind, tags: importTag.trim() ? [importTag.trim()] : [], source: sourceLabel }));
        const res = await addMarketingContacts(rows);
        if (!res.ok) { showToast(`Import failed: ${res.error}`); return; }
        showToast(`Imported ${res.count} contact${res.count === 1 ? '' : 's'} from ${sourceLabel} (duplicates skipped).`);
        load();
    };

    // Pull straight from a shared Google Sheet link (server-side).
    const pullSheet = async () => {
        if (!sheetUrl.trim()) { showToast('Paste a Google Sheet link first.'); return; }
        setPulling(true);
        const res = await importFromSheet(sheetUrl.trim());
        setPulling(false);
        if (!res.ok) { showToast(res.error || 'Could not read the sheet.'); return; }
        await addRows(res.rows, 'google-sheet');
        setSheetUrl('');
    };

    // Upload a CSV file (parsed in the browser).
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        await addRows(parseCsvContacts(text), 'csv-upload');
        if (fileRef.current) fileRef.current.value = '';
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
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Import / add contacts</p>

                {/* The kind/tag apply to whichever import method you use below. */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tag the imported as</span>
                    <select value={importKind} onChange={e => setImportKind(e.target.value)} className={inp}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
                    <input value={importTag} onChange={e => setImportTag(e.target.value)} placeholder="tag (optional, e.g. PE-prospects)" className={inp} />
                </div>

                {/* 1) Google Sheet link */}
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-600">📊 From a Google Sheet link</p>
                    <p className="text-[11px] text-slate-500">Paste the sheet link. It must be shared <strong>"Anyone with the link → Viewer"</strong>. We read the email / name / company columns automatically.</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className={`${inp} flex-1 min-w-[18rem]`} />
                        <button onClick={pullSheet} disabled={pulling || !sheetUrl.trim()} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-sm whitespace-nowrap">{pulling ? 'Pulling…' : 'Pull from sheet'}</button>
                    </div>
                </div>

                {/* 2) CSV file upload */}
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-600">📁 Upload a CSV / spreadsheet export</p>
                    <p className="text-[11px] text-slate-500">Export your sheet/Excel as <strong>.csv</strong> and upload it here.</p>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#13294b] file:text-white file:font-bold file:cursor-pointer" />
                </div>

                {/* 3) Paste */}
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-600">📋 Or paste rows</p>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={'Paste from a sheet (email · name · company columns), or:\nops@acme.co.za, John, ACME Logistics'} className={`${inp} w-full font-mono text-xs`} />
                    <button onClick={doImport} disabled={importing || !text.trim()} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-sm">{importing ? 'Importing…' : 'Import pasted'}</button>
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
