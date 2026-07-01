import React, { useCallback, useEffect, useState } from 'react';
import { directSelect, directUpdate, directInsert, invokeFn } from '../../lib/supabase';
import { extractFromDocument, LICENCE_DISC_PROMPT, LICENCE_DISC_SCHEMA, base64ToFile } from '../../lib/docScan';
import { FBN_ORGANIZATION_ID } from '../../lib/mappers';
import { useUIState } from '../../contexts/AppContexts';
import DateField from '../operations/DateField';
import { driveViewUrl } from '../../lib/driveView';

const DOC_TYPES: [string, string][] = [
    ['LICENSE_DISC', 'Licence Disc'], ['LOGBOOK', 'Logbook'], ['FIRE_PERMIT', 'Fire Permit'], ['INSURANCE', 'Insurance'],
    ['ROADWORTHY', 'Roadworthy'], ['PERMIT', 'Permit / Cross-border'], ['OTHER', 'Other document'],
];
// Drive sub-folder per document type, e.g. Fleet/<reg>/Licenses/
const CATEGORY: Record<string, string> = {
    LICENSE_DISC: 'Licenses', LOGBOOK: 'Logbooks', FIRE_PERMIT: 'Fire Permits', INSURANCE: 'Insurance',
    ROADWORTHY: 'Roadworthy', PERMIT: 'Permits', OTHER: 'Other',
};
const fileToB64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('read fail')); r.readAsDataURL(file);
});

// Per-vehicle documents: the licence discs / fire permits / other compliance
// docs linked to this vehicle (from the Drive import or manual uploads). You can
// open each file, and "Read expiry" pulls the file via the service account and
// runs the AI scanner to read the expiry date straight off the disc — which then
// drives the compliance dashboard + the expiry notifications.

type Doc = { id: string; type: string; name?: string; file_url?: string; file_name?: string; expiry_date?: string | null; status?: string; issue_date?: string | null };

const TYPE_LABEL: Record<string, string> = {
    LICENSE_DISC: 'Licence Disc', LOGBOOK: 'Logbook', FIRE_PERMIT: 'Fire Permit', INSURANCE: 'Insurance',
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

const VehicleDocuments: React.FC<{ vehicleId: string; vehicleName?: string; registration?: string }> = ({ vehicleId, registration }) => {
    const { showToast } = useUIState();
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [bulk, setBulk] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [upFile, setUpFile] = useState<File | null>(null);
    const [upType, setUpType] = useState('LICENSE_DISC');
    const [upExpiry, setUpExpiry] = useState('');
    const [uploading, setUploading] = useState(false);

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

    // Upload a new document → files to the company Drive under Fleet/<reg>/ and
    // records it against the vehicle (with the Drive view link).
    const handleUpload = async () => {
        if (!upFile) { showToast('Choose a file to upload.'); return; }
        if (!registration) { showToast('This vehicle has no registration to file under.'); return; }
        setUploading(true);
        try {
            const base64 = await fileToB64(upFile);
            const { data, error } = await invokeFn('file-doc', { body: { scope: 'vehicle', subject: registration, category: CATEGORY[upType] || 'Other', docType: label(upType), fileName: upFile.name, contentType: upFile.type, base64, date: upExpiry || today(), archivePrevious: true } });
            if (error || !data?.link) { showToast(`Drive upload failed: ${error?.message || data?.error || 'unknown'}`); return; }
            const status = upExpiry ? (upExpiry < today() ? 'Expired' : 'Valid') : 'Valid';
            const { error: insErr } = await directInsert('vehicle_compliance_docs', {
                organization_id: FBN_ORGANIZATION_ID, vehicle_id: vehicleId, type: upType, name: label(upType),
                file_url: data.link, file_name: data.fileName || upFile.name, expiry_date: upExpiry || null, status,
            });
            if (insErr) { showToast(`Filed to Drive but could not record it: ${insErr.message}`); return; }
            showToast(`${label(upType)} filed to Drive (${data.folder}).`);
            setUpFile(null); setUpExpiry(''); setShowUpload(false);
            await load();
        } catch (e) { showToast(e instanceof Error ? e.message : 'Upload failed.'); }
        finally { setUploading(false); }
    };

    const missing = docs.filter(d => d.file_url && !d.expiry_date).length;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h3 className="text-xl font-semibold text-white">Documents &amp; Licences</h3>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowUpload(s => !s)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white uppercase tracking-widest px-3 py-1.5 rounded-lg">{showUpload ? 'Close' : '＋ Upload'}</button>
                    {missing > 0 && <button onClick={readAll} disabled={bulk || !!busy} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white uppercase tracking-widest px-3 py-1.5 rounded-lg">{bulk ? 'Reading…' : `Read ${missing} expiry date${missing === 1 ? '' : 's'} (AI)`}</button>}
                    <button onClick={load} className="text-sm font-semibold text-blue-400 hover:text-white">↻</button>
                </div>
            </div>

            {showUpload && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Document type</label>
                        <select value={upType} onChange={e => setUpType(e.target.value)} className="w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm">
                            {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select></div>
                    <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Expiry date (optional)</label>
                        <DateField value={upExpiry} onChange={v => setUpExpiry(v)} className="w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm" /></div>
                    <div className="md:col-span-2"><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">File (PDF or photo)</label>
                        <input type="file" accept="image/*,application/pdf" onChange={e => setUpFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:font-semibold" /></div>
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] text-gray-500">Files to Drive: <span className="font-mono text-gray-400">Fleet/{registration || '—'}/{CATEGORY[upType] || 'Other'}/</span> · old one archived</p>
                        <button onClick={handleUpload} disabled={uploading || !upFile} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm">{uploading ? 'Uploading…' : 'Upload to Drive'}</button>
                    </div>
                </div>
            )}

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
                                {d.file_url && <a href={driveViewUrl(d.file_url)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-400 hover:text-white">View</a>}
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
