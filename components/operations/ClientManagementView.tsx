import React, { useState, useMemo } from 'react';
import { Client } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import * as XLSX from 'xlsx';

// Client CRM — clients grouped by category (Agent / Consolidator / Manufacturer /
// Carrier), each with its full contact team (roles, titles), plus a LEADS view
// that lists every contact who has asked FBN for a rate (quote-askers) so they
// can be targeted for more work.
const CATEGORIES = ['Clearing & Forwarding Agent', 'Consolidator', 'Broker', 'Manufacturer / Shipper', 'Carrier / Transporter', 'Other'];
const CAT_CHIP: Record<string, string> = {
    'Clearing & Forwarding Agent': 'bg-blue-100 text-blue-700',
    'Consolidator': 'bg-indigo-100 text-indigo-700',
    'Broker': 'bg-pink-100 text-pink-700',
    'Manufacturer / Shipper': 'bg-emerald-100 text-emerald-700',
    'Carrier / Transporter': 'bg-amber-100 text-amber-700',
    'Other': 'bg-slate-200 text-slate-600',
    'Uncategorised': 'bg-slate-100 text-slate-500',
};
const catOf = (c: any) => c.category || 'Uncategorised';

const ClientManagementView: React.FC = () => {
    const { showModal, showToast } = useUIState();
    const { clients, handleBulkAddClients, handleDeleteClient, handleConvertParty, handleUpdateClient } = useOperations() as any;
    const [q, setQ] = useState('');
    const [cat, setCat] = useState<string>('All');
    const [leads, setLeads] = useState(false);
    const [codOnly, setCodOnly] = useState(false);

    const active = useMemo(() => (clients as any[]).filter(c => c.isActive !== false), [clients]);
    const isCod = (c: any) => c.accountStatus === 'cod' || c.vetted === false;
    const codCount = useMemo(() => active.filter(isCod).length, [active]);
    const approveAccount = async (c: any) => {
        if (!window.confirm(`Approve ${c.name} for an ACCOUNT? (Moves them out of COD / Unauthorised.)`)) return;
        const res = await handleUpdateClient?.(c.id, { accountStatus: 'account', vetted: true } as any);
        if (res && res.ok === false) showToast(`Could not approve: ${res.error}`); else showToast(`${c.name} approved for account.`);
    };

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return active
            .filter(c => cat === 'All' || catOf(c) === cat)
            .filter(c => !codOnly || isCod(c))
            .filter(c => !needle || `${c.name || ''} ${c.contactPerson || ''} ${c.contactEmail || ''} ${(c.contacts || []).map((x: any) => `${x.name} ${x.email} ${x.title || ''}`).join(' ')}`.toLowerCase().includes(needle))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }, [active, q, cat, codOnly]);

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
    const groups = useMemo(() => {
        const order = [...CATEGORIES, 'Uncategorised'];
        const by: Record<string, any[]> = {};
        filtered.forEach(c => { const k = catOf(c); (by[k] = by[k] || []).push(c); });
        return order.filter(k => by[k]?.length).map(k => ({ cat: k, rows: by[k] }));
    }, [filtered]);

    const chip = (key: string, label: string, n: number) => (
        <button key={key} onClick={() => setCat(key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide whitespace-nowrap ${cat === key ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{label} <span className="opacity-60">{n}</span></button>
    );

    return (
        <div className="max-w-[1600px] mx-auto px-1">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-black text-[#13294b]">Clients — CRM</h3>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company, contact, email…" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700] w-64" />
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setLeads(l => !l)} className={`font-bold py-2 px-3 rounded-lg text-sm ${leads ? 'bg-[#f5b700] text-[#13294b]' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>🎯 Leads {leadRows.length ? `(${leadRows.length})` : ''}</button>
                    <button onClick={() => { setCodOnly(v => !v); setLeads(false); }} className={`font-bold py-2 px-3 rounded-lg text-sm ${codOnly ? 'bg-rose-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`} title="New / unvetted clients on COD — approve to an account when vetted">💰 COD / Unauthorised {codCount ? `(${codCount})` : ''}</button>
                    <label htmlFor="bulk-upload" className="flex items-center font-bold py-2 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer text-sm"><UploadIcon className="h-4 w-4 mr-1.5" /> Import</label>
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

            {leads ? (
                /* ---- LEADS / QUOTE-ASKERS ---- */
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 font-black text-[#13294b] text-sm uppercase tracking-wider">🎯 Quote-asker leads <span className="text-slate-400">({leadRows.length})</span></div>
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
                                    <th className="py-2 pl-3 px-2">Company</th><th className="py-2 px-2">Main contact</th><th className="py-2 px-2">Team</th><th className="py-2 px-2">Primary email</th><th className="py-2 px-2 text-right pr-3">Actions</th>
                                </tr></thead>
                                <tbody>
                                    {g.rows.map(client => {
                                        const contacts = client.contacts || [];
                                        const main = contacts.find((c: any) => c.getsUpdates) || contacts[0];
                                        const qn = contacts.filter((c: any) => c.quotes).length;
                                        return (
                                            <tr key={client.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                                                <td className="py-2 pl-3 px-2"><button onClick={() => showModal('partnerDetail', { partner: client, kind: 'client' })} className="font-bold text-[#13294b] hover:underline text-left">{client.name}</button></td>
                                                <td className="py-2 px-2 text-slate-700">{main?.name || client.contactPerson || '—'}{main?.title && <div className="text-[11px] text-slate-400">{main.title}</div>}</td>
                                                <td className="py-2 px-2 text-slate-500">{contacts.length} contact{contacts.length === 1 ? '' : 's'}{qn ? <span className="ml-1 text-[10px] font-bold text-amber-600">· {qn} lead{qn === 1 ? '' : 's'}</span> : ''}</td>
                                                <td className="py-2 px-2 text-blue-700">{main?.email || client.contactEmail || '—'}</td>
                                                <td className="py-2 px-2 text-right pr-3 space-x-2 whitespace-nowrap">
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
