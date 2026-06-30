import React, { useEffect, useState } from 'react';

// Public, no-login Driver Hub (/driver). One easy mobile page per driver: pick your
// vehicle once (remembered), then do an inspection, report a breakdown, report an
// incident, or see your recent logs. All no-login; keyed by the chosen vehicle.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const post = async (fn: string, body: any) => (await fetch(`${BASE}/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) })).json();
const inp = 'w-full border border-slate-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const lbl = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1';
const INCIDENT_TYPES = ['Accident / collision', 'Theft or break-in', 'Traffic fine', 'Vehicle damage', 'Third-party damage', 'Other'];
const VK = 'fbn-driver-vehicle', DK = 'fbn-driver-name', CK = 'fbn-driver-contact';

const compress = (file: File): Promise<string> => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => { const img = new Image(); img.onload = () => { const max = 1600; let { width, height } = img; if (width > max || height > max) { const s = max / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); } const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d')!.drawImage(img, 0, 0, width, height); resolve(c.toDataURL('image/jpeg', 0.7)); }; img.onerror = () => resolve(reader.result as string); img.src = reader.result as string; };
    reader.readAsDataURL(file);
});

type Vehicle = { id: string; name: string; registration: string; depot: string };

const DriverHub: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [search, setSearch] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverContact, setDriverContact] = useState('');
    const [view, setView] = useState<'home' | 'incident' | 'logs'>('home');
    const [logs, setLogs] = useState<any>(null);
    const [loadingLogs, setLoadingLogs] = useState(false);
    // Incident form
    const [inc, setInc] = useState({ incidentType: INCIDENT_TYPES[0], description: '', location: '', thirdParty: false, date: new Date().toISOString().slice(0, 10) });
    const [photos, setPhotos] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const d = await post('driver-hub', { op: 'meta' });
            if (d?.ok) setVehicles(d.vehicles || []);
            try {
                const v = localStorage.getItem(VK); if (v) setVehicle(JSON.parse(v));
                setDriverName(localStorage.getItem(DK) || ''); setDriverContact(localStorage.getItem(CK) || '');
            } catch { /* */ }
        })();
    }, []);

    const choose = (v: Vehicle) => { setVehicle(v); try { localStorage.setItem(VK, JSON.stringify(v)); } catch { /* */ } };
    const saveDriver = () => { try { localStorage.setItem(DK, driverName); localStorage.setItem(CK, driverContact); } catch { /* */ } };

    const openLogs = async () => {
        if (!vehicle) return; setView('logs'); setLoadingLogs(true);
        const d = await post('driver-hub', { op: 'logs', vehicleId: vehicle.id });
        setLogs(d?.ok ? d : { inspections: [], breakdowns: [], incidents: [] }); setLoadingLogs(false);
    };
    const addPhoto = async (file?: File) => { if (!file) return; const b64 = await compress(file); const up = await post('inspection-upload', { base64: b64, vehicleId: vehicle?.id, contentType: 'image/jpeg' }); if (up?.path) setPhotos(p => [...p, up.path]); };
    const submitIncident = async () => {
        if (!vehicle || !inc.description.trim()) return;
        setSubmitting(true); saveDriver();
        const res = await post('driver-hub', { op: 'incident', vehicleId: vehicle.id, vehicleReg: vehicle.registration, driverName, driverContact, ...inc, photos });
        setSubmitting(false);
        if (res?.ok) { setDone(res.reference || 'logged'); setInc({ incidentType: INCIDENT_TYPES[0], description: '', location: '', thirdParty: false, date: new Date().toISOString().slice(0, 10) }); setPhotos([]); }
    };
    const useGps = () => navigator.geolocation?.getCurrentPosition(p => setInc(s => ({ ...s, location: `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}` })), () => alert('Could not get location.'));

    const filtered = vehicles.filter(v => `${v.name} ${v.registration}`.toLowerCase().includes(search.toLowerCase())).slice(0, 40);

    // --- Vehicle picker ---
    if (!vehicle) return (
        <div className="min-h-screen bg-slate-100">
            <div className="bg-[#13294b] text-white px-4 py-4"><div className="max-w-xl mx-auto"><div className="font-black text-lg">FBN Driver Hub</div><div className="text-[12px] text-slate-300">Pick your vehicle to start</div></div></div>
            <div className="max-w-xl mx-auto p-4 space-y-3">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registration or name…" className={inp} autoFocus />
                <div className="space-y-2">
                    {filtered.map(v => (
                        <button key={v.id} onClick={() => choose(v)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:bg-slate-50">
                            <div className="font-black text-[#13294b]">{v.registration || v.name}</div>
                            <div className="text-sm text-slate-500">{v.name}{v.depot ? ` · ${v.depot}` : ''}</div>
                        </button>
                    ))}
                    {vehicles.length === 0 && <p className="text-center text-slate-400 py-8">Loading vehicles…</p>}
                </div>
            </div>
        </div>
    );

    const Header = (sub: string) => (
        <div className="bg-[#13294b] text-white px-4 py-3 sticky top-0 z-10">
            <div className="max-w-xl mx-auto flex items-center justify-between">
                <div><div className="font-black">{vehicle.registration || vehicle.name}</div><div className="text-[11px] text-slate-300">{sub}</div></div>
                <button onClick={() => { setVehicle(null); try { localStorage.removeItem(VK); } catch { /* */ } }} className="text-[11px] underline text-slate-300">change</button>
            </div>
        </div>
    );

    // --- Incident form ---
    if (view === 'incident') return (
        <div className="min-h-screen bg-slate-100">
            {Header('Report an incident')}
            <div className="max-w-xl mx-auto p-4 pb-28 space-y-4">
                {done ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                        <div className="text-5xl mb-2">✓</div>
                        <h2 className="text-xl font-black text-[#13294b]">Incident reported</h2>
                        <p className="text-slate-600 mt-1">Ref <strong>{done}</strong> — management has been notified.</p>
                        <button onClick={() => { setDone(null); setView('home'); }} className="mt-4 bg-[#13294b] text-white font-bold py-2.5 px-5 rounded-lg">Back to hub</button>
                    </div>
                ) : (
                    <>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                            <div><label className={lbl}>Your name</label><input value={driverName} onChange={e => setDriverName(e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Your contact number</label><input value={driverContact} onChange={e => setDriverContact(e.target.value)} className={inp} inputMode="tel" /></div>
                            <div><label className={lbl}>What happened?</label><select value={inc.incidentType} onChange={e => setInc({ ...inc, incidentType: e.target.value })} className={inp}>{INCIDENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                            <div><label className={lbl}>Describe it</label><textarea value={inc.description} onChange={e => setInc({ ...inc, description: e.target.value })} rows={4} className={inp} style={{ textTransform: 'none' }} placeholder="What happened, where, who was involved…" /></div>
                            <div><label className={lbl}>Location</label><div className="flex gap-2"><input value={inc.location} onChange={e => setInc({ ...inc, location: e.target.value })} className={inp} placeholder="Where did it happen?" /><button type="button" onClick={useGps} className="shrink-0 px-3 rounded-lg bg-slate-100 border border-slate-300 text-sm font-bold">GPS</button></div></div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={inc.thirdParty} onChange={e => setInc({ ...inc, thirdParty: e.target.checked })} className="w-5 h-5" /> Another vehicle / third party involved</label>
                            <div>
                                <label className={lbl}>Photos</label>
                                <div className="flex flex-wrap gap-2">
                                    {photos.map((_, i) => <div key={i} className="h-16 w-16 rounded-lg bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-700 font-bold text-xs">✓ {i + 1}</div>)}
                                    <label className="h-16 w-16 rounded-lg border border-dashed border-slate-300 flex items-center justify-center cursor-pointer text-slate-500 text-2xl">+<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => addPhoto(e.target.files?.[0])} /></label>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setView('home')} className="px-5 py-4 rounded-xl bg-white border border-slate-300 font-bold">Back</button>
                            <button onClick={submitIncident} disabled={!inc.description.trim() || submitting} className="flex-1 bg-red-600 disabled:opacity-40 text-white font-black py-4 rounded-xl">{submitting ? 'Sending…' : 'Report incident'}</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    // --- Logs ---
    if (view === 'logs') return (
        <div className="min-h-screen bg-slate-100">
            {Header('My recent logs')}
            <div className="max-w-xl mx-auto p-4 pb-28 space-y-5">
                {loadingLogs ? <p className="text-center text-slate-400 py-8">Loading…</p> : (
                    <>
                        <LogSection title="Inspections" empty="No inspections yet." rows={(logs?.inspections || []).map((r: any) => ({ a: r.reference || r.date?.slice(0, 10), b: new Date(r.submitted_at || r.date).toLocaleDateString('en-ZA'), c: r.result, tone: r.result === 'Grounded' ? 'red' : r.result === 'Roadworthy' ? 'green' : 'amber' }))} />
                        <LogSection title="Breakdowns" empty="No breakdowns logged." rows={(logs?.breakdowns || []).map((r: any) => ({ a: r.reference, b: new Date(r.created_at).toLocaleDateString('en-ZA'), c: r.status, tone: r.status === 'Resolved' ? 'green' : 'amber' }))} />
                        <LogSection title="Incidents" empty="No incidents logged." rows={(logs?.incidents || []).map((r: any) => ({ a: r.incident_type, b: new Date(r.date).toLocaleDateString('en-ZA'), c: r.status, tone: r.status === 'Closed' ? 'green' : 'amber' }))} />
                    </>
                )}
                <button onClick={() => setView('home')} className="w-full bg-white border border-slate-300 font-bold py-3 rounded-xl">Back to hub</button>
            </div>
        </div>
    );

    // --- Home (tiles) ---
    const Tile = (emoji: string, title: string, desc: string, onClick: () => void, tone: string) => (
        <button onClick={onClick} className={`w-full text-left rounded-2xl p-5 border ${tone}`}>
            <div className="text-3xl mb-1">{emoji}</div>
            <div className="font-black text-lg text-[#13294b]">{title}</div>
            <div className="text-sm text-slate-500">{desc}</div>
        </button>
    );
    return (
        <div className="min-h-screen bg-slate-100">
            {Header(`${vehicle.name}${vehicle.depot ? ` · ${vehicle.depot}` : ''}`)}
            <div className="max-w-xl mx-auto p-4 space-y-3">
                {Tile('', 'Vehicle inspection', 'Do your daily / pre-trip checklist', () => { window.location.href = `/?checklist=${vehicle.id}`; }, 'bg-white border-slate-200')}
                {Tile('', 'Report a breakdown', 'Roadside tyre change / breakdown', () => { window.location.href = '/breakdown/tyre'; }, 'bg-white border-slate-200')}
                {Tile('⚠️', 'Report an incident', 'Accident, theft, fine or damage', () => { setDone(null); setView('incident'); }, 'bg-white border-slate-200')}
                {Tile('', 'My logs', 'See your recent inspections, breakdowns & incidents', openLogs, 'bg-white border-slate-200')}
            </div>
        </div>
    );
};

const LogSection: React.FC<{ title: string; empty: string; rows: { a: string; b: string; c: string; tone: string }[] }> = ({ title, empty, rows }) => {
    const tone = (t: string) => t === 'green' ? 'bg-emerald-100 text-emerald-700' : t === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
    return (
        <div>
            <h3 className="text-xs font-black text-[#13294b] uppercase tracking-widest mb-1">{title}</h3>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {rows.length === 0 ? <p className="text-sm text-slate-400 p-3">{empty}</p> : rows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3">
                        <div><div className="font-bold text-slate-800 text-sm">{r.a}</div><div className="text-[11px] text-slate-400">{r.b}</div></div>
                        {r.c && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tone(r.tone)}`}>{r.c}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DriverHub;
