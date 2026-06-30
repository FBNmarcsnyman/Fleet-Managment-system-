import React, { useState } from 'react';
import { SLA_CLAUSES, SLA_INTRO, SLA_GIT_MIN } from '../../lib/subcontractorSla';
import DateField from '../operations/DateField';

// Public, no-login 5-step subcontractor registration (/supplier-register and the
// ?invite=<token> link). Posts to the `supplier-register` edge fn which uploads
// docs, captures IP+timestamp, generates the agreement PDF, creates a PENDING
// supplier_applications record (onboarding queue), and emails applicant + admin.
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/supplier-register`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const VEHICLE_TYPES = ['Superlink', 'Tri-axle', '12m Rigid', '6m Rigid', 'Flatdeck', 'Curtainsider', 'Tanker', 'Tautliner'];
const ROUTE_PAIRS = ['DBN-JHB', 'JHB-DBN', 'DBN-CPT', 'CPT-DBN', 'CPT-JHB', 'JHB-CPT', 'JHB-PE', 'JHB-RBAY', 'DBN-PE'];
const LOAD_TYPES = ['Full Load', 'Part Load', 'Pallets', 'Consolidation', 'Abnormal', 'HAZMAT', 'Dedicated'];
const BEE_LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Non-Compliant'];
const COUNTRIES = ['Botswana', 'Zimbabwe', 'Zambia', 'Mozambique', 'Namibia', 'Eswatini', 'Lesotho', 'Malawi', 'DRC', 'Tanzania'];
const CERTS: { key: string; label: string; required?: boolean; note?: string }[] = [
    { key: 'GIT', label: 'Goods-in-Transit (GIT) policy', required: true, note: `Minimum cover ${SLA_GIT_MIN} per load` },
    { key: 'HAZCHEM', label: 'HAZCHEM certificate' },
    { key: 'RTMS', label: 'RTMS certificate' },
    { key: 'COID', label: 'COID letter of good standing' },
    { key: 'CrossBorderPermits', label: 'Cross-border permits (if applicable)' },
];

type Vehicle = { registration: string; vehicleType: string; payloadTonnes: string; bodyLengthM: string; hazmat: boolean; abnormal: boolean; trackerFitted: boolean; trackerProvider: string; mvlExpiry: string };
const blankVehicle = (): Vehicle => ({ registration: '', vehicleType: VEHICLE_TYPES[0], payloadTonnes: '', bodyLengthM: '', hazmat: false, abnormal: false, trackerFitted: true, trackerProvider: '', mvlExpiry: '' });
const fileToB64 = (f: File): Promise<string> => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); });

const NAVY = '#13294b', GOLD = '#f5b700';
const card = 'bg-white border border-slate-200 rounded-2xl';
const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';
const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold border transition ${on ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#13294b]'}`;

