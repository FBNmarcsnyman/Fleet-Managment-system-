import React, { useEffect, useRef, useState } from 'react';

const NAVY = '#13294b';
const YELLOW = '#f5b700';
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cargo-details`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const call = async (body: Record<string, unknown>): Promise<any> => {
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.error) throw new Error(d?.error || `${r.status}`);
    return d;
};

// Public, no-login page (?complete=<id>) reached from the depot-arrival email.
// Ops fill in the MISSING cargo details + confirm condition + upload damage photos.
const CompleteCargoDetails: React.FC<{ loadId: string }> = ({ loadId }) => {
    const [load, setLoad] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);

    const [waybillNo, setWaybillNo] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [dimensions, setDimensions] = useState('');
    const [cubeM3, setCubeM3] = useState('');
    const [rate, setRate] = useState('');
    const [condition, setCondition] = useState<'ok' | 'damaged'>('ok');
    const [damageNotes, setDamageNotes] = useState('');
    const [byName, setByName] = useState('');
    const [photos, setPhotos] = useState<{ url: string }[]>([]);
    const photoRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        (async () => {
            try {
                const { load } = await call({ loadId, action: 'get' });
                setLoad(load);
                if (load.load_ref_no && String(load.load_ref_no).toUpperCase() !== 'TBA') setWaybillNo(load.load_ref_no);
                if (load.weight_kg) setWeightKg(String(load.weight_kg));
                if (load.dimensions) setDimensions(load.dimensions);
                if (load.cube_m3) setCubeM3(String(load.cube_m3));
                if (load.total_amount && Number(load.total_amount) > 0) setRate(String(load.total_amount));
            } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load.'); }
        })();
    }, [loadId]);

    const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fs = Array.from(e.target.files || []); e.target.value = '';
        fs.forEach(f => { const r = new FileReader(); r.onload = () => setPhotos(p => [...p, { url: r.result as string }]); r.readAsDataURL(f); });
    };

    const submit = async () => {
        setBusy(true); setErr(null);
        try {
            await call({ loadId, action: 'save', waybillNo, weightKg, dimensions, cubeM3, rate, condition, damageNotes, byName, photos });
            setDone(true);
        } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
        finally { setBusy(false); }
    };

    const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 };
    const inp: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box', marginBottom: 14 };

    return (
        <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', justifyContent: 'center', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, overflow: 'hidden', marginTop: 18, height: 'fit-content' }}>
                <div style={{ background: NAVY, padding: '18px 22px' }}>
                    <img src="/fbn-logo.jpg" alt="FBN Transport" style={{ height: 38, background: '#fff', borderRadius: 4, padding: 3 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ color: YELLOW, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>Complete Cargo Details</div>
                </div>
                <div style={{ height: 4, background: YELLOW }} />
                <div style={{ padding: 22 }}>
                    {err && !load ? <p style={{ color: '#b91c1c' }}>{err}</p> : !load ? <p style={{ color: '#6b7280' }}>Loading…</p> : done ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: 44 }}>✅</div>
                            <h2 style={{ color: NAVY, margin: '8px 0' }}>Saved</h2>
                            <p style={{ color: '#4b5563' }}>Thank you. The cargo details for <strong>{load.load_con_number}</strong> have been updated{condition === 'damaged' ? ' and the damage has been logged' : ''}.</p>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ color: NAVY, margin: '0 0 2px', fontSize: 19 }}>Load {load.load_con_number}</h2>
                            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 16px' }}>{load.client_name || ''} · arrived at the {load.arranging_branch || ''} depot. Please confirm / add the details below.</p>
                            {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}

                            <label style={lbl}>Waybill / DI number</label>
                            <input value={waybillNo} onChange={e => setWaybillNo(e.target.value)} style={inp} placeholder="waybill / DI no." />
                            <label style={lbl}>Weight (kg)</label>
                            <input type="number" inputMode="decimal" value={weightKg} onChange={e => setWeightKg(e.target.value)} style={inp} placeholder="e.g. 16000" />
                            <label style={lbl}>Dimensions (L×W×H)</label>
                            <input value={dimensions} onChange={e => setDimensions(e.target.value)} style={inp} placeholder="e.g. 1.2 x 1.0 x 1.5 m" />
                            <label style={lbl}>Cube (m³)</label>
                            <input type="number" inputMode="decimal" value={cubeM3} onChange={e => setCubeM3(e.target.value)} style={inp} placeholder="e.g. 28" />
                            <label style={lbl}>Rate (R)</label>
                            <input type="number" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} style={inp} placeholder="client rate" />

                            <label style={lbl}>Condition of cargo</label>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                <button onClick={() => setCondition('ok')} style={{ flex: 1, padding: 12, borderRadius: 8, border: condition === 'ok' ? '2px solid #16a34a' : '1px solid #cbd5e1', background: condition === 'ok' ? '#f0fdf4' : '#fff', fontWeight: 800, color: condition === 'ok' ? '#16a34a' : '#475569', cursor: 'pointer' }}>✓ All in good order</button>
                                <button onClick={() => setCondition('damaged')} style={{ flex: 1, padding: 12, borderRadius: 8, border: condition === 'damaged' ? '2px solid #dc2626' : '1px solid #cbd5e1', background: condition === 'damaged' ? '#fef2f2' : '#fff', fontWeight: 800, color: condition === 'damaged' ? '#dc2626' : '#475569', cursor: 'pointer' }}>⚠ Damages</button>
                            </div>
                            {condition === 'damaged' && (
                                <>
                                    <label style={lbl}>Damage notes</label>
                                    <textarea value={damageNotes} onChange={e => setDamageNotes(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="describe the damage…" />
                                </>
                            )}
                            <label style={lbl}>Photos {condition === 'damaged' && <span style={{ color: '#dc2626' }}>— please attach damage photos</span>}</label>
                            <button onClick={() => photoRef.current?.click()} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, color: NAVY, cursor: 'pointer' }}>📷 {photos.length ? `${photos.length} photo(s) — add more` : 'Take / add photos'}</button>
                            <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={addPhotos} />
                            {photos.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{photos.map((p, i) => <img key={i} src={p.url} alt="" style={{ height: 60, width: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />)}</div>}
                            <p style={{ color: '#94a3b8', fontSize: 11, margin: '8px 0 14px' }}>Photos &amp; damage notes are stored on the FBN system — not sent to the client unless FBN chooses to.</p>

                            <label style={lbl}>Your name (optional)</label>
                            <input value={byName} onChange={e => setByName(e.target.value)} style={inp} placeholder="who completed this" />

                            <button onClick={submit} disabled={busy} style={{ width: '100%', background: busy ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>{busy ? 'Saving…' : 'Save cargo details'}</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompleteCargoDetails;
