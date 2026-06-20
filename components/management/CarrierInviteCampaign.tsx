import React, { useMemo, useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { DEFAULT_INVITE_INTRO } from '../../contexts/OperationsContext';
import { SubcontractorInvite } from '../../types';
import { SparklesIcon } from '../icons/SparklesIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { format } from 'date-fns';

const STATUS_STYLES: Record<string, string> = {
    Pending: 'text-gray-300 bg-gray-700/60',
    Invited: 'text-blue-300 bg-blue-900/40',
    Applied: 'text-amber-300 bg-amber-900/40',
    Vetted: 'text-emerald-300 bg-emerald-900/40',
    Declined: 'text-red-300 bg-red-900/40',
};

// Parse pasted text into { email, companyName } entries. Accepts one entry per
// line or comma-separated; an optional company can follow the email after a
// comma/semicolon/tab, e.g. "ops@bluestar.co.za, Blue Star Logistics".
const parseEntries = (raw: string): { email: string; companyName?: string }[] => {
    const out: { email: string; companyName?: string }[] = [];
    raw.split(/[\n\r]+/).forEach(line => {
        const parts = line.split(/[,;\t]/).map(p => p.trim()).filter(Boolean);
        if (!parts.length) return;
        const emailPart = parts.find(p => p.includes('@'));
        if (!emailPart) return;
        const company = parts.filter(p => p !== emailPart).join(' ').trim() || undefined;
        out.push({ email: emailPart, companyName: company });
    });
    return out;
};

const CarrierInviteCampaign: React.FC = () => {
    const { subcontractorInvites = [], handleAddSubcontractorInvites, handleSendSubcontractorInvites, handleUpdateSubcontractorInvite } = useOperations() as any;
    const { showToast } = useUIState();

    const [raw, setRaw] = useState('');
    const [adding, setAdding] = useState(false);
    const [sending, setSending] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [subject, setSubject] = useState('Partner with FBN Transport — join our carrier network');
    const [intro, setIntro] = useState(DEFAULT_INVITE_INTRO.trim());

    const invites: SubcontractorInvite[] = useMemo(
        () => [...subcontractorInvites].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
        [subcontractorInvites],
    );

    const funnel = useMemo(() => ({
        total: invites.length,
        invited: invites.filter(i => i.status === 'Invited' || i.status === 'Applied' || i.status === 'Vetted').length,
        applied: invites.filter(i => i.status === 'Applied').length,
        vetted: invites.filter(i => i.status === 'Vetted').length,
    }), [invites]);

    const parsedCount = useMemo(() => parseEntries(raw).length, [raw]);

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const allSelected = invites.length > 0 && selected.size === invites.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(invites.map(i => i.id)));

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setRaw(prev => (prev ? prev + '\n' : '') + String(ev.target?.result || ''));
        reader.readAsText(file);
    };

    const handleAdd = async () => {
        const entries = parseEntries(raw);
        if (!entries.length) { showToast('No valid email addresses found.'); return; }
        setAdding(true);
        const res = await handleAddSubcontractorInvites(entries);
        setAdding(false);
        if (!res?.ok) { showToast(res?.error || 'Could not add carriers.'); return; }
        setRaw('');
        showToast(`${res.value.added} carrier(s) added${res.value.skipped ? `, ${res.value.skipped} skipped (already on the list)` : ''}.`);
    };

    const send = async (ids: string[]) => {
        if (!ids.length) { showToast('No carriers selected.'); return; }
        setSending(true);
        const res = await handleSendSubcontractorInvites(ids, { subject, intro });
        setSending(false);
        if (res?.value?.sent) showToast(`Invite sent to ${res.value.sent} carrier(s).${res.value.failed ? ` ${res.value.failed} failed.` : ''}`);
        else showToast(res?.error || 'Could not send invites.');
        setSelected(new Set());
    };

    const pendingIds = invites.filter(i => i.status === 'Pending').map(i => i.id);

    return (
        <div className="space-y-6">
            {/* Funnel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'On List', value: funnel.total, tone: 'text-white' },
                    { label: 'Invited', value: funnel.invited, tone: 'text-blue-300' },
                    { label: 'Applied', value: funnel.applied, tone: 'text-amber-300' },
                    { label: 'Vetted', value: funnel.vetted, tone: 'text-emerald-300' },
                ].map(s => (
                    <div key={s.label} className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                        <p className={`text-3xl font-black ${s.tone}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload list */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl space-y-4">
                    <div>
                        <h3 className="text-lg font-black text-white">1. Upload transporter emails</h3>
                        <p className="text-xs text-gray-500 mt-1">One per line. Optionally add a company after a comma — e.g. <span className="text-gray-400">ops@bluestar.co.za, Blue Star Logistics</span>. Paste from a spreadsheet or upload a CSV/TXT.</p>
                    </div>
                    <textarea
                        value={raw}
                        onChange={e => setRaw(e.target.value)}
                        rows={7}
                        placeholder={'ops@bluestar.co.za, Blue Star Logistics\ndispatch@roadrunner.co.za\n...'}
                        className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-brand-primary outline-none text-sm font-mono placeholder-gray-600"
                    />
                    <div className="flex items-center justify-between">
                        <label className="flex items-center text-xs font-bold text-gray-400 hover:text-white cursor-pointer">
                            <UploadIcon className="h-4 w-4 mr-2" /> Upload CSV / TXT
                            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleFile} className="hidden" />
                        </label>
                        <button
                            onClick={handleAdd}
                            disabled={adding || !parsedCount}
                            className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-40 text-white font-black py-2.5 px-6 rounded-xl uppercase tracking-widest text-xs transition-all"
                        >
                            {adding ? 'Adding…' : `Add ${parsedCount || ''} to list`}
                        </button>
                    </div>
                </div>

                {/* Compose */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl space-y-4">
                    <div>
                        <h3 className="text-lg font-black text-white">2. Compose the invite</h3>
                        <p className="text-xs text-gray-500 mt-1">Sent through the FBN branded template (with the accept button). Use <span className="text-gray-400">{'{name}'}</span> and <span className="text-gray-400">{'{company}'}</span> to personalise.</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Subject</label>
                        <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-brand-primary outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Message</label>
                        <textarea value={intro} onChange={e => setIntro(e.target.value)} rows={7} className="w-full bg-gray-900 text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-brand-primary outline-none text-sm" />
                    </div>
                    <button
                        onClick={() => send(pendingIds)}
                        disabled={sending || !pendingIds.length}
                        className="w-full flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-3 px-6 rounded-xl uppercase tracking-widest text-xs transition-all"
                    >
                        <SparklesIcon className="h-4 w-4 mr-2" />
                        {sending ? 'Sending…' : `Send to ${pendingIds.length} not-yet-invited`}
                    </button>
                </div>
            </div>

            {/* Recipient list */}
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900/60">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Carrier list ({invites.length})</h3>
                    {selected.size > 0 && (
                        <button onClick={() => send([...selected])} disabled={sending} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-all">
                            Send to {selected.size} selected
                        </button>
                    )}
                </div>
                {invites.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 text-sm">No carriers yet. Paste a list above to get started.</div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900/40 border-b border-gray-700">
                            <tr>
                                <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded bg-gray-900 border-gray-600" /></th>
                                <th className="p-3 text-gray-400 uppercase text-[10px] font-black tracking-widest">Carrier</th>
                                <th className="p-3 text-gray-400 uppercase text-[10px] font-black tracking-widest text-center">Status</th>
                                <th className="p-3 text-gray-400 uppercase text-[10px] font-black tracking-widest text-center">Sends</th>
                                <th className="p-3 text-gray-400 uppercase text-[10px] font-black tracking-widest text-right">Last Sent</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {invites.map(inv => (
                                <tr key={inv.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                                    <td className="p-3"><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} className="rounded bg-gray-900 border-gray-600" /></td>
                                    <td className="p-3">
                                        <p className="font-bold text-white">{inv.companyName || inv.email}</p>
                                        {inv.companyName && <p className="text-xs text-gray-500">{inv.email}</p>}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[inv.status] || 'text-gray-300 bg-gray-700/60'}`}>
                                            {inv.status === 'Vetted' && <CheckCircleIcon className="h-3 w-3 mr-1" />}{inv.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center text-gray-400 font-bold">{inv.sentCount || 0}</td>
                                    <td className="p-3 text-right text-gray-500 text-xs">{inv.lastSentAt ? format(new Date(inv.lastSentAt), 'dd MMM, HH:mm') : '—'}</td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                        <button onClick={() => send([inv.id])} disabled={sending} className="text-[11px] font-black text-blue-400 hover:text-white uppercase tracking-wider mr-3">{inv.status === 'Pending' ? 'Send' : 'Resend'}</button>
                                        {inv.status !== 'Declined' && inv.status !== 'Vetted' && (
                                            <button onClick={() => handleUpdateSubcontractorInvite(inv.id, { status: 'Declined' })} className="text-[11px] font-black text-gray-500 hover:text-red-400 uppercase tracking-wider">Decline</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default CarrierInviteCampaign;
