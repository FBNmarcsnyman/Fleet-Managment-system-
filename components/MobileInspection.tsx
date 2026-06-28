import React, { useEffect, useMemo, useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

// Public, no-login mobile inspection page (?checklist=<uuid>). Loads the vehicle +
// template via inspection-load, walks driver → vehicle → trailers → checklist, uploads
// photos to the private inspections bucket (inspection-upload), and submits via
// submit-inspection. Large touch targets; autosaves a local draft.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const post = async (fn: string, body: any) => {
    const r = await fetch(`${BASE}/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) });
    return r.json();
};
const LICENCE_CODES = ['A', 'A1', 'B', 'C1', 'C', 'EB', 'EC1', 'EC'];
const DEPOTS = ['DBN', 'JHB', 'CPT', 'On Road'];
const inp = 'w-full border border-slate-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const lbl = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1';

// Downscale + compress an image to <~1MB JPEG, return data URL.
const compress = (file: File): Promise<string> => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const max = 1600; let { width, height } = img;
            if (width > max || height > max) { const s = max / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); }
            const c = document.createElement('canvas'); c.width = width; c.height = height;
            c.getContext('2d')!.drawImage(img, 0, 0, width, height);
            resolve(c.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(reader.result as string);
        img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
});

interface Q { key: string; itemId: string; section: string; label: string; severity: string; photo: string | null; value?: string[]; failValues?: string[]; treadDepth?: boolean; criticalUnderMm?: number; position?: string; }
type TyreAI = { tread_estimate?: string; condition_issues?: string[]; overall_assessment?: string; confidence_level?: string; retread_detected?: boolean; notes?: string };
type Ans = { status?: 'Pass' | 'Fail' | 'NA'; value?: string; treadMm?: string; remarks?: string; photoPath?: string; ai?: TyreAI; aiState?: 'running' | 'done' | 'failed' };

const TYRE_PROMPT = 'You are a commercial vehicle tyre safety inspector with expertise in South African road transport regulations. Analyse this tyre photo and return ONLY a JSON object with no other text: tread_estimate (Good above 4mm / Marginal 2-4mm / Critical under 2mm), condition_issues (array of strings describing any cuts bulges sidewall damage uneven wear exposed cords), overall_assessment (Safe to operate / Monitor closely / Remove from service immediately), confidence_level (High / Medium / Low), retread_detected (true/false), notes (string).';

// Analyse a tyre photo with Gemini (the app's existing AI key). Returns the JSON or null.
const analyseTyre = async (dataUrl: string): Promise<TyreAI | null> => {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;
    try {
        const ai = new GoogleGenAI({ apiKey });
        const resp: any = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] } }, { text: TYRE_PROMPT }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: Type.OBJECT, properties: {
                    tread_estimate: { type: Type.STRING }, condition_issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                    overall_assessment: { type: Type.STRING }, confidence_level: { type: Type.STRING },
                    retread_detected: { type: Type.BOOLEAN }, notes: { type: Type.STRING },
                } },
            },
        });
        return JSON.parse((resp.text || '{}').trim());
    } catch (e) { console.error('[tyre-ai]', e); return null; }
};
const aiCard = (ai: TyreAI) => {
    const a = (ai.overall_assessment || '').toLowerCase();
    const tone = /remove/.test(a) ? 'bg-red-50 border-red-300 text-red-800' : /monitor/.test(a) ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800';
    return { tone };
};

const MobileInspection: React.FC<{ uuid: string }> = ({ uuid }) => {
    const [data, setData] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [driver, setDriver] = useState({ name: '', idNumber: '', licenceCode: 'EC', pdpExpiry: '', substituting: false });
    const [depot, setDepot] = useState('');
    const [trailerIds, setTrailerIds] = useState<string[]>([]);
    const [answers, setAnswers] = useState<Record<string, Ans>>({});
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<any>(null);
    const draftKey = `fbn-insp-${uuid}`;

    useEffect(() => {
        (async () => {
            const d = await post('inspection-load', { uuid });
            if (d?.error || !d?.ok) { setErr(d?.error || 'Could not load this vehicle.'); return; }
            setData(d);
            setDepot(d.vehicle?.depot || '');
            // GPS depot suggestion (DBN ≈ -29.88,31.0 / JHB ≈ -26.2,28.0).
            navigator.geolocation?.getCurrentPosition(p => {
                const dDbn = Math.hypot(p.coords.latitude + 29.88, p.coords.longitude - 31.0);
                const dJhb = Math.hypot(p.coords.latitude + 26.2, p.coords.longitude - 28.0);
                setDepot(prev => prev || (dDbn < dJhb ? 'DBN' : 'JHB'));
            }, () => {});
            try { const saved = localStorage.getItem(draftKey); if (saved) { const j = JSON.parse(saved); setAnswers(j.answers || {}); if (j.driver) setDriver(j.driver); } } catch { /* */ }
        })();
    }, [uuid]);

    const vehicle = data?.vehicle;
    const template = data?.template;

    // Build the flat question list (expand per-wheel; hide loadmaster/cross-border as needed).
    const questions: Q[] = useMemo(() => {
        if (!template) return [];
        const out: Q[] = [];
        for (const it of (template.items || [])) {
            if (it.loadmasterOnly && vehicle?.type !== 'Loadmaster') continue;
            if (it.crossBorder && !vehicle?.crossBorder) continue;
            const base = { itemId: it.id, section: it.section || 'General', label: it.label, severity: it.severity || 'Minor', photo: it.photo || (it.requiresPhotoOnFail ? 'onFail' : null), value: it.value, failValues: it.failValues, treadDepth: it.treadDepth, criticalUnderMm: it.criticalUnderMm };
            if (it.perWheel && Array.isArray(it.wheelPositions) && it.wheelPositions.length) {
                it.wheelPositions.forEach((pos: string) => out.push({ ...base, key: `${it.id}::${pos}`, position: pos }));
            } else out.push({ ...base, key: it.id });
        }
        return out;
    }, [template, vehicle]);

    const answeredCount = questions.filter(q => answers[q.key]?.status).length;
    const pct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
    const allDone = questions.length > 0 && answeredCount === questions.length;

    // Autosave draft (every 30s + on change).
    useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify({ answers, driver })); } catch { /* */ } }, [answers, driver]);
    useEffect(() => { const t = setInterval(() => { try { localStorage.setItem(draftKey, JSON.stringify({ answers, driver })); } catch { /* */ } }, 30000); return () => clearInterval(t); }, [answers, driver]);

    const setAns = (key: string, patch: Ans) => setAnswers(p => ({ ...p, [key]: { ...p[key], ...patch } }));

    const onPhoto = async (q: Q, file?: File) => {
        if (!file) return;
        const b64 = await compress(file);
        const up = await post('inspection-upload', { base64: b64, vehicleId: vehicle.id, contentType: 'image/jpeg' });
        if (up?.path) setAns(q.key, { photoPath: up.path });
        // Tyre items: run the AI tyre analysis and attach the result.
        if (q.treadDepth) {
            setAns(q.key, { aiState: 'running' });
            const ai = await analyseTyre(b64);
            setAns(q.key, ai ? { ai, aiState: 'done' } : { aiState: 'failed' });
        }
    };

    const pdpDays = driver.pdpExpiry ? Math.ceil((new Date(driver.pdpExpiry).getTime() - Date.now()) / 86400000) : null;

    const submit = async () => {
        setSubmitting(true);
        const results = questions.map(q => { const a = answers[q.key] || {}; return { itemId: q.itemId, label: q.label, section: q.section, severity: q.severity, position: q.position || null, status: a.status, value: a.value || null, treadMm: a.treadMm || null, remarks: a.remarks || null, photoPath: a.photoPath || null, ai: a.ai || null }; });
        const res = await post('submit-inspection', { vehicleId: vehicle.id, vehicleReg: vehicle.registration, vehicleType: vehicle.type, depot, templateId: template.id, templateName: template.name, driver: { ...driver, pdpExpiry: driver.pdpExpiry || null }, trailerIds, results });
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
                {done.failedItems?.length > 0 && (
                    <div className="mt-4 text-left">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Failed items ({done.failedItems.length})</p>
                        <ul className="text-sm text-slate-700 space-y-1">{done.failedItems.map((f: any, i: number) => <li key={i}>• <strong>{f.severity}</strong> — {f.label}{f.position ? ` (${f.position})` : ''}</li>)}</ul>
                    </div>
                )}
            </div>
        </div>
    );

    const headerBar = (
        <div className="sticky top-0 z-10 bg-[#13294b] text-white px-4 py-3">
            <div className="flex items-center justify-between">
                <div><div className="font-black">{vehicle.registration || vehicle.name}</div><div className="text-[11px] text-slate-300">{vehicle.type} · {depot || vehicle.depot}</div></div>
                <div className="text-right text-[11px] text-slate-300">{template?.name}</div>
            </div>
            {step === 4 && <div className="mt-2 h-1.5 bg-white/20 rounded-full"><div className="h-1.5 rounded-full bg-[#f5b700]" style={{ width: `${pct}%` }} /></div>}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100">
            {headerBar}
            <div className="max-w-xl mx-auto p-4 pb-28">
                {/* STEP 1 — DRIVER */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-900">Driver details</h2>
                        <p className="text-xs text-slate-500">Licence barcode scan is coming soon — please enter your details.</p>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                            <div><label className={lbl}>Full name</label><input value={driver.name} onChange={e => setDriver({ ...driver, name: e.target.value })} className={inp} /></div>
                            <div><label className={lbl}>ID number</label><input value={driver.idNumber} onChange={e => setDriver({ ...driver, idNumber: e.target.value })} className={inp} inputMode="numeric" /></div>
                            <div><label className={lbl}>Licence code</label><select value={driver.licenceCode} onChange={e => setDriver({ ...driver, licenceCode: e.target.value })} className={inp}>{LICENCE_CODES.map(c => <option key={c}>{c}</option>)}</select></div>
                            <div><label className={lbl}>PDP expiry</label><input type="date" value={driver.pdpExpiry} onChange={e => setDriver({ ...driver, pdpExpiry: e.target.value })} className={inp} /></div>
                            {pdpDays !== null && pdpDays < 0 && <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">⛔ Your PDP has expired. You may continue, but this will be flagged.</p>}
                            {pdpDays !== null && pdpDays >= 0 && pdpDays <= 30 && <p className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">⚠️ Your PDP expires in {pdpDays} days.</p>}
                            <div><label className={lbl}>Depot</label><select value={depot} onChange={e => setDepot(e.target.value)} className={inp}><option value="">-- select --</option>{DEPOTS.map(d => <option key={d}>{d}</option>)}</select></div>
                        </div>
                        <button onClick={() => setStep(2)} disabled={!driver.name.trim()} className="w-full bg-[#13294b] disabled:opacity-40 text-white font-black py-4 rounded-xl">Next: confirm vehicle</button>
                    </div>
                )}

                {/* STEP 2 — VEHICLE */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-900">Confirm vehicle</h2>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
                            <p className="text-2xl font-black text-[#13294b]">{vehicle.registration || vehicle.name}</p>
                            <p className="text-sm text-slate-600">{vehicle.type} · {vehicle.depot}</p>
                            {data.assignedDriver && <p className="text-sm text-slate-500">Assigned driver: <strong>{data.assignedDriver.name}</strong></p>}
                            {data.lastInspection && <p className="text-[12px] text-slate-400 mt-1">Last inspection: {new Date(data.lastInspection.date).toLocaleDateString('en-ZA')} — {data.lastInspection.result || '—'}</p>}
                        </div>
                        {data.assignedDriver && data.assignedDriver.name && driver.name && data.assignedDriver.name.trim().toLowerCase() !== driver.name.trim().toLowerCase() && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <p className="text-sm font-bold text-amber-800 mb-2">You're not the assigned driver ({data.assignedDriver.name}). Are you substituting?</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setDriver({ ...driver, substituting: true })} className={`flex-1 py-2 rounded-lg font-bold ${driver.substituting ? 'bg-amber-600 text-white' : 'bg-white border border-slate-300'}`}>Yes, substituting</button>
                                    <button onClick={() => setDriver({ ...driver, substituting: false })} className={`flex-1 py-2 rounded-lg font-bold ${!driver.substituting ? 'bg-[#13294b] text-white' : 'bg-white border border-slate-300'}`}>No</button>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={() => setStep(1)} className="px-5 py-4 rounded-xl bg-white border border-slate-300 font-bold">Back</button>
                            <button onClick={() => setStep(vehicle.type === 'Horse' || vehicle.type === 'Loadmaster' ? 3 : 4)} className="flex-1 bg-[#13294b] text-white font-black py-4 rounded-xl">Next</button>
                        </div>
                    </div>
                )}

                {/* STEP 3 — TRAILERS (Horse) */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-black text-slate-900">Trailers attached</h2>
                        <p className="text-xs text-slate-500">Select the trailer(s) you're pulling. Each trailer should also be inspected via its own QR code.</p>
                        {[0, 1].map(slot => (
                            <div key={slot} className="bg-white border border-slate-200 rounded-2xl p-4">
                                <label className={lbl}>Trailer {slot + 1}</label>
                                <select value={trailerIds[slot] || ''} onChange={e => setTrailerIds(prev => { const n = [...prev]; if (e.target.value) n[slot] = e.target.value; else n.splice(slot, 1); return n.filter(Boolean); })} className={inp}>
                                    <option value="">-- none --</option>
                                    {data.trailers.map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.registration ? ` (${t.registration})` : ''}</option>)}
                                </select>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <button onClick={() => setStep(2)} className="px-5 py-4 rounded-xl bg-white border border-slate-300 font-bold">Back</button>
                            <button onClick={() => setStep(4)} className="flex-1 bg-[#13294b] text-white font-black py-4 rounded-xl">Start checklist</button>
                        </div>
                    </div>
                )}

                {/* STEP 4 — CHECKLIST */}
                {step === 4 && (
                    <div className="space-y-3">
                        {questions.map((q, i) => {
                            const a = answers[q.key] || {};
                            const showFail = a.status === 'Fail';
                            const prevSection = i > 0 ? questions[i - 1].section : null;
                            return (
                                <div key={q.key}>
                                    {q.section !== prevSection && <h3 className="text-xs font-black text-[#13294b] uppercase tracking-widest mt-4 mb-1">{q.section}</h3>}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                                        <p className="font-bold text-slate-900 mb-1">{q.label}{q.position ? <span className="text-slate-500 font-normal"> — {q.position}</span> : ''}</p>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {(['Pass', 'Fail', 'NA'] as const).map(s => (
                                                <button key={s} onClick={() => setAns(q.key, { status: s })} className={`py-3 rounded-xl font-black ${a.status === s ? (s === 'Pass' ? 'bg-emerald-600 text-white' : s === 'Fail' ? 'bg-red-600 text-white' : 'bg-slate-400 text-white') : 'bg-slate-100 text-slate-600'}`}>{s === 'NA' ? 'N/A' : s}</button>
                                            ))}
                                        </div>
                                        {q.value && q.value.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">{q.value.map(v => <button key={v} onClick={() => setAns(q.key, { value: v })} className={`px-3 py-2 rounded-lg text-sm font-bold border ${a.value === v ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white border-slate-300 text-slate-600'}`}>{v}</button>)}</div>
                                        )}
                                        {q.treadDepth && (
                                            <input type="number" inputMode="decimal" value={a.treadMm || ''} onChange={e => setAns(q.key, { treadMm: e.target.value })} placeholder="Tread depth (mm)" className={inp + ' mt-3'} />
                                        )}
                                        {(showFail || q.photo === 'always') && (
                                            <div className="mt-3 space-y-2">
                                                {showFail && <textarea value={a.remarks || ''} onChange={e => setAns(q.key, { remarks: e.target.value })} placeholder="What's wrong? (required)" className={inp} style={{ textTransform: 'none' }} />}
                                                <label className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold cursor-pointer ${a.photoPath ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-[#13294b] text-white'}`}>
                                                    {a.photoPath ? '✓ Photo added' : '📷 Add photo'}
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onPhoto(q, e.target.files?.[0])} />
                                                </label>
                                                {a.aiState === 'running' && <p className="text-xs text-slate-500">Analysing tyre…</p>}
                                                {a.aiState === 'done' && a.ai && (() => { const c = aiCard(a.ai!); return (
                                                    <div className={`rounded-xl border p-3 text-sm ${c.tone}`}>
                                                        <p className="font-black">{a.ai!.overall_assessment}{a.ai!.retread_detected ? ' · ⚠ RETREAD DETECTED' : ''}</p>
                                                        <p className="text-[12px] mt-0.5">Tread: {a.ai!.tread_estimate} · confidence {a.ai!.confidence_level}</p>
                                                        {a.ai!.condition_issues && a.ai!.condition_issues.length > 0 && <p className="text-[12px] mt-0.5">{a.ai!.condition_issues.join('; ')}</p>}
                                                    </div>
                                                ); })()}
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

            {step === 4 && (
                <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3">
                    <div className="max-w-xl mx-auto flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-600">{answeredCount}/{questions.length}</span>
                        <button onClick={submit} disabled={!allDone || submitting} className="flex-1 bg-emerald-600 disabled:opacity-40 text-white font-black py-3 rounded-xl">{submitting ? 'Submitting…' : allDone ? 'Submit inspection' : `Answer all items (${questions.length - answeredCount} left)`}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileInspection;
