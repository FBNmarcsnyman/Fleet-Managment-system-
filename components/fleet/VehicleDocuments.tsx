import React, { useCallback, useEffect, useState } from 'react';
import { directSelect, directUpdate, invokeFn } from '../../lib/supabase';
import { extractFromDocument, LICENCE_DISC_PROMPT, LICENCE_DISC_SCHEMA, base64ToFile } from '../../lib/docScan';
import { useUIState } from '../../contexts/AppContexts';

// Per-vehicle documents: the licence discs / fire permits / other compliance
// docs linked to this vehicle (from the Drive import or manual uploads). You can
// open each file, and "Read expiry" pulls the file via the service account and
// runs the AI scanner to read the expiry date straight off the disc — which then
// drives the compliance dashboard + the expiry notifications.

type Doc = { id: string; type: string; name?: string; file_url?: string; file_name?: string; expiry_date?: string | null; status?: string; issue_date?: string | null };

const TYPE_LABEL: Record<string, string> = {
    LICENSE_DISC: 'Licence Disc', FIRE_PERMIT: 'Fire Permit', INSURANCE: 'Insurance',
    ROADWORTHY: 'Roadworthy', PERMIT: 'Permit', OTHER: 'Other document',
};
const today = () => new Date().toISOString().slice(0, 10);
const label = (t: string) => TYPE_LABEL[t] || t;

const badge = (status?: string, expiry?: string | null) => {
    const s = expiry ? (expiry < today() ? 'Expired' : 'Valid') : (status || 'No expiry');
    if (s === 'Expired') return 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30';
    if (s === 'Valid') return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30';
    return 'bg-gray-600/40 text-gray-300 ring-1 ring-gray-600/40';
};

const VehicleDocuments: React.FC<{ vehicleId: string; vehicleName?: string }> = ({ vehicleId }) => {
    const { showToast } = useUIState();
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [bulk, setBulk] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await directSelect(`vehicle_compliance_docs?vehicle_id=eq.${vehicleId}&select=id,type,name,file_url,file_name,expiry_date,status,issue_date&order=type.asc`);
        setDocs(Array.isArray(data) ? data : []);
        setLoading(false);
    }, [vehicleId]);
    useEffect(() => { load(); }, [load]);

    // Pull the file via the service account, OCR the expiry, save it.
    const readExpiry = async (d: Doc, quiet = false): Promise<boolean> => {
        if (!d.file_url) { if (!quiet) showToast('No file linked to read.'); return false; }
        setBusy(d.id);
        try {
            const { data, error } = await invokeFn('drive-fetch', { body: { url: d.file_url } });
            if (error || !data?.base64) { if (!quiet) showToast(`Could not fetch the file: ${error?.message || data?.error || 'unknown'}`); return false; }
            const file = base64ToFile(data.base64, data.name || d.file_name || 'document', data.mimeType || 'application/pdf');
            const res = await extractFromDocument(file, LICENCE_DISC_PROMPT, LICENCE_DISC_SCHEMA);
            const expiry = String(res?.expiry_date || '').slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) { if (!quiet) showToast('Could not read a clear expiry date — open the file to check it.'); return false; }
            const status = expiry < today() ? 'Expired' : 'Valid';
            const { error: upErr } = await directUpdate('vehicle_compliance_docs', { id: d.id }, { expiry_date: expiry, status });
            if (upErr) { if (!quiet) showToast(`Read ${expiry} but could not save: ${upErr.message}`); return false; }
            if (!quiet) showToast(`${label(d.type)} expiry read: ${expiry}`);
            setDocs(prev => prev.map(x => x.id === d.id ? { ...x, expiry_date: expiry, status } : x));
            return true;
        } catch (e) {
            if (!quiet) showToast(e instanceof Error ? e.message : 'Could not read the document.');
            return false;
        } finally { setBusy(null); }
    };

    const readAll = async () => {
        const targets = docs.filter(d => d.file_url && !d.expiry_date);
        if (!targets.length) { showToast('Every linked doc already has an expiry date.'); return; }
        setBulk(true);
        let ok = 0;
        for (const d of targets) { if (await readExpiry(d, true)) ok++; }
        setBulk(false);
        showToast(`Read ${ok} of ${targets.length} expiry date${targets.length === 1 ? '' : 's'}.`);
    };

    const missing = docs.filter(d => d.file_url && !d.expiry_date).length;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h3 className="text-xl font-semibold text-white">Documents &amp; Licences</h3>
                <div className="flex items-center gap-3">
                    {missing > 0 && <button onClick={readAll} disabled={bulk || !!busy} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white uppercase tracking-widest px-3 py-1.5 rounded-lg">{bulk ? 'Reading…' : `Read ${missing} expiry date${missing === 1 ? '' : 's'} (AI)`}</button>}
                    <button onClick={load} className="text-sm font-semibold text-blue-400 hover:text-white">↻</button>
                </div>
            </div>

            {loading ? (
                <p className="text-gray-400 text-center py-8 text-sm">Loading documents…</p>
            ) : docs.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">No documents linked to this vehicle yet.</p>
            ) : (
                <div className="space-y-2">
                    {docs.map(d => (
                        <div key={d.id} className="bg-gray-700/40 p-3 rounded-lg flex items-center justify-between gap-3 border border-gray-700/50">
                            <div className="min-w-0">
                                <p className="font-semibold text-white text-sm truncate">{label(d.type)}{d.name && d.name !== label(d.type) ? ` · ${d.name}` : ''}</p>
                                <p className="text-[11px] text-gray-400 truncate">{d.file_name || '—'}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge(d.status, d.expiry_date)}`}>{d.expiry_date ? (d.expiry_date < today() ? 'Expired' : 'Valid') : 'No expiry'}</span>
                                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{d.expiry_date || '—'}</p>
                                </div>
                                {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-400 hover:text-white">View</a>}
                                {d.file_url && <button onClick={() => readExpiry(d)} disabled={!!busy || bulk} className="text-xs font-semibold text-emerald-400 hover:text-white disabled:opacity-50">{busy === d.id ? '…' : 'Read expiry'}</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <p className="text-[11px] text-gray-500 mt-4">"Read expiry" opens the document, reads the licence expiry date off it, and saves it — which feeds the compliance dashboard and the expiry reminders.</p>
        </div>
    );
};

export default VehicleDocuments;