const SupplierRegister: React.FC<{ inviteToken?: string | null }> = ({ inviteToken }) => {
    const [step, setStep] = useState(1);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [done, setDone] = useState<{ ref: string } | null>(null);

    const [company, setCompany] = useState({ companyName: '', registrationNumber: '', vatNumber: '', beeLevel: 'Non-Compliant', address: '', yearsOperating: '', contactName: '', contactEmail: '', contactMobile: '' });
    const [vehicles, setVehicles] = useState<Vehicle[]>([blankVehicle()]);
    const [routes, setRoutes] = useState<Record<string, string[]>>({});
    const [countries, setCountries] = useState<string[]>([]);
    const [docs, setDocs] = useState<Record<string, { file: File | null; expiry: string }>>({});
    const [agree, setAgree] = useState({ fullName: '', idNumber: '', position: '', accepted: false });

    const setC = (k: string, v: any) => setCompany(p => ({ ...p, [k]: v }));
    const setV = (i: number, k: keyof Vehicle, v: any) => setVehicles(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
    const toggleRoute = (r: string) => setRoutes(p => { const n = { ...p }; if (n[r]) delete n[r]; else n[r] = []; return n; });
    const toggleRouteLoad = (r: string, lt: string) => setRoutes(p => ({ ...p, [r]: (p[r] || []).includes(lt) ? p[r].filter(x => x !== lt) : [...(p[r] || []), lt] }));
    const toggleCountry = (c: string) => setCountries(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
    const setDoc = (key: string, patch: any) => setDocs(p => ({ ...p, [key]: { ...(p[key] || { file: null, expiry: '' }), ...patch } }));

    const next = () => { setErr(null); setStep(s => s + 1); };
    const back = () => { setErr(null); setStep(s => s - 1); };

    const submit = async () => {
        setErr(null);
        if (!agree.accepted || !agree.fullName.trim()) { setErr('Please enter your full name and tick the acceptance box.'); return; }
        if (!docs.GIT?.file) { setErr('The Goods-in-Transit (GIT) document is required.'); return; }
        setBusy(true);
        try {
            const documents = await Promise.all(CERTS.filter(ct => docs[ct.key]?.file).map(async ct => ({ type: ct.key, fileName: docs[ct.key].file!.name, contentType: docs[ct.key].file!.type, base64: await fileToB64(docs[ct.key].file!), expiry: docs[ct.key].expiry || null })));
            const payload = {
                company,
                vehicles: vehicles.filter(v => v.registration.trim()),
                routes: Object.entries(routes).map(([route, loadTypes]) => ({ route, loadTypes })),
                crossBorderCountries: countries,
                documents,
                agreement: agree,
                slaIntro: SLA_INTRO, slaClauses: SLA_CLAUSES,
                inviteToken: inviteToken || undefined,
            };
            const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(payload) });
            const d = await r.json();
            if (!r.ok || d.error) throw new Error(d.error || 'Submission failed.');
            setDone({ ref: d.reference });
        } catch (e) { setErr(e instanceof Error ? e.message : 'Submission failed.'); }
        finally { setBusy(false); }
    };

    if (done) return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className={`${card} max-w-lg w-full p-10 text-center`}>
                <div className="text-5xl mb-3">✓</div>
                <h1 className="text-2xl font-black text-[#13294b]">Application received</h1>
                <p className="text-slate-600 text-sm mt-2">Thank you. Your company profile and signed agreement are now with our compliance team for vetting. Reference <strong>{done.ref}</strong> — we've emailed you a confirmation.</p>
                <a href="/" className="inline-block mt-6 bg-[#13294b] text-white font-bold py-2.5 px-6 rounded-lg text-sm">Done</a>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="rounded-2xl overflow-hidden mb-5" style={{ background: NAVY }}>
                    <div className="px-7 py-5 flex items-center justify-between">
                        <div>
                            <img src="/fbn-logo.jpg" alt="FBN Transport" className="h-9 bg-white rounded px-2 py-1 mb-2" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            <div className="text-white font-black text-lg">Join the FBN Carrier Network</div>
                            <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Subcontractor registration</div>
                        </div>
                        {inviteToken && <span className="text-[11px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-3 py-1.5 rounded-full font-bold">✓ Invited by FBN</span>}
                    </div>
                    <div style={{ height: 4, background: GOLD }} />
                </div>

                {/* Stepper */}
                <div className="flex items-center justify-between mb-5 px-1">
                    {['Company', 'Fleet', 'Routes', 'Certifications', 'Agreement'].map((t, i) => (
                        <div key={t} className="flex items-center gap-2 flex-1 last:flex-none">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${step >= i + 1 ? 'bg-[#13294b] text-white' : 'bg-slate-300 text-slate-600'}`}>{i + 1}</div>
                            <span className={`text-xs font-bold hidden sm:block ${step >= i + 1 ? 'text-[#13294b]' : 'text-slate-400'}`}>{t}</span>
                            {i < 4 && <div className={`h-0.5 flex-1 mx-1 ${step > i + 1 ? 'bg-[#13294b]' : 'bg-slate-300'}`} />}
                        </div>
                    ))}
                </div>

                <div className={`${card} p-6`}>
                    {err && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

                    {/* STEP 1 — COMPANY */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className={lbl}>Company name *</label><input value={company.companyName} onChange={e => setC('companyName', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Registration number</label><input value={company.registrationNumber} onChange={e => setC('registrationNumber', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>VAT number</label><input value={company.vatNumber} onChange={e => setC('vatNumber', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>BEE level</label><select value={company.beeLevel} onChange={e => setC('beeLevel', e.target.value)} className={inp}>{BEE_LEVELS.map(b => <option key={b}>{b}</option>)}</select></div>
                            <div><label className={lbl}>Years operating</label><input type="number" value={company.yearsOperating} onChange={e => setC('yearsOperating', e.target.value)} className={inp} /></div>
                            <div className="sm:col-span-2"><label className={lbl}>Physical address</label><input value={company.address} onChange={e => setC('address', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Primary contact name</label><input value={company.contactName} onChange={e => setC('contactName', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Email *</label><input type="email" value={company.contactEmail} onChange={e => setC('contactEmail', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Mobile number</label><input value={company.contactMobile} onChange={e => setC('contactMobile', e.target.value)} className={inp} /></div>
                            <div className="sm:col-span-2 flex justify-end mt-2"><button onClick={next} disabled={!company.companyName.trim() || !company.contactEmail.trim()} className="bg-[#13294b] disabled:opacity-40 text-white font-bold py-2.5 px-8 rounded-lg text-sm">Next →</button></div>
                        </div>
                    )}

                    {/* STEP 2 — FLEET */}
                    {step === 2 && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">Add each vehicle you'd run for FBN.</p>
                            {vehicles.map((v, i) => (
                                <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-2"><span className="text-xs font-black text-[#13294b]">Vehicle {i + 1}</span>{vehicles.length > 1 && <button onClick={() => setVehicles(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 font-bold">Remove</button>}</div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div><label className={lbl}>Registration</label><input value={v.registration} onChange={e => setV(i, 'registration', e.target.value)} className={inp} /></div>
                                        <div><label className={lbl}>Type</label><select value={v.vehicleType} onChange={e => setV(i, 'vehicleType', e.target.value)} className={inp}>{VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                                        <div><label className={lbl}>Payload (t)</label><input type="number" value={v.payloadTonnes} onChange={e => setV(i, 'payloadTonnes', e.target.value)} className={inp} /></div>
                                        <div><label className={lbl}>Body length (m)</label><input type="number" value={v.bodyLengthM} onChange={e => setV(i, 'bodyLengthM', e.target.value)} className={inp} /></div>
                                        <div><label className={lbl}>MVL expiry</label><DateField value={v.mvlExpiry} onChange={val => setV(i, 'mvlExpiry', val)} className={inp} /></div>
                                        <div><label className={lbl}>Tracker provider</label><input value={v.trackerProvider} onChange={e => setV(i, 'trackerProvider', e.target.value)} className={inp} placeholder="if fitted" /></div>
                                        <div className="col-span-2 flex flex-wrap items-end gap-2 pb-0.5">
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><input type="checkbox" checked={v.hazmat} onChange={e => setV(i, 'hazmat', e.target.checked)} /> Hazmat</label>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><input type="checkbox" checked={v.abnormal} onChange={e => setV(i, 'abnormal', e.target.checked)} /> Abnormal</label>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><input type="checkbox" checked={v.trackerFitted} onChange={e => setV(i, 'trackerFitted', e.target.checked)} /> Tracker fitted</label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => setVehicles(p => [...p, blankVehicle()])} className="text-sm font-bold text-[#13294b] border border-dashed border-slate-300 rounded-lg py-2 w-full hover:bg-slate-50">＋ Add another vehicle</button>
                            <div className="flex justify-between mt-2"><button onClick={back} className="text-slate-600 font-bold py-2.5 px-6 rounded-lg text-sm hover:bg-slate-100">← Back</button><button onClick={next} className="bg-[#13294b] text-white font-bold py-2.5 px-8 rounded-lg text-sm">Next →</button></div>
                        </div>
                    )}

                    {/* STEP 3 — ROUTES */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div>
                                <label className={lbl}>Routes you run — pick a lane, then the load types you offer on it</label>
                                <div className="space-y-2 mt-1">
                                    {ROUTE_PAIRS.map(r => (
                                        <div key={r} className="border border-slate-200 rounded-lg p-2.5">
                                            <button onClick={() => toggleRoute(r)} className={chip(!!routes[r]) + ' mb-2'}>{r}</button>
                                            {routes[r] && <div className="flex flex-wrap gap-1.5">{LOAD_TYPES.map(lt => <button key={lt} onClick={() => toggleRouteLoad(r, lt)} className={chip(routes[r].includes(lt)) + ' !text-[11px] !py-1'}>{lt}</button>)}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Cross-border (select countries you operate into)</label>
                                <div className="flex flex-wrap gap-1.5">{COUNTRIES.map(c => <button key={c} onClick={() => toggleCountry(c)} className={chip(countries.includes(c))}>{c}</button>)}</div>
                            </div>
                            <div className="flex justify-between mt-2"><button onClick={back} className="text-slate-600 font-bold py-2.5 px-6 rounded-lg text-sm hover:bg-slate-100">← Back</button><button onClick={next} className="bg-[#13294b] text-white font-bold py-2.5 px-8 rounded-lg text-sm">Next →</button></div>
                        </div>
                    )}

                    {/* STEP 4 — CERTIFICATIONS */}
                    {step === 4 && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">Upload your compliance documents with their expiry dates. PDF or image.</p>
                            {CERTS.map(ct => (
                                <div key={ct.key} className="border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-[#13294b]">{ct.label}{ct.required && <span className="text-red-500"> *</span>}</div>
                                        {ct.note && <div className="text-[11px] text-slate-500">{ct.note}</div>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-36"><DateField value={docs[ct.key]?.expiry || ''} onChange={val => setDoc(ct.key, { expiry: val })} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs" /></div>
                                        <label className={`text-xs font-bold py-2 px-3 rounded-lg cursor-pointer ${docs[ct.key]?.file ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-[#13294b] text-white'}`}>
                                            {docs[ct.key]?.file ? '✓ ' + docs[ct.key].file!.name.slice(0, 18) : 'Upload'}
                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setDoc(ct.key, { file: e.target.files?.[0] || null })} />
                                        </label>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between mt-2"><button onClick={back} className="text-slate-600 font-bold py-2.5 px-6 rounded-lg text-sm hover:bg-slate-100">← Back</button><button onClick={next} disabled={!docs.GIT?.file} className="bg-[#13294b] disabled:opacity-40 text-white font-bold py-2.5 px-8 rounded-lg text-sm">Next →</button></div>
                        </div>
                    )}

                    {/* STEP 5 — AGREEMENT */}
                    {step === 5 && (
                        <div className="space-y-4">
                            <div>
                                <label className={lbl}>FBN Subcontractor Service Level Agreement</label>
                                <div className="border border-slate-200 rounded-xl p-4 max-h-72 overflow-y-auto text-[13px] text-slate-700 leading-relaxed bg-slate-50/50">
                                    <p className="mb-3">{SLA_INTRO}</p>
                                    <ol className="list-decimal pl-5 space-y-2">{SLA_CLAUSES.map((c, i) => <li key={i}><strong className="text-[#13294b]">{c.t}:</strong> {c.b}</li>)}</ol>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div><label className={lbl}>Full name *</label><input value={agree.fullName} onChange={e => setAgree(p => ({ ...p, fullName: e.target.value }))} className={inp} /></div>
                                <div><label className={lbl}>ID number</label><input value={agree.idNumber} onChange={e => setAgree(p => ({ ...p, idNumber: e.target.value }))} className={inp} /></div>
                                <div><label className={lbl}>Position at company</label><input value={agree.position} onChange={e => setAgree(p => ({ ...p, position: e.target.value }))} className={inp} /></div>
                            </div>
                            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={agree.accepted} onChange={e => setAgree(p => ({ ...p, accepted: e.target.checked }))} className="mt-0.5" />
                                <span>I am duly authorised to bind the company and I accept the FBN Transport Subcontractor Agreement above. I understand this electronic acceptance constitutes a valid signature under the ECT Act 25 of 2002.</span>
                            </label>
                            <div className="flex justify-between mt-2"><button onClick={back} className="text-slate-600 font-bold py-2.5 px-6 rounded-lg text-sm hover:bg-slate-100">← Back</button><button onClick={submit} disabled={busy || !agree.accepted || !agree.fullName.trim()} className="bg-emerald-600 disabled:opacity-40 text-white font-black py-2.5 px-8 rounded-lg text-sm">{busy ? 'Submitting…' : 'Accept & submit application'}</button></div>
                        </div>
                    )}
                </div>
                <p className="text-center text-[11px] text-slate-400 mt-4">FBN Transport CC · Reg 1989/001182/23 · Commercial Freight Specialists</p>
            </div>
        </div>
    );
};

export default SupplierRegister;
