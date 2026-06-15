import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const NAVY = '#13294b';
const YELLOW = '#f5b700';

interface Summary {
    load_con_number: string;
    status: string;
    collection_point?: string;
    delivery_point?: string;
    collection_date?: string;
    delivery_date?: string;
    eta?: string;
    subcontractor_name?: string;
    vehicle_reg?: string;
    driver_name?: string;
    has_pod?: boolean;
    accepted_at?: string;
    client_name?: string;
}

// Public client-facing stages (no internal jargon).
const STAGES = ['Booked', 'Collecting', 'In Transit', 'Out for Delivery', 'Delivered'];
const stageIndex = (status: string): number => {
    if (['Booked', 'Driver Assigned'].includes(status)) return 0;
    if (['At Collection Point', 'Loading', 'Collected', 'At Collection Depot'].includes(status)) return 1;
    if (['In Transit'].includes(status)) return 2;
    if (['At Destination Depot', 'Unloaded', 'Out for Delivery'].includes(status)) return 3;
    if (['Delivered', 'POD Submitted', 'Invoiced'].includes(status)) return 4;
    return 0;
};
const fmt = (d?: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };

const PublicLoad: React.FC<{ loadId: string; mode: 'track' | 'accept' }> = ({ loadId, mode }) => {
    const [load, setLoad] = useState<Summary | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const driverName = useRef<HTMLInputElement>(null);
    const vehicleReg = useRef<HTMLInputElement>(null);
    const driverCell = useRef<HTMLInputElement>(null);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.functions.invoke('load-public', { body: { loadId, action: 'track' } });
            if (error || (data as any)?.error) { setErr((data as any)?.error || error?.message || 'Could not load this.'); return; }
            setLoad(data as Summary);
        })();
    }, [loadId]);

    const submitAccept = async () => {
        setBusy(true); setErr(null);
        const { data, error } = await supabase.functions.invoke('load-public', {
            body: { loadId, action: 'accept', driverName: driverName.current?.value, vehicleReg: vehicleReg.current?.value, driverCell: driverCell.current?.value },
        });
        setBusy(false);
        if (error || (data as any)?.error) { setErr((data as any)?.error || error?.message || 'Could not submit.'); return; }
        setDone(true);
    };

    const idx = load ? stageIndex(load.status) : 0;

    return (
        <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, overflow: 'hidden', marginTop: 24 }}>
                <div style={{ background: NAVY, padding: '16px 20px' }}>
                    <img src="/fbn-logo.jpg" alt="FBN Transport" style={{ height: 38, background: '#fff', borderRadius: 4, padding: 3 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ color: YELLOW, fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>{mode === 'accept' ? 'Load Acceptance' : 'Shipment Tracking'}</div>
                </div>
                <div style={{ height: 4, background: YELLOW }} />
                <div style={{ padding: 22 }}>
                    {err && !load ? <p style={{ color: '#b91c1c' }}>{err}</p> : !load ? <p style={{ color: '#6b7280' }}>Loading…</p> : (
                        <>
                            <h2 style={{ color: NAVY, margin: '0 0 2px', fontSize: 20 }}>Load {load.load_con_number}</h2>
                            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 18px' }}>{load.collection_point} → {load.delivery_point}</p>

                            {mode === 'track' && (
                                <>
                                    <div style={{ marginBottom: 18 }}>
                                        {STAGES.map((s, i) => (
                                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: i <= idx ? '#16a34a' : '#e5e7eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{i <= idx ? '✓' : i + 1}</div>
                                                <span style={{ color: i === idx ? NAVY : i < idx ? '#16a34a' : '#9ca3af', fontWeight: i === idx ? 800 : 600, fontSize: 14 }}>{s}{i === idx ? '  ← current' : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ background: '#f3f4f6', borderRadius: 8, padding: 12, fontSize: 13, color: '#374151' }}>
                                        {load.collection_date && <div>Collection: <strong>{fmt(load.collection_date)}</strong></div>}
                                        {load.delivery_date && <div>Delivery (planned): <strong>{fmt(load.delivery_date)}</strong></div>}
                                        {load.vehicle_reg && <div>Vehicle: <strong>{load.vehicle_reg}</strong></div>}
                                        {load.has_pod && <div style={{ color: '#16a34a', fontWeight: 700, marginTop: 4 }}>POD received ✓</div>}
                                    </div>
                                    <p style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 16 }}>FBN Transport · Commercial Freight Specialists</p>
                                </>
                            )}

                            {mode === 'accept' && (done || load.accepted_at ? (
                                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                                    <div style={{ fontSize: 42 }}>✅</div>
                                    <h3 style={{ color: NAVY }}>Load accepted</h3>
                                    <p style={{ color: '#4b5563' }}>Thank you. FBN Transport has your acceptance and driver details for load {load.load_con_number}.</p>
                                </div>
                            ) : (
                                <>
                                    <p style={{ color: '#374151', fontSize: 14, marginBottom: 14 }}>Please confirm you accept this load and enter the driver &amp; vehicle details.</p>
                                    {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}
                                    <label style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>Driver name</label>
                                    <input ref={driverName} style={inp} placeholder="Driver full name" />
                                    <label style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>Vehicle registration</label>
                                    <input ref={vehicleReg} style={inp} placeholder="e.g. ND 123-456" />
                                    <label style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>Driver cell</label>
                                    <input ref={driverCell} style={inp} placeholder="082..." />
                                    <button onClick={submitAccept} disabled={busy} style={{ width: '100%', background: busy ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', padding: 14, borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 8 }}>
                                        {busy ? 'Submitting…' : 'Accept load'}
                                    </button>
                                </>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const inp: React.CSSProperties = { width: '100%', padding: 11, margin: '4px 0 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' };

export default PublicLoad;
