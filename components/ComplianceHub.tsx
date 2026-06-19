import React, { useEffect, useMemo, useState } from 'react';
import { useUIState, useAuth } from '../contexts/AppContexts';
import { directSelect, directInsert, uploadFile } from '../lib/supabase';

// Compliance & Documents hub.
//
// Reads the `hr_compliance_gaps` database view — a single live list of every
// outstanding compliance item across active drivers and vehicles (missing,
// expired, expiring soon, or pending verification). HR/admins can upload the
// document straight from a row (which files it to storage and creates the
// matching driver_documents / vehicle_compliance_docs record), or "Chase" it
// (raises a COMPLIANCE notification as a reminder).
//
// The data layer is the freeze-proof direct-REST path (directSelect/insert),
// the same one the rest of the app uses for writes.

type Gap = {
    organization_id: string;
    category: 'Driver' | 'Vehicle';
    entity: string;
    branch: string | null;
    doc_type: string;
    expiry_date: string | null;
    days_left: number | null;
    entity_id: string;
    status: string;
};

const STATUS_RANK: Record<string, number> = {
    'Expired': 0,
    'Missing': 1,
    'Missing (load-test/inspection)': 1,
    'Expiring soon': 2,
    'Pending review (verify)': 3,
};

const statusBadge = (status: string): string => {
    if (status === 'Expired') return 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30';
    if (status.startsWith('Missing')) return 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30';
    if (status === 'Expiring soon') return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30';
    return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30';
};

const today = () => new Date().toISOString().slice(0, 10);

