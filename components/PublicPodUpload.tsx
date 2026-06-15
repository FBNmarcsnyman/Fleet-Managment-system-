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

// Public, no-login POD upload reached from the link in our POD-request email
// (?pod=<loadId>). Works on a phone — snap or pick the signed POD and send it.
const PublicPodUpload: React.FC<{ loadId: string }> = ({ loadId }) => {
    const [load, setLoad] = useState<LoadSummary | null>(null);
    const [loadingErr, setLoadingErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.functions.invoke('submit-pod', { body: { loadId } });
            if (error || (data as any)?.error) { setLoadingErr((data as any)?.error || error?.message || 'Could not load this delivery.'); return; }
            setLoad(data as LoadSummary);
        })();
    }, [loadId]);

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true); setErr(null);
        try {
            const base64 = await new Promise<string>((res, rej) => {
                const fr = new FileReader();
                fr.onload = () => res((fr.result as string).split(',')[1] || '');
                fr.onerror = () => rej(new Error('Could not read the file.'));
                fr.readAsDataURL(file);
            });
            const { data, error } = await supabase.functions.invoke('submit-pod', {
                body: { loadId, fileBase64: base64, fileName: file.name, contentType: file.type },
            });
            if (error || (data as any)?.error) { setErr((data as any)?.error || error?.message || 'Upload failed.'); return; }
            setDone(true);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Upload failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ background: NAVY, padding: '18px 20px' }}>
                    <img src="/fbn-logo.jpg" alt="FBN Transport" style={{ height: 40, display: 'block', background: '#fff', borderRadius: 4, padding: 3 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ color: YELLOW, fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>Proof of Delivery Upload</div>
                </div>
                <div style={{ height: 4, background: YELLOW }} />
                <div style={{ padding: 22 }}>
                    {loadingErr ? (
                        <p style={{ color: '#b91c1c' }}>{loadingErr}</p>
                    ) : !load ? (
                        <p style={{ color: '#6b7280' }}>Loading…</p>
                    ) : done ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: 44 }}>✅</div>
                            <h2 style={{ color: NAVY, margin: '8px 0' }}>POD received</h2>
                            <p style={{ color: '#4b5563' }}>Thank you. The POD for load <strong>{load.load_con_number}</strong> has been sent to FBN Transport.</p>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ color: NAVY, margin: '0 0 4px', fontSize: 20 }}>Load {load.load_con_number}</h2>
                            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 16px' }}>
                                {load.collection_point} → {load.delivery_point}
                            </p>
                            {load.pod_photo_url && (
                                <p style={{ background: '#ecfdf5', color: '#047857', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>A POD has already been uploaded — you can replace it below if needed.</p>
                            )}
                            <p style={{ color: '#374151', fontSize: 14, marginBottom: 16 }}>Please attach a clear photo or PDF of the <strong>signed POD</strong> for this delivery.</p>
                            {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
                            <button onClick={() => fileRef.current?.click()} disabled={busy}
                                style={{ width: '100%', background: busy ? '#9ca3af' : NAVY, color: '#fff', border: 'none', padding: '16px', borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                                {busy ? 'Uploading…' : '📷 Take photo / choose POD'}
                            </button>
                            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} onChange={onFile} />
                            <p style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 14 }}>FBN Transport · Commercial Freight Specialists</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicPodUpload;
