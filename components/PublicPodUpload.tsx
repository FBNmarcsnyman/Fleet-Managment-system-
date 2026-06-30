import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const NAVY = '#13294b';
const YELLOW = '#f5b700';

interface LoadSummary {
    load_con_number: string;
    collection_point?: string;
    delivery_point?: string;
    subcontractor_name?: string;
    status?: string;
    pod_photo_url?: string;
}

// Public, no-login POD page reached from the link in our POD-request email
// (?pod=<loadId>). Driver snaps/chooses the signed POD, signs on screen, sends.
const PublicPodUpload: React.FC<{ loadId: string }> = ({ loadId }) => {
    const [load, setLoad] = useState<LoadSummary | null>(null);
    const [loadingErr, setLoadingErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [file, setFile] = useState<{ b64: string; name: string; type: string; preview: string } | null>(null);
    const [damages, setDamages] = useState<{ b64: string; name: string; type: string }[]>([]);
    const [docs, setDocs] = useState<{ b64: string; name: string; type: string }[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const dmgRef = useRef<HTMLInputElement>(null);
    const docRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const signed = useRef(false);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.functions.invoke('submit-pod', { body: { loadId } });
            if (error || (data as any)?.error) { setLoadingErr((data as any)?.error || error?.message || 'Could not load this delivery.'); return; }
            setLoad(data as LoadSummary);
        })();
    }, [loadId]);

    // --- signature canvas ---
    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const c = canvasRef.current!; const r = c.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
    };
    const start = (e: React.PointerEvent<HTMLCanvasElement>) => { drawing.current = true; const ctx = canvasRef.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = canvasRef.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#111'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke(); signed.current = true; };
    const end = () => { drawing.current = false; };
    const clearSig = () => { const c = canvasRef.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); signed.current = false; };

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        const fr = new FileReader();
        fr.onload = () => { const d = fr.result as string; setFile({ b64: d.split(',')[1] || '', name: f.name, type: f.type, preview: d }); };
        fr.readAsDataURL(f);
    };

    // Multi-file picker → append each to the given list (damages / docs).
    const onMulti = (setter: React.Dispatch<React.SetStateAction<{ b64: string; name: string; type: string }[]>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const fs = Array.from(e.target.files || []); e.target.value = '';
        fs.forEach(f => { const fr = new FileReader(); fr.onload = () => { const d = fr.result as string; setter(prev => [...prev, { b64: d.split(',')[1] || '', name: f.name, type: f.type }]); }; fr.readAsDataURL(f); });
    };

    const submit = async () => {
        if (!file) { setErr('Please attach a photo of the signed POD first.'); return; }
        setBusy(true); setErr(null);
        try {
            const signatureBase64 = signed.current && canvasRef.current ? (canvasRef.current.toDataURL('image/png').split(',')[1] || '') : '';
            const { data, error } = await supabase.functions.invoke('submit-pod', {
                body: {
                    loadId, fileBase64: file.b64, fileName: file.name, contentType: file.type, signatureBase64,
                    damages: damages.map(d => ({ base64: d.b64, name: d.name, contentType: d.type })),
                    docs: docs.map(d => ({ base64: d.b64, name: d.name, contentType: d.type })),
                },
            });
            if (error || (data as any)?.error) { setErr((data as any)?.error || error?.message || 'Upload failed.'); return; }
            setDone(true);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Upload failed.');
        } finally { setBusy(false); }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, overflow: 'hidden', marginTop: 20 }}>
                <div style={{ background: NAVY, padding: '18px 20px' }}>
                    <img src="/fbn-logo.jpg" alt="FBN Transport" style={{ height: 40, background: '#fff', borderRadius: 4, padding: 3 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ color: YELLOW, fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>Proof of Delivery</div>
                </div>
                <div style={{ height: 4, background: YELLOW }} />
                <div style={{ padding: 22 }}>
                    {loadingErr ? <p style={{ color: '#b91c1c' }}>{loadingErr}</p> : !load ? <p style={{ color: '#6b7280' }}>Loading…</p> : done ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: 44 }}>✓</div>
                            <h2 style={{ color: NAVY, margin: '8px 0' }}>POD received</h2>
                            <p style={{ color: '#4b5563' }}>Thank you. The POD for load <strong>{load.load_con_number}</strong> has been sent to FBN Transport.</p>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ color: NAVY, margin: '0 0 4px', fontSize: 20 }}>Load {load.load_con_number}</h2>
                            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 12px' }}>{load.collection_point} → {load.delivery_point}</p>
                            <div style={{ background: '#fffbeb', border: '1px solid #f5b700', borderRadius: 8, padding: '10px 12px', margin: '0 0 16px' }}>
                                <p style={{ color: '#13294b', fontSize: 13, fontWeight: 800, margin: 0 }}>Please upload ONLY your signed delivery note / FBN POD / client backing documents.</p>
                                <p style={{ color: '#b91c1c', fontSize: 14, fontWeight: 800, margin: '6px 0 0' }}>⚠ DO NOT UPLOAD YOUR INVOICE HERE.</p>
                            </div>
                            {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}

                            <p style={{ color: '#374151', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>1. Attach the signed POD</p>
                            <button onClick={() => fileRef.current?.click()} style={{ width: '100%', background: file ? '#e2e8f0' : NAVY, color: file ? '#1e293b' : '#fff', border: 'none', padding: 14, borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                                {file ? 'Change photo' : 'Take photo / choose POD'}
                            </button>
                            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={onFile} />
                            {file && file.type.startsWith('image') && <img src={file.preview} alt="POD" style={{ width: '100%', borderRadius: 8, marginTop: 10, maxHeight: 180, objectFit: 'cover' }} />}

                            <p style={{ color: '#374151', fontSize: 13, fontWeight: 700, margin: '18px 0 6px' }}>2. Sign below (optional)</p>
                            <canvas ref={canvasRef} width={420} height={140}
                                onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
                                style={{ width: '100%', height: 120, border: '1px dashed #cbd5e1', borderRadius: 8, touchAction: 'none', background: '#fff' }} />
                            <button onClick={clearSig} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, marginTop: 4, cursor: 'pointer' }}>Clear signature</button>

                            <p style={{ color: '#374151', fontSize: 13, fontWeight: 700, margin: '18px 0 6px' }}>3. Damage photos (if any)</p>
                            <button onClick={() => dmgRef.current?.click()} style={{ width: '100%', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                {damages.length ? `${damages.length} damage photo(s) added — add more` : 'Add damage photos'}
                            </button>
                            <input ref={dmgRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={onMulti(setDamages)} />

                            <p style={{ color: '#374151', fontSize: 13, fontWeight: 700, margin: '18px 0 6px' }}>4. Client backing documents (optional) <span style={{ color: '#b91c1c', fontWeight: 800 }}>— no invoices</span></p>
                            <button onClick={() => docRef.current?.click()} style={{ width: '100%', background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                {docs.length ? `${docs.length} document(s) added — add more` : 'Add client backing documents'}
                            </button>
                            <input ref={docRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={onMulti(setDocs)} />

                            <button onClick={submit} disabled={busy} style={{ width: '100%', background: busy ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 16 }}>
                                {busy ? 'Sending…' : 'Send POD to FBN'}
                            </button>
                            <p style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 14 }}>FBN Transport · Commercial Freight Specialists</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicPodUpload;