const ComplianceHub: React.FC = () => {
    const { showToast } = useUIState();
    const { currentUser } = useAuth();

    const [gaps, setGaps] = useState<Gap[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scope, setScope] = useState<'all' | 'Driver' | 'Vehicle'>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [search, setSearch] = useState('');

    // Inline upload panel state
    const [uploadRow, setUploadRow] = useState<Gap | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [expiry, setExpiry] = useState('');
    const [issue, setIssue] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await directSelect('hr_compliance_gaps?select=*');
        if (error) setError(error.message);
        else setGaps((data || []) as Gap[]);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const counts = useMemo(() => {
        const c = { Expired: 0, Missing: 0, 'Expiring soon': 0, Pending: 0 };
        for (const g of gaps) {
            if (g.status === 'Expired') c.Expired++;
            else if (g.status.startsWith('Missing')) c.Missing++;
            else if (g.status === 'Expiring soon') c['Expiring soon']++;
            else c.Pending++;
        }
        return c;
    }, [gaps]);

    const rows = useMemo(() => {
        let r = gaps;
        if (scope !== 'all') r = r.filter(g => g.category === scope);
        if (statusFilter !== 'all') r = r.filter(g =>
            statusFilter === 'Missing' ? g.status.startsWith('Missing')
            : statusFilter === 'Pending' ? g.status.startsWith('Pending')
            : g.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(g => g.entity.toLowerCase().includes(q) || (g.branch || '').toLowerCase().includes(q) || g.doc_type.toLowerCase().includes(q));
        }
        return [...r].sort((a, b) =>
            (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
            || (a.days_left ?? 99999) - (b.days_left ?? 99999)
            || a.entity.localeCompare(b.entity));
    }, [gaps, scope, statusFilter, search]);

    const openUpload = (g: Gap) => {
        setUploadRow(g);
        setFile(null);
        setExpiry(g.expiry_date || '');
        setIssue('');
    };

    const submitUpload = async () => {
        if (!uploadRow || !file || busy) return;
        setBusy(true);
        try {
            const g = uploadRow;
            const isDriver = g.category === 'Driver';
            const bucket = isDriver ? 'driver-docs' : 'vehicle-compliance';
            const folder = isDriver ? 'drivers' : 'vehicles';
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `${folder}/${g.entity_id}_${Date.now()}_${safe}`;

            const up = await uploadFile(bucket, path, file);
            if (!up.url) { showToast(`Upload failed: ${up.error || 'unknown error'}`); return; }

            const table = isDriver ? 'driver_documents' : 'vehicle_compliance_docs';
            const fk = isDriver ? 'driver_id' : 'vehicle_id';
            const docType = isDriver
                ? g.doc_type // LICENCE | PDP | HAZCHEM | MEDICAL
                : (g.status.includes('inspection') ? 'OTHER' : 'LICENSE_DISC');
            const status = expiry ? (expiry < today() ? 'Expired' : 'Valid') : 'Valid';

            const { error } = await directInsert(table, {
                organization_id: g.organization_id,
                [fk]: g.entity_id,
                type: docType,
                name: isDriver ? g.doc_type : 'Motor Vehicle Licence Disc',
                file_url: up.url,
                file_name: file.name,
                issue_date: issue || null,
                expiry_date: expiry || null,
                status,
            });
            if (error) { showToast(`Saved file but could not record it: ${error.message}`); return; }

            showToast(`${g.doc_type} uploaded for ${g.entity}.`);
            setUploadRow(null);
            await load();
        } catch (e) {
            showToast(`Could not upload: ${e instanceof Error ? e.message : 'unknown error'}`);
        } finally {
            setBusy(false);
        }
    };

    const chase = async (g: Gap) => {
        if (!currentUser?.id) { showToast('Cannot raise a reminder — not signed in.'); return; }
        const { error } = await directInsert('notifications', {
            organization_id: g.organization_id,
            user_id: currentUser.id,
            type: 'COMPLIANCE',
            message: `Chase: obtain & upload ${g.doc_type} for ${g.category.toLowerCase()} ${g.entity} (${g.status}).`,
            link: { tab: 'compliance', source: 'hr_compliance_gaps' },
        });
        if (error) showToast(`Could not log chase: ${error.message}`);
        else showToast(`Reminder raised to chase ${g.doc_type} for ${g.entity}.`);
    };

    const card = (label: string, n: number, cls: string) => (
        <div className={`rounded-xl p-4 ${cls}`}>
            <p className="text-3xl font-black">{n}</p>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</p>
        </div>
    );

    return (
        <>
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                <h2 className="text-3xl font-bold text-white">Compliance &amp; Documents</h2>
                <button onClick={load} className="text-sm font-semibold text-blue-400 hover:text-white">↻ Refresh</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {card('Expired', counts.Expired, 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20')}
                {card('Missing', counts.Missing, 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/20')}
                {card('Expiring ≤30d', counts['Expiring soon'], 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20')}
                {card('To verify', counts.Pending, 'bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20')}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['all', 'Driver', 'Vehicle'] as const).map(s => (
                    <button key={s} onClick={() => setScope(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${scope === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                        {s === 'all' ? 'All' : s + 's'}
                    </button>
                ))}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600">
                    <option value="all">All statuses</option>
                    <option value="Expired">Expired</option>
                    <option value="Missing">Missing</option>
                    <option value="Expiring soon">Expiring soon</option>
                    <option value="Pending">To verify</option>
                </select>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / branch / document…"
                    className="flex-1 min-w-[200px] bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600" />
            </div>

            {loading ? (
                <div className="text-gray-400 p-8 text-center">Loading compliance items…</div>
            ) : error ? (
                <div className="text-red-400 p-8 text-center">Could not load: {error}</div>
            ) : rows.length === 0 ? (
                <div className="text-emerald-400 p-8 text-center font-semibold">✓ Nothing outstanding for this filter.</div>
            ) : (
                <div className="bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-700/50">
                                <th className="p-3 text-gray-300">Type</th>
                                <th className="p-3 text-gray-300">Name</th>
                                <th className="p-3 text-gray-300">Branch</th>
                                <th className="p-3 text-gray-300">Document</th>
                                <th className="p-3 text-gray-300">Status</th>
                                <th className="p-3 text-gray-300">Expiry</th>
                                <th className="p-3 text-gray-300 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((g, i) => (
                                <tr key={`${g.category}-${g.entity_id}-${g.doc_type}-${i}`} className="border-b border-gray-700/70">
                                    <td className="p-3 text-gray-400">{g.category}</td>
                                    <td className="p-3 font-medium text-white">{g.entity}</td>
                                    <td className="p-3 text-gray-400">{g.branch || '—'}</td>
                                    <td className="p-3 text-gray-300">{g.doc_type}</td>
                                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge(g.status)}`}>{g.status}</span></td>
                                    <td className="p-3 text-gray-400 font-mono">
                                        {g.expiry_date || '—'}
                                        {typeof g.days_left === 'number' && g.expiry_date && (
                                            <span className="ml-2 text-xs opacity-70">({g.days_left < 0 ? `${-g.days_left}d ago` : `in ${g.days_left}d`})</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                        <button onClick={() => openUpload(g)} className="text-sm font-semibold text-emerald-400 hover:text-white mr-3">Upload</button>
                                        <button onClick={() => chase(g)} className="text-sm font-semibold text-blue-400 hover:text-white">Chase</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {uploadRow && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !busy && setUploadRow(null)}>
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md ring-1 ring-gray-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1">Upload {uploadRow.doc_type}</h3>
                        <p className="text-sm text-gray-400 mb-4">{uploadRow.category}: <span className="text-gray-200 font-semibold">{uploadRow.entity}</span></p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Document file</label>
                                <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:font-semibold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Expiry date</label>
                                    <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)}
                                        className="w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Issue date (optional)</label>
                                    <input type="date" value={issue} onChange={e => setIssue(e.target.value)}
                                        className="w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm" />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setUploadRow(null)} disabled={busy} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">Cancel</button>
                            <button onClick={submitUpload} disabled={busy || !file} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">{busy ? 'Uploading…' : 'Upload & Record'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ComplianceHub;
