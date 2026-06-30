import React, { useState } from 'react';
import { Driver } from '../../types';
import { useUIState, useVehicles } from '../../contexts/AppContexts';
import { BRANCHES } from '../../constants';
import { uploadFile } from '../../lib/supabase';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { SparklesIcon } from '../icons/SparklesIcon';
import DateField from '../operations/DateField';

// Bound any promise so a stalled network call can't hang the UI forever.
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);

// Add / edit a driver, or bulk-add several at once (one "Name, Cell" per line).
// You can upload a photo of the driver's licence and the app auto-fills the
// details (name, ID, licence no/code, licence & PDP expiry) using AI.
const AddDriverForm: React.FC = () => {
    const { hideModal, modal, showToast } = useUIState();
    const { vehicles = [], handleAddDriver, handleUpdateDriver, handleBulkAddDrivers } = useVehicles();
    const editing: Driver | undefined = modal.payload?.driver;
    const bulk: boolean = !!modal.payload?.bulk;
    // When opened from a vehicle's "Assign Driver", pre-link the new driver to it.
    const presetVehicleId: string | undefined = modal.payload?.presetVehicleId;

    const [name, setName] = useState(editing?.name || '');
    const [cell, setCell] = useState(editing?.cell || '');
    const [idNumber, setIdNumber] = useState(editing?.idNumber || '');
    const [licenceNo, setLicenceNo] = useState(editing?.licenceNo || '');
    const [licenceCode, setLicenceCode] = useState(editing?.licenceCode || '');
    const [licenceExpiry, setLicenceExpiry] = useState(editing?.licenceExpiry || '');
    const [pdpExpiry, setPdpExpiry] = useState(editing?.pdpExpiry || '');
    const [assignedVehicleId, setAssignedVehicleId] = useState(editing?.assignedVehicleId || presetVehicleId || '');
    const [branch, setBranch] = useState(editing?.branch || '');
    const [isActive, setIsActive] = useState(editing?.isActive !== false);
    const [bulkText, setBulkText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Licence scan / upload state
    const [licenceFile, setLicenceFile] = useState<File | null>(null);
    const [licencePreview, setLicencePreview] = useState(editing?.licenceDocUrl || '');
    const [scanning, setScanning] = useState(false);
    const [scanNote, setScanNote] = useState('');

    const inputCls = "w-full bg-gray-700 text-white p-2.5 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary text-sm";
    const labelCls = "block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1";

    const extractFromLicence = async (dataUrl: string, mimeType: string) => {
        // Prefer the Vite-injected key (reliable on Vercel); fall back to the
        // build-time define used by the app's other AI features.
        const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : undefined);
        if (!apiKey) { setScanNote("AI auto-fill isn't switched on yet (no AI key on the live site). The licence still uploads — type the details below."); return; }
        setScanning(true);
        setScanNote('');
        try {
            const ai = new GoogleGenAI({ apiKey });
            const imagePart = { inlineData: { mimeType: mimeType || 'image/jpeg', data: dataUrl.split(',')[1] } };
            const prompt = "This is a South African driver's licence card. Extract the holder's details. " +
                "Return ISO dates (YYYY-MM-DD). For vehicleCodes give the licence codes shown (e.g. 'EB, C1'). " +
                "licenceExpiry is the card's valid-to / expiry date. pdpExpiry is the PrDP (professional driving permit) expiry if shown, else empty. " +
                "If a field is not visible, return an empty string.";
            const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, { text: prompt }] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            fullName: { type: Type.STRING },
                            idNumber: { type: Type.STRING },
                            licenceNumber: { type: Type.STRING },
                            vehicleCodes: { type: Type.STRING },
                            licenceExpiry: { type: Type.STRING },
                            pdpExpiry: { type: Type.STRING },
                        },
                    },
                },
            }), 30000);
            const r = JSON.parse((response.text || '{}').trim());
            if (r.fullName) setName(prev => prev || r.fullName);
            if (r.idNumber) setIdNumber(r.idNumber);
            if (r.licenceNumber) setLicenceNo(r.licenceNumber);
            if (r.vehicleCodes) setLicenceCode(r.vehicleCodes);
            if (r.licenceExpiry) setLicenceExpiry(r.licenceExpiry);
            if (r.pdpExpiry) setPdpExpiry(r.pdpExpiry);
            setScanNote('Details read from the licence — please check them below.');
        } catch (err) {
            console.error('[driver] licence scan failed:', err);
            const msg = err instanceof Error ? err.message : 'unknown error';
            setScanNote(`Couldn't read the licence automatically (${msg}). The licence still uploads — type the details below.`);
        } finally {
            setScanning(false);
        }
    };

    const onLicenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLicenceFile(file);
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setLicencePreview(dataUrl);
            extractFromLicence(dataUrl, file.type);
        };
        reader.readAsDataURL(file);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            if (bulk) {
                const rows = bulkText.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
                    const [n, c] = line.split(',').map(s => s.trim());
                    return { name: n, cell: c || '', isActive: true };
                }).filter(r => r.name);
                if (rows.length === 0) { showToast('Add at least one driver (one per line).'); return; }
                const res = await handleBulkAddDrivers(rows);
                if (!res.ok) { showToast(`Could not add drivers: ${res.error}`); return; }
                hideModal();
                showToast(`Added ${res.count} driver(s).`);
                return;
            }
            if (!name.trim()) { showToast('Driver name is required.'); return; }

            // Save the driver immediately (fast). The licence image, if any, is
            // uploaded in the BACKGROUND afterwards and attached to the record —
            // so a slow/failed upload can never freeze the save.
            const payload = { name: name.trim(), cell, idNumber, licenceNo, licenceCode, licenceExpiry, pdpExpiry, assignedVehicleId: assignedVehicleId || undefined, branch, isActive, licenceDocUrl: editing?.licenceDocUrl || undefined };
            let savedId = editing?.id;
            if (editing) {
                const res = await handleUpdateDriver(editing.id, payload);
                if (!res.ok) { showToast(`Could not update driver: ${res.error}`); return; }
            } else {
                const res = await handleAddDriver(payload);
                if (!res.ok) { showToast(`Could not add driver: ${res.error}`); return; }
                savedId = res.value?.id;
            }
            hideModal();
            showToast(`Driver "${name}" ${editing ? 'updated' : 'added'}.${licenceFile ? ' Uploading licence…' : ''}`);

            // Background licence upload — attach the URL once it lands.
            if (licenceFile && savedId) {
                const safe = licenceFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `drivers/${savedId}_${Date.now()}_${safe}`;
                withTimeout(uploadFile('driver-docs', path, licenceFile), 30000)
                    .then(up => {
                        if (up.url) handleUpdateDriver(savedId!, { licenceDocUrl: up.url });
                        else if (up.error) showToast(`Licence image upload failed: ${up.error}`);
                    })
                    .catch(() => showToast('Licence image upload timed out — the driver was saved.'));
            }
        } catch (err) {
            showToast(`Could not save: ${err instanceof Error ? err.message : 'unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (bulk) {
        return (
            <form onSubmit={submit}>
                <h2 className="text-2xl font-bold mb-2 text-white">Bulk Add Drivers</h2>
                <p className="text-sm text-gray-400 mb-4">One driver per line, as <span className="text-gray-200 font-semibold">Name, Cell</span> (cell optional).</p>
                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={10} className={inputCls} placeholder={"Thabo Nkosi, 082 123 4567\nSipho Dlamini, 083 555 1212\nJohn Smith"} />
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">{submitting ? 'Adding…' : 'Add Drivers'}</button>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={submit}>
            <h2 className="text-2xl font-bold mb-5 text-white">{editing ? 'Edit' : 'Add'} Driver</h2>

            {/* Licence scan / upload */}
            <div className="bg-gray-900/50 border border-dashed border-gray-600 rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        {licencePreview
                            ? <img src={licencePreview} alt="licence" className="h-14 w-20 object-cover rounded-md border border-gray-700" />
                            : <div className="h-14 w-20 rounded-md bg-gray-800 flex items-center justify-center text-gray-600"><SparklesIcon className="h-6 w-6" /></div>}
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white">Driver's Licence</p>
                            <p className="text-[11px] text-gray-500">Upload a photo — we'll read the details automatically.</p>
                            {scanning && <p className="text-[11px] text-blue-400 font-semibold mt-0.5 animate-pulse">Reading licence…</p>}
                            {!scanning && scanNote && <p className={`text-[11px] font-semibold mt-0.5 ${scanNote.startsWith('Details read') ? 'text-emerald-400' : 'text-amber-400'}`}>{scanNote}</p>}
                        </div>
                    </div>
                    <label className="shrink-0 cursor-pointer bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold py-2 px-4 rounded-lg">
                        {licencePreview ? 'Replace' : 'Upload licence'}
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onLicenceSelect} />
                    </label>
                </div>
                {editing?.licenceDocUrl && <a href={editing.licenceDocUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline mt-2 inline-block">View licence on file →</a>}
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Name *</label><input value={name} onChange={e => setName(e.target.value)} required className={inputCls} /></div>
                    <div><label className={labelCls}>Cell</label><input value={cell} onChange={e => setCell(e.target.value)} className={inputCls} placeholder="for POD / tracking" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>ID Number</label><input value={idNumber} onChange={e => setIdNumber(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Licence No</label><input value={licenceNo} onChange={e => setLicenceNo(e.target.value)} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div><label className={labelCls}>Licence Code</label><input value={licenceCode} onChange={e => setLicenceCode(e.target.value)} className={inputCls} placeholder="e.g. EC" /></div>
                    <div><label className={labelCls}>Licence Expiry</label><DateField value={licenceExpiry} onChange={v => setLicenceExpiry(v)} className={inputCls} /></div>
                    <div><label className={labelCls}>PDP Expiry</label><DateField value={pdpExpiry} onChange={v => setPdpExpiry(v)} className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Assigned Vehicle</label>
                        <select value={assignedVehicleId} onChange={e => setAssignedVehicleId(e.target.value)} className={inputCls}>
                            <option value="">-- None --</option>
                            {(vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registration}</option>)}
                        </select>
                    </div>
                    <div><label className={labelCls}>Branch</label>
                        <select value={branch} onChange={e => setBranch(e.target.value)} className={inputCls}>
                            <option value="">-- None --</option>
                            {BRANCHES.map((b: string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active</label>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
                <button type="button" onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">{submitting ? 'Saving…' : (editing ? 'Save Changes' : 'Add Driver')}</button>
            </div>
        </form>
    );
};

export default AddDriverForm;
