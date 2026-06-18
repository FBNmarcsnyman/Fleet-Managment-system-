import React, { useState } from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations } from '../../contexts/AppContexts';
import { directInvoke } from '../../lib/supabase';

// Mobile capture of actual cargo at collection/delivery: weight, dimensions,
// packages, commodity + photos (camera). Saves via the capture-load edge fn
// (stores to bucket + files to Drive) and updates the load.
const CaptureLoadModal: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { handleUpdateLoadConfirmation } = useOperations() as any;
    const lc: LoadConfirmation = modal.payload?.loadCon;

    const [weight, setWeight] = useState<string>(lc?.weightKg ? String(lc.weightKg) : '');
    const [dims, setDims] = useState<string>(lc?.dimensions || '');
    const [packages, setPackages] = useState<string>(lc?.loadedPackages != null ? String(lc.loadedPackages) : '');
    const [commodity, setCommodity] = useState<string>(lc?.commodity || '');
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);

    if (!lc) return null;

    const toBase64 = (f: File) => new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] || '');
        r.onerror = rej; r.readAsDataURL(f);
    });

    const save = async () => {
        setBusy(true);
        try {
            const photos = await Promise.all(files.map(async f => ({ base64: await toBase64(f), name: f.name, contentType: f.type || 'image/jpeg' })));
            const { data, error } = await directInvoke('capture-load', {
                loadId: lc.id, weightKg: weight || undefined, dimensions: dims || undefined,
                packages: packages || undefined, commodity: commodity || undefined, photos,
            });
            if (error || (data as any)?.error) { showToast(`Capture failed: ${(data as any)?.error || error?.message}`); setBusy(false); return; }
            // Reflect locally so the detail updates without a reload.
            handleUpdateLoadConfirmation && handleUpdateLoadConfirmation(lc.id, {
                weightKg: weight || undefined, dimensions: dims || undefined,
                loadedPackages: packages ? Number(packages) : undefined, commodity: commodity || undefined,
                cargoPhotoUrls: (data as any)?.urls,
            } as any);
            hideModal();
            showToast(`Captured${photos.length ? ` (${photos.length} photo${photos.length === 1 ? '' : 's'})` : ''} for ${lc.loadConNumber}.`);
        } catch (e) { showToast(`Could not capture: ${e instanceof Error ? e.message : 'error'}`); setBusy(false); }
    };

    const inp = 'w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 text-base focus:outline-none focus:ring-2 focus:ring-brand-secondary';
    const lbl = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1';

    return (
        <div>
            <h2 className="text-xl font-black text-white mb-1">Capture cargo — {lc.loadConNumber}</h2>
            <p className="text-xs text-gray-400 mb-4">Weigh, measure, count and photograph the load.</p>
            <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Weight (kg)</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} className={inp} placeholder="0" /></div>
                    <div><label className={lbl}>Packages</label><input type="number" value={packages} onChange={e => setPackages(e.target.value)} className={inp} placeholder="0" /></div>
                </div>
                <div><label className={lbl}>Dimensions</label><input value={dims} onChange={e => setDims(e.target.value)} className={inp} placeholder="e.g. 1.2 x 0.8 x 1.0 m" /></div>
                <div><label className={lbl}>Commodity</label><input value={commodity} onChange={e => setCommodity(e.target.value)} className={inp} /></div>
                <div>
                    <label className={lbl}>Photos</label>
                    <input type="file" accept="image/*" capture="environment" multiple onChange={e => setFiles(Array.from(e.target.files || []))}
                        className="w-full text-sm text-gray-300 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-brand-primary file:text-white file:font-bold" />
                    {files.length > 0 && <p className="text-[11px] text-emerald-300 mt-1">{files.length} photo{files.length === 1 ? '' : 's'} selected</p>}
                    {(lc.cargoPhotoUrls?.length ?? 0) > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {lc.cargoPhotoUrls!.slice(0, 6).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} className="h-12 w-12 object-cover rounded-md border border-gray-600" /></a>)}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={hideModal} disabled={busy} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={busy} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-lg disabled:opacity-50 uppercase tracking-wider">{busy ? 'Saving…' : 'Save capture'}</button>
            </div>
        </div>
    );
};

export default CaptureLoadModal;
