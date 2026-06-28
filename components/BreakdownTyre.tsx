import React, { useEffect, useState } from 'react';

// Public, no-login road breakdown tyre-change logging (/breakdown/tyre).
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const post = async (fn: string, body: any) => (await fetch(`${BASE}/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) })).json();
const inp = 'w-full border border-slate-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const lbl = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1';
const POSITIONS = ['Front left', 'Front right', 'Rear left outer', 'Rear left inner', 'Rear right outer', 'Rear right inner', 'Axle 1 left', 'Axle 1 right', 'Axle 2 left', 'Axle 2 right', 'Axle 3 left', 'Axle 3 right', 'Spare'];

const compress = (file: File): Promise<string> => new Promise((res) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const max = 1600; let { width, height } = img; if (width > max || height > max) { const s = max / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); } const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d')!.drawImage(img, 0, 0, width, height); res(c.toDataURL('image/jpeg', 0.7)); }; img.onerror = () => res(r.result as string); img.src = r.result as string; };
    r.readAsDataURL(file);
});

const BreakdownTyre: React.FC = () => {
    const [meta, setMeta] = useState<{ vehicles: any[]; suppliers: any[] }>({ vehicles: [], suppliers: [] });
    const [f, setF] = useState({ vehicleId: '', vehicleReg: '', driverName: '', driverContact: '', location: '', lat: null as number | null, lng: null as number | null, description: '', tyrePosition: POSITIONS[0], replacementFitted: false, replacementType: 'New', serviceProvider: '', etaBack: '' });
    const [photos, setPhotos] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ reference: string } | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

    useEffect(() => { (async () => { const d = await post('breakdown-tyre', { op: 'meta' }); if (d?.ok) setMeta({ vehicles: d.vehicles || [], suppliers: d.suppliers || [] }); })(); }, []);

    const useGps = () => navigator.geolocation?.getCurrentPosition(p => { set('lat', p.coords.latitude); set('lng', p.coords.longitude); set('location', f.location || `GPS: ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`); });

    const addPhotos = async (files: FileList | null) => {
        if (!files) return;
        for (const file of Array.from(files)) { const b64 = await compress(file); const up = await post('inspection-upload', { base64: b64, vehicleId: f.vehicleId || 'breakdown', contentType: 'image/jpeg' }); if (up?.path) setPhotos(prev => [...prev, up.path]); }
    };

    const submit = async () => {
        if (!f.vehicleId) { setErr('Please select your vehicle.'); return; }
        setErr(null); setBusy(true);
        const veh = meta.vehicles.find(v => v.id === f.vehicleId);
        const res = await post('breakdown-tyre', { op: 'log', ...f, vehicleReg: veh ? (veh.registration || veh.name) : f.vehicleReg, photos });
        setBusy(false);
        if (res?.ok) setDone({ reference: res.reference }); else setErr(res?.error || 'Could not log breakdown.');
    };

    if (done) return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center">
                <div className="text-5xl mb-2">🛠️</div>
                <h1 className="text-2xl font-black text-[#13294b]">Breakdown logged</h1>
                <p className="text-slate-600 mt-1">The workshop has been notified. Reference <strong>{done.reference}</strong>.</p>
                <p className="text-[12px] text-slate-400 mt-3">Once you're back on the road, the workshop or ops will close this off with the breakdown waybill.</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="sticky top-0 bg-[#13294b] text-white px-4 py-3"><div className="font-black">Road breakdown — tyre</div><div className="text-[11px] text-slate-300">Log it from your phone — no login needed</div></div>
            <div className="max-w-xl mx-auto p-4 space-y-3">
                {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div><label className={lbl}>Vehicle *</label>
                        <select value={f.vehicleId} onChange={e => set('vehicleId', e.target.value)} className={inp}>
                            <option value="">-- select your vehicle --</option>
                            {meta.vehicles.map(v => <option key={v.id} value={v.id}>{v.registration ? `${v.registration} (${v.name})` : v.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>Driver name</label><input value={f.driverName} onChange={e => set('driverName', e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Contact number</label><input value={f.driverContact} onChange={e => set('driverContact', e.target.value)} className={inp} inputMode="tel" /></div>
                    </div>
                    <div>
                        <label className={lbl}>Current location</label>
                        <div className="flex gap-2"><input value={f.location} onChange={e => set('location', e.target.value)} className={inp} placeholder="Address or landmark" /><button type="button" onClick={useGps} className="shrink-0 bg-[#13294b] text-white font-bold px-3 rounded-lg text-sm">📍 GPS</button></div>
                    </div>
                    <div><label className={lbl}>What happened?</label><textarea value={f.description} onChange={e => set('description', e.target.value)} rows={2} className={inp} style={{ textTransform: 'none' }} /></div>
                    <div><label className={lbl}>Tyre position that failed</label><select value={f.tyrePosition} onChange={e => set('tyrePosition', e.target.value)} className={inp}>{POSITIONS.map(p => <option key={p}>{p}</option>)}</select></div>
                    <div>
                        <label className={lbl}>Replacement tyre fitted?</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => set('replacementFitted', true)} className={`flex-1 py-2.5 rounded-lg font-bold ${f.replacementFitted ? 'bg-[#13294b] text-white' : 'bg-slate-100 text-slate-600'}`}>Yes</button>
                            <button type="button" onClick={() => set('replacementFitted', false)} className={`flex-1 py-2.5 rounded-lg font-bold ${!f.replacementFitted ? 'bg-[#13294b] text-white' : 'bg-slate-100 text-slate-600'}`}>No</button>
                        </div>
                        {f.replacementFitted && (
                            <div className="flex gap-2 mt-2">
                                {['New', 'Retread'].map(t => <button key={t} type="button" onClick={() => set('replacementType', t)} className={`flex-1 py-2 rounded-lg font-bold border ${f.replacementType === t ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>{t}</button>)}
                            </div>
                        )}
                    </div>
                    <div><label className={lbl}>Service provider called</label><input list="suppliers" value={f.serviceProvider} onChange={e => set('serviceProvider', e.target.value)} className={inp} placeholder="Search or type" /><datalist id="suppliers">{meta.suppliers.map(s => <option key={s.id} value={s.name} />)}</datalist></div>
                    <div><label className={lbl}>Estimated time back on road</label><input value={f.etaBack} onChange={e => set('etaBack', e.target.value)} className={inp} placeholder="e.g. 2 hours" /></div>
                    <div>
                        <label className={lbl}>Photos (scene, damaged tyre, replacement)</label>
                        <label className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold cursor-pointer bg-[#13294b] text-white">📷 Add photos<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => addPhotos(e.target.files)} /></label>
                        {photos.length > 0 && <p className="text-xs text-emerald-700 mt-1">{photos.length} photo(s) attached</p>}
                    </div>
                </div>
                <button onClick={submit} disabled={busy} className="w-full bg-red-600 disabled:opacity-40 text-white font-black py-4 rounded-xl">{busy ? 'Logging…' : 'Log breakdown & notify workshop'}</button>
            </div>
        </div>
    );
};

export default BreakdownTyre;
