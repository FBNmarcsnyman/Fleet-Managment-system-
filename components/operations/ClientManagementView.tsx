import React, { useState, useMemo } from 'react';
import { Client } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import * as XLSX from 'xlsx';

// Normalise a company name for matching (lowercase, drop legal suffixes + punctuation).
const normName = (s: string) => String(s || '')
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|cc|inc|incorporated|\(pty\)|t\/a|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Client CRM — clients grouped by category (Agent / Consolidator / Manufacturer /
// Carrier), each with its full contact team (roles, titles), plus a LEADS view
// that lists every contact who has asked FBN for a rate (quote-askers) so they
// can be targeted for more work.
const CATEGORIES = ['Clearing & Forwarding Agent', 'Consolidator', 'Broker', 'Manufacturer / Shipper', 'Carrier / Transporter', 'Carrier Partner', 'Other'];
const CAT_CHIP: Record<string, string> = {
    'Clearing & Forwarding Agent': 'bg-blue-100 text-blue-700',
    'Consolidator': 'bg-indigo-100 text-indigo-700',
    'Broker': 'bg-pink-100 text-pink-700',
    'Manufacturer / Shipper': 'bg-emerald-100 text-emerald-700',
    'Carrier / Transporter': 'bg-amber-100 text-amber-700',
    'Carrier Partner': 'bg-amber-200 text-amber-800',
    'Other': 'bg-slate-200 text-slate-600',
    'Uncategorised': 'bg-slate-100 text-slate-500',
};
const catOf = (c: any) => c.category || 'Uncategorised';

const ClientManagementView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { clients, handleBulkAddClients, handleAddClient, handleDeleteClient, handleConvertParty, handleUpdateClient, handleApproveClientRegistration } = useOperations() as any;
    const [q, setQ] = useState('');
    const [cat, setCat] = useState<string>('All');
    const [leads, setLeads] = useState(false);
    const [codOnly, setCodOnly] = useState(false);
    const [pendingOnly, setPendingOnly] = useState(false);
    const [partnerOnly, setPartnerOnly] = useState(false);
    const [docsOnly, setDocsOnly] = useState(false);
    // Account paperwork: signed credit application + signed T&Cs. "Outstanding" =
    // an approved-account client still missing one of them.
    const hasCreditApp = (c: any) => !!c.creditApplicationSigned;
    const hasTerms = (c: any) => !!c.termsSigned;
    const docsOutstanding = (c: any) => c.accountStatus !== 'cod' && (!hasCreditApp(c) || !hasTerms(c));
    const toggleDoc = async (c: any, field: 'creditApplicationSigned' | 'termsSigned', e: React.MouseEvent) => {
        e.stopPropagation();
        const now = !c[field];
        const stamp = field === 'creditApplicationSigned' ? 'creditApplicationSignedAt' : 'termsSignedAt';
        const res = await handleUpdateClient?.(c.id, { [field]: now, [stamp]: now ? new Date().toISOString() : null } as any);
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
        else showToast(`${c.name}: ${field === 'creditApplicationSigned' ? 'Credit application' : 'Terms'} ${now ? 'marked signed' : 'cleared'}.`);
    };
    // ★ Toggle a company as a strategic Network Partner (own-fleet carrier we build with).
    const togglePartner = async (c: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const res = await handleUpdateClient?.(c.id, { networkPartner: !c.networkPartner } as any);
        if (res && res.ok === false) showToast(`Could not update: ${res.error}`);
        else showToast(c.networkPartner ? `${c.name} removed from Network Partners.` : `★ ${c.name} marked a Network Partner.`);
    };

    const active = useMemo(() => (clients as any[]).filter(c => c.isActive !== false), [clients]);
    const isCod = (c: any) => c.accountStatus === 'cod' || c.vetted === false;
    const isPending = (c: any) => c.registrationStatus === 'pending';
    const codCount = useMemo(() => active.filter(isCod).length, [active]);
    const pendingCount = useMemo(() => active.filter(isPending).length, [active]);
    const approveAccount = async (c: any) => {
        if (!window.confirm(`Approve ${c.name} for an ACCOUNT? (Moves them out of COD / Unauthorised.)`)) return;
        const res = await handleUpdateClient?.(c.id, { accountStatus: 'account', vetted: true } as any);
        if (res && res.ok === false) showToast(`Could not approve: ${res.error}`); else showToast(`${c.name} approved for account.`);
    };
    const approveRegistration = async (c: any) => {
        if (!window.confirm(`Approve ${c.name}'s registration? This creates their portal login and emails them a welcome with credentials.`)) return;
        showToast(`Approving ${c.name}…`);
        const res = await handleApproveClientRegistration?.(c);
        if (res?.ok) showToast(`${c.name} approved — login emailed${res.value?.tempPassword ? ` (temp password: ${res.value.tempPassword})` : ''}.`);
        else showToast(`Could not approve: ${res?.error}`);
    };

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return active
            .filter(c => cat === 'All' || catOf(c) === cat)
            .filter(c => !codOnly || isCod(c))
            .filter(c => !pendingOnly || isPending(c))
            .filter(c => !partnerOnly || c.networkPartner)
            .filter(c => !docsOnly || docsOutstanding(c))
            .filter(c => !needle || `${c.name || ''} ${c.contactPerson || ''} ${c.contactEmail || ''} ${(c.contacts || []).map((x: any) => `${x.name} ${x.email} ${x.title || ''}`).join(' ')}`.toLowerCase().includes(needle))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }, [active, q, cat, codOnly, pendingOnly, partnerOnly, docsOnly]);
    const partnerCount = useMemo(() => active.filter(c => c.networkPartner).length, [active]);
    const docsCount = useMemo(() => active.filter(docsOutstanding).length, [active]);

    // Counts per category (for the filter chips).
    const counts = useMemo(() => { const m: Record<string, number> = {}; active.forEach(c => { const k = catOf(c); m[k] = (m[k] || 0) + 1; }); return m; }, [active]);

    // Leads = every quote-asking contact across the filtered clients.
    const leadRows = useMemo(() => {
        const out: { company: string; companyId: string; client: any; name: string; title?: string; email?: string; phone?: string; role?: string }[] = [];
        filtered.forEach(c => (c.contacts || []).forEach((p: any) => { if (p.quotes) out.push({ company: c.name, companyId: c.id, client: c, name: p.name, title: p.title, email: p.email, phone: p.phone, role: p.role }); }));
        return out.sort((a, b) => a.company.localeCompare(b.company) || a.name.localeCompare(b.name));
    }, [filtered]);

    const handleDelete = async (client: any) => {
        if (!confirm(`Remove ${client.name}? They'll be hidden from your list (past loads & history are kept).`)) return;
        const res = await handleDeleteClient(client.id);
        if (!res.ok) showToast(`Could not remove: ${res.error}`); else showToast(`${client.name} removed.`);
    };

    const toTransporter = async (client: any) => {
        if (!confirm(`Move ${client.name} to Transporters? They become a carrier (you can offer them loads) and leave the Clients list.`)) return;
        const res = await handleConvertParty(client.id, 'supplier');
        if (res?.ok === false) showToast(`Could not move: ${res.error}`); else showToast(`${client.name} moved to Transporters.`);
    };

    // ── Import approved clients (account codes) — matches existing by name & UPDATES
    // them (no duplicates); creates any that aren't on file yet. ──────────────────
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [markPaperwork, setMarkPaperwork] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ updated: number; created: number; rows: number } | null>(null);

    // Turn a 2D table into {accountCode, name, email} rows. Detects a header row;
    // otherwise infers which column is the code (short, no spaces) vs the name.
    const parseClientTable = (table: string[][]): { accountCode?: string; name: string; email?: string }[] => {
        const rows = table.map(r => r.map(c => (c ?? '').toString().trim())).filter(r => r.some(c => c));
        if (!rows.length) return [];
        const emailRe = /\S+@\S+\.\S+/;
        const header = rows[0].map(h => h.toLowerCase());
        const looksHeader = header.some(h => /name|client|company|customer|code|account|acc no|acc\b/.test(h)) && !header.some(h => emailRe.test(h));
        let codeCol = -1, nameCol = -1, emailCol = -1;
        if (looksHeader) {
            header.forEach((h, i) => {
                if (codeCol < 0 && /(acc|account).*?(code|no|number)|^code$|^acc$/.test(h)) codeCol = i;
                else if (nameCol < 0 && /name|client|company|customer/.test(h)) nameCol = i;
                else if (emailCol < 0 && /mail/.test(h)) emailCol = i;
            });
        }
        const dataRows = looksHeader ? rows.slice(1) : rows;
        // Infer columns when there's no header.
        if (nameCol < 0) {
            const colCount = Math.max(...dataRows.map(r => r.length));
            // The "name" column = the one with the longest average text; "code" = a
            // short, space-free column that isn't the name.
            const avgLen = Array.from({ length: colCount }, (_, i) => dataRows.reduce((s, r) => s + (r[i]?.length || 0), 0) / dataRows.length);
            nameCol = avgLen.indexOf(Math.max(...avgLen));
            for (let i = 0; i < colCount; i++) {
                if (i === nameCol) continue;
                const vals = dataRows.map(r => r[i] || '').filter(Boolean);
                if (vals.length && vals.every(v => v.length <= 14 && !/\s{2,}/.test(v))) { codeCol = i; break; }
            }
        }
        return dataRows.map(r => ({
            accountCode: codeCol >= 0 ? (r[codeCol] || undefined) : undefined,
            name: (nameCol >= 0 ? r[nameCol] : r.find(c => !emailRe.test(c))) || '',
            email: emailCol >= 0 ? (r[emailCol] || undefined) : (r.find(c => emailRe.test(c)) || undefined),
        })).filter(x => x.name);
    };

    const runApprovedImport = async (parsed: { accountCode?: string; name: string; email?: string }[]) => {
        if (!parsed.length) { showToast('No client rows found — check the columns (Company name + Account code).'); return; }
        setImporting(true);
        const byName = new Map<string, any>();
        (clients as any[]).forEach(c => byName.set(normName(c.name), c));
        const paperwork = markPaperwork ? { creditApplicationSigned: true, creditApplicationSignedAt: new Date().toISOString(), termsSigned: true, termsSignedAt: new Date().toISOString() } : {};
        let updated = 0, created = 0;
        for (const row of parsed) {
            const existing = byName.get(normName(row.name));
            if (existing) {
                await handleUpdateClient?.(existing.id, { accountCode: row.accountCode, accountStatus: 'account', vetted: true, ...paperwork } as any);
                updated++;
            } else {
                await handleAddClient?.({ name: row.name, contactEmail: row.email || '', accountCode: row.accountCode, accountStatus: 'account', vetted: true, address: '', contacts: row.email ? [{ name: row.name, email: row.email, getsUpdates: true }] : [], ...paperwork } as any);
                created++;
            }
        }
        setImporting(false);
        setImportResult({ updated, created, rows: parsed.length });
        setImportText('');
        showToast(`Approved-client import done: ${updated} updated, ${created} added.`);
    };

    const importFromPaste = () => {
        const table = importText.split(/\r?\n/).map(line => line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '')));
        runApprovedImport(parseClientTable(table));
    };
    const importApprovedFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target?.result, { type: 'array' });
                const table = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as string[][];
                runApprovedImport(parseClientTable(table));
            } catch (err) { showToast(`Could not read file: ${err instanceof Error ? err.message : 'error'}`); }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'array' });
                const json = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]]);
                const newClients: Omit<Client, 'id'>[] = json.map(row => ({
                    name: row['Company Name'], contactPerson: row['Contact Person'], contactEmail: row['Email'], contactPhone: row['Phone'], address: row['Address'],
                }));
                handleBulkAddClients(newClients);
                alert(`Successfully imported ${newClients.length} clients.`);
            } catch (error) { alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`); }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    // Group the filtered list by category for the sectioned table.
    // Sort within each category group (tap a column header).
    type CSort = 'company' | 'contact' | 'email' | 'docs';
    const [sortKey, setSortKey] = useState<CSort>('company');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const setSort = (k: CSort) => { if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir(k === 'docs' ? 'asc' : 'asc'); } };
    const mainOf = (c: any) => (c.contacts || []).find((p: any) => p.getsUpdates) || (c.contacts || [])[0];
    const groups = useMemo(() => {
        const order = [...CATEGORIES, 'Uncategorised'];
        const by: Record<string, any[]> = {};
        filtered.forEach(c => { const k = catOf(c); (by[k] = by[k] || []).push(c); });
        const val = (c: any): string | number => {
            switch (sortKey) {
                case 'contact': return (mainOf(c)?.name || c.contactPerson || '').toLowerCase();
                case 'email': return (mainOf(c)?.email || c.contactEmail || '').toLowerCase();
                case 'docs': return (hasCreditApp(c) ? 1 : 0) + (hasTerms(c) ? 1 : 0); // outstanding first when asc
                case 'company': default: return (c.name || '').toLowerCase();
            }
        };
        const dir = sortDir === 'asc' ? 1 : -1;
        const sortRows = (rows: any[]) => [...rows].sort((a, b) => {
            const av = val(a), bv = val(b);
            if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * dir;
            return (av - bv) * dir;
        });
        return order.filter(k => by[k]?.length).map(k => ({ cat: k, rows: sortRows(by[k]) }));
    }, [filtered, sortKey, sortDir]);
    const Th: React.FC<{ k: CSort; label: string; className?: string }> = ({ k, label, className }) => (
        <th className={className}><button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-[#13294b] ${sortKey === k ? 'text-[#13294b] font-bold' : ''}`}>{label}{sortKey === k && <span className="text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}</button></th>
    );

    const chip = (key: string, label: string, n: number) => (
        <button key={key} onClick={() => setCat(key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide whitespace-nowrap ${cat === key ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{label} <span className="opacity-60">{n}</span></button>
    );

    return (
        <div className="max-w-[1600px] mx-auto px-1">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
                    <h3 className="text-xl font-black text-[#13294b]">Clients — CRM</h3>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company, contact, email…" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700] flex-1 min-w-[12rem] sm:w-64 sm:flex-initial" />
                </div>
                <div className="flex items-center flex-wrap gap-2">
                    <button onClick={() => setLeads(l => !l)} className={`font-bold py-2 px-3 rounded-lg text-sm ${leads ? 'bg-[#f5b700] text-[#13294b]' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Leads {leadRows.length ? `(${leadRows.length})` : ''}</button>
                    <button onClick={() => { setPendingOnly(v => !v); setLeads(false); }} className={`font-bold py-2 px-3 rounded-lg text-sm ${pendingOnly ? 'bg-amber-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`} title="Self-registered clients awaiting approval">Pending approval {pendingCount ? `(${pendingCount})` : ''}</button>
                    <button onClick={() => { setCodOnly(v => !v); setLeads(false); }} className={`font-bold py-2 px-3 rounded-lg text-sm ${codOnly ? 'bg-rose-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`} title="New / unvetted clients on COD — approve to an account when vetted">COD / Unauthorised {codCount ? `(${codCount})` : ''}</button>
                    <button onClick={() => { setPartnerOnly(v => !v); setLeads(false); }} className={`font-bold py-2 px-3 rounded-lg text-sm ${partnerOnly ? 'bg-amber-400 text-[#13294b]' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`} title="Strategic network/consortium partners — own-fleet carriers we build with">★ Network Partners {partnerCount ? `(${partnerCount})` : ''}</button>
                    <button onClick={() => { setDocsOnly(v => !v); setLeads(false); }} className={`font-bold py-2 px-3 rounded-lg text-sm ${docsOnly ? 'bg-orange-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`} title="Account clients missing a signed credit application or signed terms">Docs outstanding {docsCount ? `(${docsCount})` : ''}</button>
                    <button onClick={() => { setShowImport(v => !v); setImportResult(null); }} className={`flex items-center font-bold py-2 px-3 rounded-lg text-sm ${showImport ? 'bg-[#13294b] text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`} title="Import your approved-client list with account codes — matches existing clients and updates them">⬆ Import approved (codes)</button>
                    <label htmlFor="bulk-upload" className="flex items-center font-bold py-2 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer text-sm"><UploadIcon className="h-4 w-4 mr-1.5" /> Import (new only)</label>
                    <input id="bulk-upload" type="file" onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                    <button onClick={() => showModal('addClient')} className="flex items-center font-bold py-2 px-3 rounded-lg bg-[#13294b] hover:bg-[#1d3a66] text-white text-sm"><PlusIcon className="h-4 w-4 mr-1.5" /> Add Client</button>
                </div>
            </div>

            {/* Category filter chips */}
            <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap pb-2 mb-2">
                {chip('All', 'All', active.length)}
                {CATEGORIES.map(c => chip(c, c.replace(' / Shipper', '').replace(' & Forwarding Agent', ' Agent').replace(' / Transporter', ''), counts[c] || 0))}
                {counts['Uncategorised'] ? chip('Uncategorised', 'Uncategorised', counts['Uncategorised']) : null}
            </div>

            {/* ---- IMPORT APPROVED CLIENTS (account codes) ---- */}
            {showImport && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3 space-y-2">
                    <h4 className="font-black text-[#13294b] text-sm">⬆ Import approved clients (with account codes)</h4>
                    <p className="text-[12px] text-slate-600">Paste from your accounting system (or upload the export). Include a <strong>Company name</strong> column and an <strong>Account code</strong> column (an Email column is optional). Existing clients are <strong>matched by name and updated</strong> — no duplicates; any not on file are added as approved account clients.</p>
                    <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={5} placeholder={'Paste rows, e.g.:\nAccount code\tCompany name\nACME001\tACME Logistics CC\nDHL005\tDHL Global Forwarding'} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-mono" />
                    <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={markPaperwork} onChange={e => setMarkPaperwork(e.target.checked)} className="h-4 w-4 rounded" />
                        These are fully approved — also mark <strong>credit application</strong> &amp; <strong>terms</strong> as signed
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={importFromPaste} disabled={importing || !importText.trim()} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-sm">{importing ? 'Importing…' : 'Import pasted rows'}</button>
                        <label className="flex items-center font-bold py-2 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer text-sm"><UploadIcon className="h-4 w-4 mr-1.5" /> Upload .xlsx / .csv
                            <input type="file" onChange={importApprovedFile} className="hidden" accept=".xlsx,.xls,.csv" /></label>
                        {importResult && <span className="text-[12px] font-bold text-emerald-700">✓ {importResult.rows} rows — {importResult.updated} updated, {importResult.created} added.</span>}
                    </div>
                </div>
            )}

            {leads ? (
                /* ---- LEADS / QUOTE-ASKERS ---- */
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 font-black text-[#13294b] text-sm uppercase tracking-wider">Quote-asker leads <span className="text-slate-400">({leadRows.length})</span></div>
                    {leadRows.length === 0 ? <div className="px-4 py-10 text-center text-slate-400 text-sm">No quote-asker contacts in this filter.</div> : (
                        <div className="overflow-x-auto"><table className="w-full text-sm">
                            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                <th className="py-2 pl-3 px-2">Company</th><th className="py-2 px-2">Contact</th><th className="py-2 px-2">Title</th><th className="py-2 px-2">Email</th><th className="py-2 px-2">Cell</th>
                            </tr></thead>
                            <tbody>{leadRows.map((l, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-amber-50/40 cursor-pointer" onClick={() => showModal('partnerDetail', { partner: l.client, kind: 'client' })}>
                                    <td className="py-2 pl-3 px-2 font-bold text-[#13294b]">{l.company}</td>
                                    <td className="py-2 px-2 text-slate-700">{l.name}</td>
                                    <td className="py-2 px-2 text-slate-500">{l.title || '—'}</td>
                                    <td className="py-2 px-2 text-blue-700">{l.email || '—'}</td>
                                    <td className="py-2 px-2 text-slate-600">{l.phone || '—'}</td>
                                </tr>
                            ))}</tbody>
                        </table></div>
                    )}
                </div>
            ) : (
                /* ---- CLIENTS BY CATEGORY ---- */
                <div className="space-y-4">
                    {groups.map(g => (
                        <div key={g.cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${CAT_CHIP[g.cat]}`}>{g.cat}</span>
                                <span className="text-xs font-bold text-slate-400">{g.rows.length}</span>
                            </div>
                            <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <Th k="company" label="Company" className="py-2 pl-3 px-2" /><Th k="contact" label="Main contact" className="py-2 px-2" /><th className="py-2 px-2">Team</th><Th k="email" label="Primary email" className="py-2 px-2" /><Th k="docs" label="Account & docs" className="py-2 px-2" /><th className="py-2 px-2 text-right pr-3">Actions</th>
                                </tr></thead>
                                <tbody>
                                    {g.rows.map(client => {
                                        const contacts = client.contacts || [];
                                        const main = contacts.find((c: any) => c.getsUpdates) || contacts[0];
                                        const qn = contacts.filter((c: any) => c.quotes).length;
                                        return (
                                            <tr key={client.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                                                <td className="py-2 pl-3 px-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <button onClick={e => togglePartner(client, e)} title={client.networkPartner ? 'Network Partner — click to remove' : 'Mark as a ★ Network Partner'} className={`text-base leading-none ${client.networkPartner ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}>{client.networkPartner ? '★' : '☆'}</button>
                                                        <button onClick={() => showModal('partnerDetail', { partner: client, kind: 'client' })} className="font-bold text-[#13294b] hover:underline text-left">{client.name}</button>
                                                    </div>
                                                    {client.accountCode && <div className="text-[10px] font-mono text-slate-400 ml-6">#{client.accountCode}</div>}
                                                </td>
                                                <td className="py-2 px-2 text-slate-700">{main?.name || client.contactPerson || '—'}{main?.title && <div className="text-[11px] text-slate-400">{main.title}</div>}</td>
                                                <td className="py-2 px-2 text-slate-500">{contacts.length} contact{contacts.length === 1 ? '' : 's'}{qn ? <span className="ml-1 text-[10px] font-bold text-amber-600">· {qn} lead{qn === 1 ? '' : 's'}</span> : ''}</td>
                                                <td className="py-2 px-2 text-blue-700">{main?.email || client.contactEmail || '—'}</td>
                                                <td className="py-2 px-2 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        {isCod(client)
                                                            ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700" title="COD / unauthorised — not on account terms">COD</span>
                                                            : <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700" title="Approved — on account">ACCOUNT</span>}
                                                        <button onClick={e => toggleDoc(client, 'creditApplicationSigned', e)} title={hasCreditApp(client) ? `Credit application signed${client.creditApplicationSignedAt ? ' ' + new Date(client.creditApplicationSignedAt).toLocaleDateString('en-ZA') : ''} — click to clear` : 'Credit application NOT on file — click to mark signed'} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${hasCreditApp(client) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600'}`}>{hasCreditApp(client) ? '✓' : '✗'} Credit</button>
                                                        <button onClick={e => toggleDoc(client, 'termsSigned', e)} title={hasTerms(client) ? `Terms signed${client.termsSignedAt ? ' ' + new Date(client.termsSignedAt).toLocaleDateString('en-ZA') : ''} — click to clear` : 'Terms NOT signed — click to mark signed'} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${hasTerms(client) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600'}`}>{hasTerms(client) ? '✓' : '✗'} Terms</button>
                                                    </div>
                                                </td>
                                                <td className="py-2 px-2 text-right pr-3 space-x-2 whitespace-nowrap">
                                                    {isPending(client) && <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700" title="Self-registered — awaiting approval">PENDING</span>}
                                                    {isPending(client) && <button onClick={() => approveRegistration(client)} title="Approve registration — creates their login + emails a welcome" className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">✓ Approve &amp; create login</button>}
                                                    {isCod(client) && <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700" title="COD / unauthorised — vet before granting account terms">COD</span>}
                                                    {isCod(client) && <button onClick={() => approveAccount(client)} title="Vetted — approve for an account" className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">✓ Approve account</button>}
                                                    <button onClick={() => showModal('addClient', { client })} className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">Edit</button>
                                                    <button onClick={() => toTransporter(client)} title="This is actually a carrier — move it to Transporters so you can offer it loads" className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-600 text-xs font-bold">→ Transporter</button>
                                                    <button onClick={() => handleDelete(client)} className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-red-500 hover:text-white text-slate-600 text-xs font-bold">Remove</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table></div>
                        </div>
                    ))}
                    {groups.length === 0 && <div className="bg-white border border-slate-200 rounded-xl px-4 py-10 text-center text-slate-400 text-sm">No clients match.</div>}
                </div>
            )}
        </div>
    );
};

export default ClientManagementView;
