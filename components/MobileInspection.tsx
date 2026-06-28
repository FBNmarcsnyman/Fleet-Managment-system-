import React, { useEffect, useMemo, useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

// Public, no-login mobile inspection (?checklist=<uuid>). Flow: confirm vehicle +
// assigned/substituting → driver (scan licence or manual, PDP warnings) → trailers
// (per-type: superlink auto-pairs the linked half, triaxle/skeleton single) →
// checklist (vehicle + each trailer). Photos → private inspections bucket; tyre photos
// get AI tread/condition; info (i) popups explain technical items.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const GKEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const post = async (fn: string, body: any) => (await fetch(`${BASE}/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) })).json();
// Full SA licence code list.
const LICENCE_CODES = ['A1', 'A', 'B', 'C1', 'C', 'EB', 'EC1', 'EC'];
const DEPOTS = ['DBN', 'JHB', 'CPT', 'On Road'];
const inp = 'w-full border border-slate-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const lbl = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1';

const compress = (file: File): Promise<string> => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => { const img = new Image(); img.onload = () => { const max = 1600; let { width, height } = img; if (width > max || height > max) { const s = max / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); } const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d')!.drawImage(img, 0, 0, width, height); resolve(c.toDataURL('image/jpeg', 0.7)); }; img.onerror = () => resolve(reader.result as string); img.src = reader.result as string; };
    reader.readAsDataURL(file);
});

