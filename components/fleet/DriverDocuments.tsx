import React, { useCallback, useEffect, useState } from 'react';
import { directSelect, directInsert, invokeFn } from '../../lib/supabase';
import { FBN_ORGANIZATION_ID } from '../../lib/mappers';
import { useUIState } from '../../contexts/AppContexts';
import DateField from '../operations/DateField';
import { driveViewUrl } from '../../lib/driveView';

// Driver documents — files into the FBN CONTROL CENTER drive under
// Drivers/<name>/<Category>/ and records a driver_documents row. Mirrors the
// vehicle Documents tab. Opened as a modal with payload { driver }.
const DOC_TYPES: [string, string][] = [
    ['LICENCE', 'Driver Licence'], ['PDP', 'PDP'], ['MEDICAL', 'Medical'], ['HAZCHEM', 'Hazchem'], ['ID', 'ID Document'], ['OTHER', 'Other'],
];
const CATEGORY: Record<string, string> = { LICENCE: 'Licence', PDP: 'PDP', MEDICAL: 'Medical', HAZCHEM: 'Hazchem', ID: 'ID', OTHER: 'Other' };
const label = (t: string) => (DOC_TYPES.find(([v]) => v === t) || [t, t])[1];
const today = () => new Date().toISOString().slice(0, 10);
const fileToB64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('read fail')); r.readAsDataURL(file);
});
type Doc = { id: string; type: string; name?: string; file_url?: string; file_name?: string; expiry_date?: string | null; status?: string };

const DriverDocuments: React.FC = () => {
    const { modal, showToast } = useUIState();
    const driver = modal.payload?.driver;
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [upFile, setUpFile] = useState<File | null>(null);
    const [upType, setUpType] = useState('LICENCE');
    const [upExpiry, setUpExpiry] = useState('');
    const [uploading, setUploading] = useState(false);

    const load = useCallback(async () => {
        if (!driver?.id) return;
        setLoading(true);
        const { data } = await directSelect(`driver_documents?driver_id=eq.${driver.id}&select=id,type,name,file_url,file_name,expiry_date,status&order=type.asc`);
        setDocs(Array.isArray(data) ? data : []);
        setLoading(false);
    }, [driver?.id]);
    useEffect(() => { load(); }, [load]);

    if (!driver) return <div className="p-4 text-white">No driver selected.</div>;

    const handleUpload = async () => {
        if (!upFile) { showToast('Choose a file.'); return; }
        if (!driver.name) { showToast('Driver has no name to file under.'); return; }
        setUploading(true);
        try {
            const base64 = await fileToB64(upFile);
            const { data, error } = await invokeFn('file-doc', { body: { scope: 'driver', subject: driver.name, category: CATEGORY[upType] || 'Other', docType: label(upType), fileName: upFile.name, contentType: upFile.type, base64, date: upExpiry || today(), archivePrevious: true } });
            if (error || !data?.link) { showToast(`Drive upload failed: ${error?.message || data?.error || 'unknown'}`); return; }
            const status = upExpiry ? (upExpiry < today() ? 'Expired' : 'Valid') : 'Valid';
            const { error: insErr } = await directInsert('driver_documents', {
                organization_id: FBN_ORGANIZATION_ID, driver_id: driver.id, type: upType, name: label(upType),
                file_url: data.link, file_name: data.fileName || upFile.name, expiry_date: upExpiry || null, status,
            });
            if (insErr) { showToast(`Filed to Drive but could not record it: ${insErr.message}`); return; }
            showToast(`${label(upType)} filed to ${data.folder}.`);
            setUpFile(null); setUpExpiry('');
            await load();
        } catch (e) { showToast(e instanceof Error ? e.message : 'Upload failed.'); }
        finally { setUploading(false); }
    };

    const inp = 'w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 text-sm';
    const badge = (d: Doc) => {
        const s = d.expiry_date ? (d.expiry_date < today() ? 'Expired' : 'Valid') : 'No expiry';
        return s === 'Expired' ? 'bg-red-500/15 text-red-300' : s === 'Valid' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-600/40 text-gray-300';
    };

    return (
        <div>
            <h2 className="text-xl font-black text-white mb-1">Documents — {driver.name}</h2>
            <p className="text-xs text-gray-400 mb-4">Files to <span className="font-mono">Drivers/{driver.name}/{CATEGORY[upType]}/</span> in FBN CONTROL CENTER · old one archived.</p>

            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-3 mb-4 grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Type</label>
                    <select value={upType} onChange={e => setUpType(e.target.value)} className={inp}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Expiry (optional)</label>
                    <DateField value={upExpiry} onChange={v => setUpExpiry(v)} className={inp} /></div>
                <div className="col-span-2"><label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">File (PDF or photo)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setUpFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:font-semibold" /></div>
                <div className="col-span-2 flex justify-end"><button onClick={handleUpload} disabled={uploading || !upFile} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm">{uploading ? 'Uploading…' : 'Upload to Drive'}</button></div>
            </div>

            {loading ? <p className="text-gray-400 text-center py-6 text-sm">Loading…</p> : docs.length === 0 ? (
                <p className="text-gray-500 text-center py-6 text-sm">No documents yet. Upload the driver's licence, PDP, medical, etc.</p>
            ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                    {docs.map(d => (
                        <div key={d.id} className="bg-gray-700/40 p-3 rounded-lg flex items-center justify-between gap-3 border border-gray-700/50">
                            <div className="min-w-0"><p className="font-semibold text-white text-sm truncate">{label(d.type)}</p><p className="text-[11px] text-gray-400 truncate">{d.file_name || '—'}</p></div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badge(d)}`}>{d.expiry_date ? (d.expiry_date < today() ? 'Expired' : 'Valid') : 'No expiry'}</span><p className="text-[11px] text-gray-400 font-mono mt-0.5">{d.expiry_date || '—'}</p></div>
                                {d.file_url && <a href={driveViewUrl(d.file_url)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-400 hover:text-white">View</a>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DriverDocuments;
