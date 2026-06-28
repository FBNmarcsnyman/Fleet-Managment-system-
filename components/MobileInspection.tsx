import React, { useEffect, useMemo, useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

// Public, no-login mobile inspection (?checklist=<uuid>). Flow: confirm vehicle +
// assigned/substituting → driver (scan licence or manual, PDP warnings) → trailers →
// checklist (vehicle + each trailer). Photos → private inspections bucket; tyre photos
// get AI tread/condition; info (i) popups explain technical items.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const GKEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const post = async (fn: string, body: any) => (await fetch(`${BASE}/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) })).json();
const LICENCE_CODES = ['A', 'A1', 'B', 'C1', 'C', 'EB', 'EC1', 'EC'];
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

interface Q { key: string; itemId: string; section: string; label: string; severity: string; photo: string | null; value?: string[]; treadDepth?: boolean; treadOptional?: boolean; perWheel?: boolean; position?: string; quantity?: boolean; expiryPerUnit?: boolean; spotPhoto?: boolean; help?: string; trailerId?: string; trailerName?: string; }
type Ans = { status?: 'Pass' | 'Fail' | 'NA'; value?: string; treadMm?: string; remarks?: string; photoPath?: string; ai?: TyreAI; aiState?: string; count?: string; expiries?: string[] };

const aiTone = (ai: TyreAI) => { const a = (ai.overall_assessment || '').toLowerCase(); return /remove/.test(a) ? 'bg-red-50 border-red-300 text-red-800' : /monitor/.test(a) ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'; };

const MobileInspection: React.FC<{ uuid: string }> = ({ uuid }) => {
    const [data, setData] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [driver, setDriver] = useState({ name: '', idNumber: '', licenceCode: 'EC', pdpExpiry: '', substituting: false });
    const [depot, setDepot] = useState('');
    const [scanning, setScanning] = useState(false);
    const [pullTrailer, setPullTrailer] = useState<boolean | null>(null);
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
            if (d.vehicle?.linkedVehicleId) setTrailerIds([d.vehicle.linkedVehicleId]);
            navigator.geolocation?.getCurrentPosition(p => { const dDbn = Math.hypot(p.coords.latitude + 29.88, p.coords.longitude - 31.0); const dJhb = Math.hypot(p.coords.latitude + 26.2, p.coords.longitude - 28.0); setDepot(prev => prev || (dDbn < dJhb ? 'DBN' : 'JHB')); }, () => {});
            try { const s = localStorage.getItem(draftKey); if (s) { const j = JSON.parse(s); setAnswers(j.answers || {}); } } catch { /* */ }
        })();
    }, [uuid]);

    const vehicle = data?.vehicle;
    const assigned = data?.assignedDriver;
    const isHorse = vehicle?.type === 'Horse' || vehicle?.type === 'Loadmaster';

    // Spot-check: randomly require a photo for spotPhoto items (decided once).
    const [spotSet] = useState<Set<string>>(new Set());
    const buildItems = (tmpl: any, prefix: string, trailer?: { id: string; name: string }): Q[] => {
        if (!tmpl) return [];
        const out: Q[] = [];
        for (const it of (tmpl.items || [])) {
            if (it.loadmasterOnly && vehicle?.type !== 'Loadmaster') continue;
            if (it.crossBorder && !vehicle?.crossBorder) continue;
            const sectionLabel = trailer ? `${trailer.name} — ${it.section || 'General'}` : (it.section || 'General');
            let spot = false;
            if (it.spotPhoto) { const k = `${prefix}${it.id}`; if (!spotSet.has(k) && Math.random() < 0.5) spotSet.add(k); spot = spotSet.has(k); }
            const base: any = { itemId: it.id, section: sectionLabel, label: it.label, severity: it.severity || 'Minor', photo: spot ? 'always' : (it.photo || (it.requiresPhotoOnFail ? 'onFail' : null)), value: it.value, treadDepth: it.treadDepth, treadOptional: it.treadOptional, perWheel: it.perWheel, quantity: it.quantity, expiryPerUnit: it.expiryPerUnit, spotPhoto: spot, help: it.help, trailerId: trailer?.id, trailerName: trailer?.name };
            if (it.perWheel && Array.isArray(it.wheelPositions) && it.wheelPositions.length) it.wheelPositions.forEach((pos: string) => out.push({ ...base, key: `${prefix}${it.id}::${pos}`, position: pos }));
            else out.push({ ...base, key: `${prefix}${it.id}` });
        }
        return out;
    };
    const questions: Q[] = useMemo(() => {
        if (!data) return [];
        let qs = buildItems(data.template, '');
        trailerIds.forEach((tid, idx) => { const t = (data.trailers || []).find((x: any) => x.id === tid); if (t && data.trailerTemplate) qs = qs.concat(buildItems(data.trailerTemplate, `tr${idx}::`, { id: t.id, name: t.registration || t.name })); });
        return qs;
    }, [data, trailerIds]);

    const answered = questions.filter(q => answers[q.key]?.status).length;
    const pct = questions.length ? Math.round((answered / questions.length) * 100) : 0;
    const allDone = questions.length > 0 && answered === questions.length;

    useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify({ answers })); } catch { /* */ } }, [answers]);
    const setAns = (key: string, patch: Ans) => setAnswers(p => ({ ...p, [key]: { ...p[key], ...patch } }));

    const onLicence = async (file?: File) => {
        if (!file) return; setScanning(true);
        const b64 = await compress(file); const r = await scanLicence(b64); setScanning(false);
        if (r) setDriver(d => ({ ...d, name: r.fullName || d.name, idNumber: r.idNumber || d.idNumber, licenceCode: r.vehicleCodes || d.licenceCode, pdpExpiry: r.pdpExpiry || d.pdpExpiry }));
    };
    const onPhoto = async (q: Q, file?: File) => {
        if (!file) return;
        const b64 = await compress(file);
        const up = await post('inspection-upload', { base64: b64, vehicleId: vehicle.id, contentType: 'image/jpeg' });
        if (up?.path) setAns(q.key, { photoPath: up.path });
        if (q.treadDepth) { setAns(q.key, { aiState: 'running' }); const ai = await analyseTyre(b64); setAns(q.key, ai ? { ai, aiState: 'done' } : { aiState: 'failed' }); }
    };
    const pdpDays = driver.pdpExpiry ? Math.ceil((new Date(driver.pdpExpiry).getTime() - Date.now()) / 86400000) : null;

    const submit = async () => {
        setSubmitting(true);
        const results = questions.map(q => { const a = answers[q.key] || {}; return { itemId: q.itemId, label: q.label, section: q.section, severity: q.severity, position: q.position || null, status: a.status, value: a.value || null, treadMm: a.treadMm || null, count: a.count || null, expiries: a.expiries || null, remarks: a.remarks || null, photoPath: a.photoPath || null, ai: a.ai || null, trailerId: q.trailerId || null, trailerName: q.trailerName || null }; });
        const res = await post('submit-inspection', { vehicleId: vehicle.id, vehicleReg: vehicle.registration, vehicleType: vehicle.type, depot, templateId: data.template.id, templateName: data.template.name, driver: { ...driver, pdpExpiry: driver.pdpExpiry || null }, trailerIds, results });
        setSubmitting(false);
        if (res?.ok) { localStorage.removeItem(draftKey); setDone(res); } else setErr(res?.error || 'Submit failed.');
    };

    if (err) return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm text-center"><p className="text-red-600 font-bold">{err}</p></div></div>;
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
                            <div><label className={lbl}>Licence code</label><input value={driver.licenceCode} onChange={e => setDriver({ ...driver, licenceCode: e.target.value })} className={inp} list="lc" /><datalist id="lc">{LICENCE_CODES.map(c => <option key={c} value={c} />)}</datalist></div>
                            <div><label className={lbl}>PDP expiry</label><input type="date" value={driver.pdpExpiry} onChange={e => setDriver({ ...driver, pdpExpiry: e.target.value })} className={inp} /></div>
                            {pdpDays !== null && pdpDays < 0 && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">⛔ PDP expired — flagged.</p>}
                            {pdpDays !== null && pdpDays >= 0 && pdpDays <= 30 && <p className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">⚠️ PDP expires in {pdpDays} days.</p>}
                            <div><label className={lbl}>Depot</label><select value={depot} onChange={e => setDepot(e.target.value)} className={inp}><option value="">-- select --</option>{DEPOTS.map(d => <option key={d}>{d}</option>)}</select></div>
                        </div>
                        <div className="flex gap-2"><button onClick={() => setStep(1)} className="px-5 py-4 rounded-xl bg-white border border-slate-300 font-bold">Back</button><button onClick={() => setStep(isHorse ? 3 : 4)} disabled={!driver.name.trim()} className="flex-1 bg-[#13294b] disabled:opacity-40 text-white font-black py-4 rounded-xl">Next</button></div>
                    </div>
                )}
                {/* STEP 3 — TRAILERS */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-900">Trailers</h2>
                        <p className="text-sm text-slate-600">Are you pulling a trailer today?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPullTrailer(true)} className={`flex-1 py-3 rounded-xl font-bold ${pullTrailer === true ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300'}`}>Yes</button>
                            <button onClick={() => { setPullTrailer(false); setTrailerIds([]); }} className={`flex-1 py-3 rounded-xl font-bold ${pullTrailer === false ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300'}`}>No</button>
                        </div>
                        {pullTrailer && [0, 1].map(slot => (
                            <div key={slot} className="bg-white border border-slate-200 rounded-2xl p-4">
                                <label className={lbl}>Trailer {slot + 1}</label>
                                <select value={trailerIds[slot] || ''} onChange={e => setTrailerIds(prev => { const n = [...prev]; if (e.target.value) n[slot] = e.target.value; else n.splice(slot, 1); return n.filter(Boolean); })} className={inp}>
                                    <option value="">-- none --</option>
                                    {data.trailers.map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.registration ? ` (${t.registration})` : ''}</option>)}
                                </select>
                            </div>
                        ))}
                        <div className="flex gap-2"><button onClick={() => setStep(2)} className="px-5 py-4 rounded-xl bg-white border border-slate-300 font-bold">Back</button><button onClick={() => setStep(4)} disabled={pullTrailer === null} className="flex-1 bg-[#13294b] disabled:opacity-40 text-white font-black py-4 rounded-xl">Start checklist</button></div>
                    </div>
                )}
                {/* STEP 4 — CHECKLIST */}
                {step === 4 && (
                    <div className="space-y-3">
                        {questions.map((q, i) => {
                            const a = answers[q.key] || {};
                            const showFail = a.status === 'Fail';
                            const prev = i > 0 ? questions[i - 1].section : null;
                            const n = parseInt(a.count || '0', 10) || 0;
                            return (
                                <div key={q.key}>
                                    {q.section !== prev && <h3 className="text-xs font-black text-[#13294b] uppercase tracking-widest mt-4 mb-1">{q.section}</h3>}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                                        <p className="font-bold text-slate-900 mb-1 flex items-start gap-2">
                                            <span className="flex-1">{q.label}{q.position ? <span className="text-slate-500 font-normal"> — {q.position}</span> : ''}</span>
                                            {q.help && <button onClick={() => setHelpFor({ label: q.label, help: q.help! })} className="shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 font-black text-sm" title="What's this?">i</button>}
                                        </p>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {(['Pass', 'Fail', 'NA'] as const).map(s => <button key={s} onClick={() => setAns(q.key, { status: s })} className={`py-3 rounded-xl font-black ${a.status === s ? (s === 'Pass' ? 'bg-emerald-600 text-white' : s === 'Fail' ? 'bg-red-600 text-white' : 'bg-slate-400 text-white') : 'bg-slate-100 text-slate-600'}`}>{s === 'NA' ? 'N/A' : s}</button>)}
                                        </div>
                                        {q.value && q.value.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{q.value.map(v => <button key={v} onClick={() => setAns(q.key, { value: v })} className={`px-3 py-2 rounded-lg text-sm font-bold border ${a.value === v ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>{v}</button>)}</div>}
                                        {q.quantity && !q.value && <input type="number" inputMode="numeric" value={a.count || ''} onChange={e => setAns(q.key, { count: e.target.value })} placeholder="How many?" className={inp + ' mt-3'} />}
                                        {q.expiryPerUnit && n > 0 && <div className="mt-2 space-y-2">{Array.from({ length: Math.min(n, 6) }).map((_, x) => <div key={x}><label className={lbl}>Unit {x + 1} expiry</label><input type="date" value={a.expiries?.[x] || ''} onChange={e => setAns(q.key, { expiries: Object.assign([], a.expiries, { [x]: e.target.value }) })} className={inp} /></div>)}</div>}
                                        {q.treadDepth && <input type="number" inputMode="decimal" value={a.treadMm || ''} onChange={e => setAns(q.key, { treadMm: e.target.value })} placeholder="Tread mm (optional — only if you measured)" className={inp + ' mt-3'} />}
                                        {(showFail || q.photo === 'always') && (
                                            <div className="mt-3 space-y-2">
                                                {showFail && <textarea value={a.remarks || ''} onChange={e => setAns(q.key, { remarks: e.target.value })} placeholder="What's wrong? (required)" className={inp} style={{ textTransform: 'none' }} />}
                                                <label className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold cursor-pointer ${a.photoPath ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-[#13294b] text-white'}`}>{a.photoPath ? '✓ Photo added' : (q.spotPhoto ? '📷 Spot-check photo' : '📷 Add photo')}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onPhoto(q, e.target.files?.[0])} /></label>
                                                {a.aiState === 'running' && <p className="text-xs text-slate-500">Analysing tyre…</p>}
                                                {a.aiState === 'done' && a.ai && <div className={`rounded-xl border p-3 text-sm ${aiTone(a.ai)}`}><p className="font-black">{a.ai.overall_assessment}{a.ai.retread_detected ? ' · ⚠ RETREAD' : ''}</p><p className="text-[12px] mt-0.5">Tread: {a.ai.tread_estimate} · {a.ai.confidence_level} confidence</p>{a.ai.condition_issues?.length ? <p className="text-[12px] mt-0.5">{a.ai.condition_issues.join('; ')}</p> : null}</div>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div className="h-4" />
                    </div>
                )}
            </div>
            {step === 4 && <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3"><div className="max-w-xl mx-auto flex items-center gap-3"><span className="text-sm font-bold text-slate-600">{answered}/{questions.length}</span><button onClick={submit} disabled={!allDone || submitting} className="flex-1 bg-emerald-600 disabled:opacity-40 text-white font-black py-3 rounded-xl">{submitting ? 'Submitting…' : allDone ? 'Submit inspection' : `${questions.length - answered} left`}</button></div></div>}
            {helpFor && <div className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-6" onClick={() => setHelpFor(null)}><div className="bg-white rounded-2xl p-5 max-w-sm" onClick={e => e.stopPropagation()}><h3 className="font-black text-[#13294b] mb-2">{helpFor.label}</h3><p className="text-sm text-slate-700 leading-relaxed">{helpFor.help}</p><button onClick={() => setHelpFor(null)} className="mt-4 w-full bg-[#13294b] text-white font-bold py-2.5 rounded-lg">Got it</button></div></div>}
        </div>
    );
};

export default MobileInspection;