const TYRE_PROMPT = 'You are a commercial vehicle tyre safety inspector with expertise in South African road transport regulations. Analyse this tyre photo and return ONLY a JSON object: tread_estimate (Good above 4mm / Marginal 2-4mm / Critical under 2mm), condition_issues (array of strings describing cuts bulges sidewall damage uneven wear exposed cords), overall_assessment (Safe to operate / Monitor closely / Remove from service immediately), confidence_level (High / Medium / Low), retread_detected (true/false), notes (string).';
type TyreAI = { tread_estimate?: string; condition_issues?: string[]; overall_assessment?: string; confidence_level?: string; retread_detected?: boolean; notes?: string };
const analyseTyre = async (dataUrl: string): Promise<TyreAI | null> => {
    if (!GKEY) return null;
    try {
        const ai = new GoogleGenAI({ apiKey: GKEY });
        const resp: any = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] } }, { text: TYRE_PROMPT }] }, config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { tread_estimate: { type: Type.STRING }, condition_issues: { type: Type.ARRAY, items: { type: Type.STRING } }, overall_assessment: { type: Type.STRING }, confidence_level: { type: Type.STRING }, retread_detected: { type: Type.BOOLEAN }, notes: { type: Type.STRING } } } } });
        return JSON.parse((resp.text || '{}').trim());
    } catch (e) { console.error('[tyre-ai]', e); return null; }
};
const LICENCE_PROMPT = "This is a South African driver's licence card. Extract the holder's details. Return ISO dates (YYYY-MM-DD). vehicleCodes = the licence codes shown (e.g. 'EC'). pdpExpiry = the PrDP expiry if shown, else empty. Empty string for anything not visible.";
const scanLicence = async (dataUrl: string): Promise<any | null> => {
    if (!GKEY) return null;
    try {
        const ai = new GoogleGenAI({ apiKey: GKEY });
        const resp: any = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] } }, { text: LICENCE_PROMPT }] }, config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { fullName: { type: Type.STRING }, idNumber: { type: Type.STRING }, vehicleCodes: { type: Type.STRING }, pdpExpiry: { type: Type.STRING } } } } });
        return JSON.parse((resp.text || '{}').trim());
    } catch (e) { console.error('[licence]', e); return null; }
};
const aiTone = (ai: TyreAI) => { const a = (ai.overall_assessment || '').toLowerCase(); return /remove/.test(a) ? 'bg-red-50 border-red-300 text-red-800' : /monitor/.test(a) ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'; };

// A flat field is one answerable line. Wheel fields are tyre/nuts/rim per position
// (Pass/Fail only, photo mandatory). Everything else is 'normal'.
interface Field { key: string; itemId: string; section: string; label: string; severity: string; kind: 'normal' | 'wheel' | 'extinguisher' | 'quantity'; photo: string | null; value?: string[]; failValues?: string[]; treadDepth?: boolean; position?: string; spotPhoto?: boolean; help?: string; trailerId?: string; trailerName?: string; }
type Unit = { expiry?: string; gaugePath?: string; labelPath?: string };
type Ans = { status?: 'Pass' | 'Fail' | 'NA'; value?: string; treadMm?: string; remarks?: string; photoPath?: string; ai?: TyreAI; aiState?: string; count?: string; units?: Unit[] };

const trailerKindOf = (wc: string) => /superlink/i.test(wc) ? 'Superlink' : /triaxle|tri-axle/i.test(wc) ? 'Triaxle' : /skeleton/i.test(wc) ? 'Skeleton' : 'Trailer';

const MobileInspection: React.FC<{ uuid: string }> = ({ uuid }) => {
    const [data, setData] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [driver, setDriver] = useState({ name: '', idNumber: '', licenceCode: 'EC', pdpExpiry: '', substituting: false });
    const [depot, setDepot] = useState('');
    const [scanning, setScanning] = useState(false);
    // Trailer selection state.
    const [pullTrailer, setPullTrailer] = useState<boolean | null>(null);
    const [tKind, setTKind] = useState<'Superlink' | 'Triaxle' | 'Skeleton' | null>(null);
    const [superMode, setSuperMode] = useState<'full' | 'single' | null>(null);
    const [sizeLabel, setSizeLabel] = useState<string>('');
    const [trailerIds, setTrailerIds] = useState<string[]>([]);
    const [answers, setAnswers] = useState<Record<string, Ans>>({});
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<any>(null);
    const [helpFor, setHelpFor] = useState<{ label: string; help: string } | null>(null);
    const draftKey = `fbn-insp-${uuid}`;

    useEffect(() => {
        (async () => {
            const d = await post('inspection-load', { uuid });
            if (d?.error || !d?.ok) { setErr(d?.error || 'Could not load this vehicle.'); return; }
            setData(d); setDepot(d.vehicle?.depot && DEPOTS.includes(d.vehicle.depot) ? d.vehicle.depot : '');
            navigator.geolocation?.getCurrentPosition(p => { const dDbn = Math.hypot(p.coords.latitude + 29.88, p.coords.longitude - 31.0); const dJhb = Math.hypot(p.coords.latitude + 26.2, p.coords.longitude - 28.0); setDepot(prev => prev || (dDbn < dJhb ? 'DBN' : 'JHB')); }, () => {});
            try { const s = localStorage.getItem(draftKey); if (s) { const j = JSON.parse(s); setAnswers(j.answers || {}); } } catch { /* */ }
        })();
    }, [uuid]);

    const vehicle = data?.vehicle;
    const assigned = data?.assignedDriver;
    const isHorse = vehicle?.type === 'Horse' || vehicle?.type === 'Loadmaster';
    const allTrailers: any[] = data?.trailers || [];
    const kinds = useMemo(() => Array.from(new Set(allTrailers.map(t => trailerKindOf(t.weightCategory)))), [allTrailers]);
    // Depot-preferred trailer list for a kind (fall back to all of that kind).
    const trailersOf = (kind: string) => { const k = allTrailers.filter(t => trailerKindOf(t.weightCategory) === kind); const d = k.filter(t => !t.depot || t.depot === (depot || vehicle?.depot)); return d.length ? d : k; };

    const [spotSet] = useState<Set<string>>(new Set());
    const buildFields = (tmpl: any, prefix: string, trailer?: { id: string; name: string }): Field[] => {
        if (!tmpl) return [];
        const out: Field[] = [];
        for (const it of (tmpl.items || [])) {
            if (it.loadmasterOnly && vehicle?.type !== 'Loadmaster') continue;
            if (it.crossBorder && !vehicle?.crossBorder) continue;
            const section = trailer ? `${trailer.name} — ${it.section || 'General'}` : (it.section || 'General');
            let spot = false;
            if (it.spotPhoto) { const k = `${prefix}${it.id}`; if (!spotSet.has(k) && Math.random() < 0.5) spotSet.add(k); spot = spotSet.has(k); }
            const common = { itemId: it.id, section, label: it.label, severity: it.severity || 'Minor', value: it.value, failValues: it.failValues, treadDepth: it.treadDepth, spotPhoto: spot, help: it.help, trailerId: trailer?.id, trailerName: trailer?.name };
            if (it.perWheel && Array.isArray(it.wheelPositions) && it.wheelPositions.length) {
                it.wheelPositions.forEach((pos: string) => out.push({ ...common, kind: 'wheel', key: `${prefix}${it.id}::${pos}`, position: pos, photo: 'always' }));
            } else if (it.expiryPerUnit) {
                out.push({ ...common, kind: 'extinguisher', key: `${prefix}${it.id}`, photo: 'always' });
            } else if (it.quantity && (!it.value || !it.value.length)) {
                out.push({ ...common, kind: 'quantity', key: `${prefix}${it.id}`, photo: spot ? 'always' : (it.photo || null) });
            } else {
                out.push({ ...common, kind: 'normal', key: `${prefix}${it.id}`, photo: spot ? 'always' : (it.photo || null) });
            }
        }
        return out;
    };
    const fields: Field[] = useMemo(() => {
        if (!data) return [];
        let fs = buildFields(data.template, '');
        trailerIds.forEach((tid, idx) => { const t = allTrailers.find((x: any) => x.id === tid); if (t && data.trailerTemplate) fs = fs.concat(buildFields(data.trailerTemplate, `tr${idx}::`, { id: t.id, name: t.registration || t.name })); });
        return fs;
    }, [data, trailerIds]);

    // Section render model (preserves order; wheel fields grouped per position).
    const model = useMemo(() => {
        const order: string[] = [];
        const bySection: Record<string, { wheels: Field[]; normal: Field[] }> = {};
        for (const f of fields) { if (!bySection[f.section]) { bySection[f.section] = { wheels: [], normal: [] }; order.push(f.section); } (f.kind === 'wheel' ? bySection[f.section].wheels : bySection[f.section].normal).push(f); }
        return order.map(section => {
            const g = bySection[section];
            const positions = Array.from(new Set(g.wheels.map(w => w.position!)));
            return { section, positions, wheels: g.wheels, normal: g.normal };
        });
    }, [fields]);

    const isFault = (f: Field, a: Ans) => a.status === 'Fail' || !!(f.value && a.value && (f.failValues || []).includes(a.value));
    const fieldDone = (f: Field, a: Ans): boolean => {
        if (f.kind === 'wheel') return (a.status === 'Pass' || a.status === 'Fail') && !!a.photoPath && (a.status !== 'Fail' || !!a.remarks);
        if (f.kind === 'extinguisher') { const n = parseInt(a.count || '0', 10) || 0; if (n <= 0) return false; const u = a.units || []; for (let i = 0; i < Math.min(n, 6); i++) { if (!u[i]?.expiry || !u[i]?.gaugePath || !u[i]?.labelPath) return false; } return true; }
        if (f.value && f.value.length) { if (!a.value) return false; if (isFault(f, a)) return !!a.remarks && !!a.photoPath; return true; }
        if (f.kind === 'quantity') return !!a.count;
        if (!a.status) return false;
        if (a.status === 'Fail') return !!a.remarks && !!a.photoPath;
        if (f.photo === 'always') return !!a.photoPath;
        return true;
    };
    const answered = fields.filter(f => fieldDone(f, answers[f.key] || {})).length;
    const pct = fields.length ? Math.round((answered / fields.length) * 100) : 0;
    const allDone = fields.length > 0 && answered === fields.length;
    const firstIncomplete = fields.find(f => !fieldDone(f, answers[f.key] || {}));

    useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify({ answers })); } catch { /* */ } }, [answers]);
    const setAns = (key: string, patch: Ans) => setAnswers(p => ({ ...p, [key]: { ...p[key], ...patch } }));

    const upload = async (file: File): Promise<string | null> => { const b64 = await compress(file); const up = await post('inspection-upload', { base64: b64, vehicleId: vehicle.id, contentType: 'image/jpeg' }); return up?.path || null; };
    const onLicence = async (file?: File) => { if (!file) return; setScanning(true); const b64 = await compress(file); const r = await scanLicence(b64); setScanning(false); if (r) setDriver(d => ({ ...d, name: r.fullName || d.name, idNumber: r.idNumber || d.idNumber, licenceCode: (r.vehicleCodes && LICENCE_CODES.includes(r.vehicleCodes)) ? r.vehicleCodes : d.licenceCode, pdpExpiry: r.pdpExpiry || d.pdpExpiry })); };
    const onPhoto = async (f: Field, file?: File) => { if (!file) return; const b64 = await compress(file); const up = await post('inspection-upload', { base64: b64, vehicleId: vehicle.id, contentType: 'image/jpeg' }); if (up?.path) setAns(f.key, { photoPath: up.path }); if (f.treadDepth) { setAns(f.key, { aiState: 'running' }); const ai = await analyseTyre(b64); setAns(f.key, ai ? { ai, aiState: 'done' } : { aiState: 'failed' }); } };
    const onUnitPhoto = async (key: string, idx: number, which: 'gaugePath' | 'labelPath', file?: File) => { if (!file) return; const path = await upload(file); if (!path) return; setAnswers(p => { const a = p[key] || {}; const units = [...(a.units || [])]; units[idx] = { ...units[idx], [which]: path }; return { ...p, [key]: { ...a, units } }; }); };
    const setUnit = (key: string, idx: number, patch: Partial<Unit>) => setAnswers(p => { const a = p[key] || {}; const units = [...(a.units || [])]; units[idx] = { ...units[idx], ...patch }; return { ...p, [key]: { ...a, units } }; });
    const pdpDays = driver.pdpExpiry ? Math.ceil((new Date(driver.pdpExpiry).getTime() - Date.now()) / 86400000) : null;

    // Trailer selection helpers.
    const pickSingle = (id: string) => setTrailerIds(id ? [id] : []);
    const pickSuperlinkFull = (leadId: string) => { if (!leadId) { setTrailerIds([]); return; } const lead = allTrailers.find(t => t.id === leadId); const ids = [leadId]; if (lead?.linkedVehicleId && allTrailers.some(t => t.id === lead.linkedVehicleId)) ids.push(lead.linkedVehicleId); setTrailerIds(ids); };
    const linkedReg = (leadId: string) => { const lead = allTrailers.find(t => t.id === leadId); const partner = lead && allTrailers.find(t => t.id === lead.linkedVehicleId); return partner ? (partner.registration || partner.name) : ''; };
    const trailerValid = pullTrailer === false || (pullTrailer === true && trailerIds.length > 0);

    const submit = async () => {
        setSubmitting(true);
        const results: any[] = [];
        for (const f of fields) {
            const a = answers[f.key] || {};
            if (f.kind === 'extinguisher') { results.push({ itemId: f.itemId, label: f.label, section: f.section, severity: f.severity, status: 'Pass', count: a.count || null, units: a.units || null, trailerId: f.trailerId || null, trailerName: f.trailerName || null }); continue; }
            results.push({ itemId: f.itemId, label: f.label, section: f.section, severity: f.severity, position: f.position || null, status: a.status || (a.value ? (isFault(f, a) ? 'Fail' : 'Pass') : 'Pass'), value: a.value || null, treadMm: a.treadMm || null, count: a.count || null, remarks: a.remarks || null, photoPath: a.photoPath || null, ai: a.ai || null, trailerId: f.trailerId || null, trailerName: f.trailerName || null });
        }
        const res = await post('submit-inspection', { vehicleId: vehicle.id, vehicleReg: vehicle.registration, vehicleType: vehicle.type, depot, templateId: data.template.id, templateName: data.template.name, driver: { ...driver, pdpExpiry: driver.pdpExpiry || null }, trailerIds, results });
        setSubmitting(false);
        if (res?.ok) { localStorage.removeItem(draftKey); setDone(res); } else setErr(res?.error || 'Submit failed.');
    };

    if (err) return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm text-center"><p className="text-red-600 font-bold">{err}</p><button onClick={() => setErr(null)} className="mt-4 bg-[#13294b] text-white font-bold px-4 py-2 rounded-lg">Back</button></div></div>;
    if (!data) return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><p className="text-slate-400">Loading inspection…</p></div>;
    if (done) return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center">
                <div className="text-5xl mb-2">{done.result === 'Roadworthy' ? '✅' : done.result === 'Grounded' ? '⛔' : '⚠️'}</div>
                <h1 className="text-2xl font-black text-[#13294b]">Inspection submitted</h1>
                <p className="text-slate-600 mt-1">Reference <strong>{done.reference}</strong></p>
                <p className={`mt-3 inline-block px-3 py-1 rounded-lg font-bold ${done.result === 'Roadworthy' ? 'bg-emerald-100 text-emerald-700' : done.result === 'Grounded' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{done.result}</p>
                {done.failedItems?.length > 0 && <div className="mt-4 text-left"><p className="text-xs font-bold text-slate-500 uppercase mb-1">Failed ({done.failedItems.length})</p><ul className="text-sm text-slate-700 space-y-1">{done.failedItems.map((f: any, i: number) => <li key={i}>• <strong>{f.severity}</strong> — {f.label}{f.position ? ` (${f.position})` : ''}</li>)}</ul></div>}
            </div>
        </div>
    );

    const PassFail = (key: string, a: Ans, withNA: boolean) => (
        <div className={`grid ${withNA ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-2`}>
            {(withNA ? ['Pass', 'Fail', 'NA'] as const : ['Pass', 'Fail'] as const).map(s => <button key={s} onClick={() => setAns(key, { status: s })} className={`py-3 rounded-xl font-black ${a.status === s ? (s === 'Pass' ? 'bg-emerald-600 text-white' : s === 'Fail' ? 'bg-red-600 text-white' : 'bg-slate-400 text-white') : 'bg-slate-100 text-slate-600'}`}>{s === 'NA' ? 'N/A' : s}</button>)}
        </div>
    );
    const PhotoBtn = (label: string, has: boolean, onFile: (f?: File) => void) => (
        <label className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold cursor-pointer text-sm ${has ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-[#13294b] text-white'}`}>{has ? `✓ ${label}` : `📷 ${label}`}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFile(e.target.files?.[0])} /></label>
    );

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="sticky top-0 z-10 bg-[#13294b] text-white px-4 py-3">
                <div className="flex items-center justify-between"><div><div className="font-black">{vehicle.registration || vehicle.name}</div><div className="text-[11px] text-slate-300">{vehicle.type} · {depot || vehicle.depot}</div></div><div className="text-right text-[11px] text-slate-300">{data.template?.name}</div></div>
                {step === 4 && <div className="mt-2 h-1.5 bg-white/20 rounded-full"><div className="h-1.5 rounded-full bg-[#f5b700]" style={{ width: `${pct}%` }} /></div>}
            </div>
            <div className="max-w-xl mx-auto p-4 pb-28">
                {/* STEP 1 — VEHICLE + ASSIGNED/SUBSTITUTING */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-900">Confirm vehicle</h2>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4">
                            <p className="text-2xl font-black text-[#13294b]">{vehicle.registration || vehicle.name}</p>
                            <p className="text-sm text-slate-600">{vehicle.type} · {vehicle.depot}</p>
                            {data.lastInspection && <p className="text-[12px] text-slate-400 mt-1">Last: {new Date(data.lastInspection.date).toLocaleDateString('en-ZA')} — {data.lastInspection.result || '—'}</p>}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4">
                            <p className="text-sm font-bold text-slate-700 mb-2">{assigned?.name ? `Assigned driver: ${assigned.name}. Are you ${assigned.name}?` : 'Are you the assigned driver for this vehicle?'}</p>
                            <div className="flex gap-2">
                                <button onClick={() => { setDriver(d => ({ ...d, substituting: false, name: assigned?.name || d.name, pdpExpiry: assigned?.pdp_expiry || d.pdpExpiry })); setStep(2); }} className="flex-1 py-3 rounded-xl font-bold bg-[#13294b] text-white">Yes, that's me</button>
                                <button onClick={() => { setDriver(d => ({ ...d, substituting: true, name: '', pdpExpiry: '' })); setStep(2); }} className="flex-1 py-3 rounded-xl font-bold bg-amber-500 text-white">No — I'm substituting</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* STEP 2 — DRIVER */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-900">Your details {driver.substituting && <span className="text-amber-600 text-sm">(substituting)</span>}</h2>
                        <label className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold cursor-pointer bg-[#13294b] text-white">{scanning ? 'Reading licence…' : '📷 Scan my licence'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onLicence(e.target.files?.[0])} /></label>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                            <div><label className={lbl}>Full name</label><input value={driver.name} onChange={e => setDriver({ ...driver, name: e.target.value })} className={inp} /></div>
                            <div><label className={lbl}>ID number</label><input value={driver.idNumber} onChange={e => setDriver({ ...driver, idNumber: e.target.value })} className={inp} inputMode="numeric" /></div>
                            <div><label className={lbl}>Licence code</label><select value={driver.licenceCode} onChange={e => setDriver({ ...driver, licenceCode: e.target.value })} className={inp}>{LICENCE_CODES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className={lbl}>PDP expiry</label><input type="date" value={driver.pdpExpiry} onChange={e => setDriver({ ...driver, pdpExpiry: e.target.value })} className={inp} /></div>
                            {pdpDays !== null && pdpDays < 0 && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">⛔ PDP expired — flagged.</p>}
                            {pdpDays !== null && pdpDays >= 0 && pdpDays <= 30 && <p className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">⚠️ PDP expires in {pdpDays} days.</p>}
                            <div><label className={lbl}>Depot / branch</label><select value={depot} onChange={e => setDepot(e.target.value)} className={inp}><option value="">-- select --</option>{DEPOTS.map(d => <option key={d}>{d}</option>)}</select></div>
                        </div>
                        <div className="flex gap-2"><button onClick={() => setStep(1)} className="px-5 py-4 rounded-xl bg-white border border-slate-300 font-bold">Back</button><button onClick={() => setStep(isHorse ? 3 : 4)} disabled={!driver.name.trim() || !depot} className="flex-1 bg-[#13294b] disabled:opacity-40 text-white font-black py-4 rounded-xl">Next</button></div>
                    </div>
                )}
                {/* STEP 3 — TRAILERS (per type) */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-900">Trailers</h2>
                        <p className="text-sm text-slate-600">Are you pulling a trailer today?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPullTrailer(true)} className={`flex-1 py-3 rounded-xl font-bold ${pullTrailer === true ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300'}`}>Yes</button>
                            <button onClick={() => { setPullTrailer(false); setTrailerIds([]); setTKind(null); }} className={`flex-1 py-3 rounded-xl font-bold ${pullTrailer === false ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300'}`}>No</button>
                        </div>
                        {pullTrailer && (
                            <>
                                <div><label className={lbl}>Trailer type</label>
                                    <div className="flex flex-wrap gap-2">{kinds.map(k => <button key={k} onClick={() => { setTKind(k as any); setTrailerIds([]); setSuperMode(null); setSizeLabel(''); }} className={`px-4 py-2 rounded-lg font-bold border ${tKind === k ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>{k}</button>)}</div>
                                </div>
                                {tKind === 'Triaxle' && (
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4"><label className={lbl}>Trailer registration</label>
                                        <select value={trailerIds[0] || ''} onChange={e => pickSingle(e.target.value)} className={inp}><option value="">-- choose registration --</option>{trailersOf('Triaxle').map(t => <option key={t.id} value={t.id}>{t.registration || t.name}</option>)}</select>
                                    </div>
                                )}
                                {tKind === 'Skeleton' && (
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                        <div><label className={lbl}>Size</label><div className="flex gap-2">{['6m', '12m'].map(s => <button key={s} onClick={() => setSizeLabel(s)} className={`flex-1 py-2 rounded-lg font-bold border ${sizeLabel === s ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>{s}</button>)}</div></div>
                                        <div><label className={lbl}>Trailer registration</label><select value={trailerIds[0] || ''} onChange={e => pickSingle(e.target.value)} className={inp}><option value="">-- choose registration --</option>{trailersOf('Skeleton').map(t => <option key={t.id} value={t.id}>{t.registration || t.name}</option>)}</select></div>
                                    </div>
                                )}
                                {tKind === 'Superlink' && (
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                        <div><label className={lbl}>Full superlink or single trailer?</label><div className="flex gap-2">
                                            <button onClick={() => { setSuperMode('full'); setTrailerIds([]); }} className={`flex-1 py-2 rounded-lg font-bold border ${superMode === 'full' ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>Full superlink</button>
                                            <button onClick={() => { setSuperMode('single'); setTrailerIds([]); }} className={`flex-1 py-2 rounded-lg font-bold border ${superMode === 'single' ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>Single</button>
                                        </div></div>
                                        {superMode === 'single' && <div><label className={lbl}>Which half?</label><div className="flex gap-2">{['6m', '12m'].map(s => <button key={s} onClick={() => setSizeLabel(s)} className={`flex-1 py-2 rounded-lg font-bold border ${sizeLabel === s ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>{s}</button>)}</div></div>}
                                        {superMode === 'full' && (
                                            <div><label className={lbl}>6m (lead) trailer registration</label>
                                                <select value={trailerIds[0] || ''} onChange={e => pickSuperlinkFull(e.target.value)} className={inp}><option value="">-- choose 6m registration --</option>{trailersOf('Superlink').map(t => <option key={t.id} value={t.id}>{t.registration || t.name}</option>)}</select>
                                                {trailerIds[0] && <p className="text-sm text-slate-600 mt-2">Linked 12m: <strong>{linkedReg(trailerIds[0]) || 'none on file'}</strong></p>}
                                            </div>
                                        )}
                                        {superMode === 'single' && (
                                            <div><label className={lbl}>Trailer registration</label><select value={trailerIds[0] || ''} onChange={e => pickSingle(e.target.value)} className={inp}><option value="">-- choose registration --</option>{trailersOf('Superlink').map(t => <option key={t.id} value={t.id}>{t.registration || t.name}</option>)}</select></div>
                                        )}
                                    </div>
                                )}
                                {!trailerValid && <p className="text-sm font-bold text-red-600">Select the trailer registration to continue.</p>}
                            </>
                        )}
                        <div className="flex gap-2"><button onClick={() => setStep(2)} className="px-5 py-4 rounded-xl bg-white border border-slate-300 font-bold">Back</button><button onClick={() => setStep(4)} disabled={!trailerValid} className="flex-1 bg-[#13294b] disabled:opacity-40 text-white font-black py-4 rounded-xl">Start checklist</button></div>
                    </div>
                )}
                {/* STEP 4 — CHECKLIST */}
                {step === 4 && (
                    <div className="space-y-3">
                        {model.map(grp => (
                            <div key={grp.section}>
                                <h3 className="text-xs font-black text-[#13294b] uppercase tracking-widest mt-4 mb-1">{grp.section}</h3>
                                {/* Wheel grid — every position, each with Tyre/Nuts/Rim (Pass/Fail + photo, mandatory) */}
                                {grp.positions.map(pos => (
                                    <div key={pos} className="bg-white border border-slate-200 rounded-2xl p-4 mb-2">
                                        <p className="font-black text-slate-900 mb-2">{pos}</p>
                                        <div className="space-y-3">
                                            {grp.wheels.filter(w => w.position === pos).map(w => { const a = answers[w.key] || {}; return (
                                                <div key={w.key} id={`q-${w.key}`} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                                                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><span className="flex-1">{w.label.replace(/\s*\(photo.*$/i, '')}</span>{w.help && <button onClick={() => setHelpFor({ label: w.label, help: w.help! })} className="shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 font-black text-sm">i</button>}</p>
                                                    {PassFail(w.key, a, false)}
                                                    <div className="mt-2">{PhotoBtn('Photo', !!a.photoPath, f => onPhoto(w, f))}</div>
                                                    {w.treadDepth && <input type="number" inputMode="decimal" value={a.treadMm || ''} onChange={e => setAns(w.key, { treadMm: e.target.value })} placeholder="Tread mm (optional)" className={inp + ' mt-2'} />}
                                                    {a.aiState === 'running' && <p className="text-xs text-slate-500 mt-1">Analysing tyre…</p>}
                                                    {a.aiState === 'done' && a.ai && <div className={`rounded-xl border p-2 text-sm mt-2 ${aiTone(a.ai)}`}><p className="font-black">{a.ai.overall_assessment}{a.ai.retread_detected ? ' · ⚠ RETREAD' : ''}</p><p className="text-[12px]">Tread: {a.ai.tread_estimate} · {a.ai.confidence_level}</p>{a.ai.condition_issues?.length ? <p className="text-[12px]">{a.ai.condition_issues.join('; ')}</p> : null}</div>}
                                                    {a.status === 'Fail' && <textarea value={a.remarks || ''} onChange={e => setAns(w.key, { remarks: e.target.value })} placeholder="What's wrong? (required)" className={inp + ' mt-2'} style={{ textTransform: 'none' }} />}
                                                </div>
                                            ); })}
                                        </div>
                                    </div>
                                ))}
                                {/* Normal questions */}
                                {grp.normal.map(f => { const a = answers[f.key] || {}; const fault = isFault(f, a); const n = parseInt(a.count || '0', 10) || 0; return (
                                    <div key={f.key} id={`q-${f.key}`} className="bg-white border border-slate-200 rounded-2xl p-4 mb-2">
                                        <p className="font-bold text-slate-900 mb-1 flex items-start gap-2"><span className="flex-1">{f.label}</span>{f.help && <button onClick={() => setHelpFor({ label: f.label, help: f.help! })} className="shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 font-black text-sm" title="What's this?">i</button>}</p>
                                        {f.kind === 'extinguisher' ? (
                                            <>
                                                <input type="number" inputMode="numeric" value={a.count || ''} onChange={e => setAns(f.key, { count: e.target.value })} placeholder="How many extinguishers?" className={inp} />
                                                {Array.from({ length: Math.min(n, 6) }).map((_, x) => { const u = (a.units || [])[x] || {}; return (
                                                    <div key={x} className="mt-3 border border-slate-200 rounded-xl p-3 space-y-2">
                                                        <p className="text-xs font-black text-slate-500">Unit {x + 1}</p>
                                                        <div><label className={lbl}>Expiry date</label><input type="date" value={u.expiry || ''} onChange={e => setUnit(f.key, x, { expiry: e.target.value })} className={inp} /></div>
                                                        <div className="grid grid-cols-2 gap-2">{PhotoBtn('Gauge photo', !!u.gaugePath, file => onUnitPhoto(f.key, x, 'gaugePath', file))}{PhotoBtn('Expiry label', !!u.labelPath, file => onUnitPhoto(f.key, x, 'labelPath', file))}</div>
                                                    </div>
                                                ); })}
                                            </>
                                        ) : f.value && f.value.length ? (
                                            <div className="flex flex-wrap gap-2 mt-1">{f.value.map(v => <button key={v} onClick={() => setAns(f.key, { value: v })} className={`px-3 py-2 rounded-lg text-sm font-bold border ${a.value === v ? ((f.failValues || []).includes(v) ? 'bg-red-600 text-white border-red-600' : 'bg-[#13294b] text-white border-[#13294b]') : 'bg-white border-slate-300 text-slate-600'}`}>{v}</button>)}</div>
                                        ) : f.kind === 'quantity' ? (
                                            <input type="number" inputMode="numeric" value={a.count || ''} onChange={e => setAns(f.key, { count: e.target.value })} placeholder="How many?" className={inp} />
                                        ) : (
                                            PassFail(f.key, a, true)
                                        )}
                                        {(fault || (f.kind === 'normal' && f.photo === 'always')) && (
                                            <div className="mt-3 space-y-2">
                                                {fault && <textarea value={a.remarks || ''} onChange={e => setAns(f.key, { remarks: e.target.value })} placeholder="Which ones / what's wrong? (required)" className={inp} style={{ textTransform: 'none' }} />}
                                                {PhotoBtn(f.spotPhoto ? 'Spot-check photo' : 'Add photo', !!a.photoPath, file => onPhoto(f, file))}
                                            </div>
                                        )}
                                    </div>
                                ); })}
                            </div>
                        ))}
                        <div className="h-4" />
                    </div>
                )}
            </div>
            {step === 4 && <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3"><div className="max-w-xl mx-auto flex items-center gap-3"><span className="text-sm font-bold text-slate-600">{answered}/{fields.length}</span><button onClick={() => { if (allDone) submit(); else if (firstIncomplete) { const el = document.getElementById(`q-${firstIncomplete.key}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }} disabled={submitting} className={`flex-1 disabled:opacity-40 text-white font-black py-3 rounded-xl ${allDone ? 'bg-emerald-600' : 'bg-amber-500'}`}>{submitting ? 'Submitting…' : allDone ? 'Submit inspection' : `${fields.length - answered} still to complete`}</button></div></div>}
            {helpFor && <div className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-6" onClick={() => setHelpFor(null)}><div className="bg-white rounded-2xl p-5 max-w-sm" onClick={e => e.stopPropagation()}><h3 className="font-black text-[#13294b] mb-2">{helpFor.label}</h3><p className="text-sm text-slate-700 leading-relaxed">{helpFor.help}</p><button onClick={() => setHelpFor(null)} className="mt-4 w-full bg-[#13294b] text-white font-bold py-2.5 rounded-lg">Got it</button></div></div>}
        </div>
    );
};

export default MobileInspection;
