import React, { useEffect, useRef, useState } from 'react';

const NAVY = '#13294b';
const YELLOW = '#f5b700';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/load-public`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Call the public edge function with a plain fetch (NOT supabase.functions.invoke):
// the supabase-js client can wedge on its own session handling and leave the page
// stuck on "Submitting…", even though the function itself returns 200. A direct
// fetch can't be held up by that, and we bound it with a timeout to be safe.
const callPublic = async (body: Record<string, unknown>): Promise<any> => {
    const resp = await Promise.race<Response>([
        fetch(FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
            body: JSON.stringify(body),
        }),
        new Promise<Response>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
    ]);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || data?.error) throw new Error(data?.error || `${resp.status}`);
    return data;
};

interface Summary {
    load_con_number: string;
    status: string;
    collection_point?: string;
    delivery_point?: string;
    collection_date?: string;
    delivery_date?: string;
    eta?: string;
    loading_eta?: string;
    delivery_eta?: string;
    subcontractor_name?: string;
    vehicle_reg?: string;
    driver_name?: string;
    has_pod?: boolean;
    accepted_at?: string;
    client_name?: string;
    request_status?: string;
    request_reply?: string;
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
// ETA is a datetime — show date + time, e.g. "18 Jun 2026, 08:00".
const fmtDT = (d?: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

// Supplier portal: the next action(s) they can push, by current internal status.
const NEXT_ACTION = (status: string): { to: string; label: string; askEta?: boolean } | null => {
    if (['Booked', 'Driver Assigned', 'At Collection Point', 'Loading'].includes(status)) return { to: 'Collected', label: 'Mark as Loaded / Collected' };
    if (['Collected', 'At Collection Depot'].includes(status)) return { to: 'In Transit', label: 'Mark On Route to delivery', askEta: true };
    if (status === 'In Transit') return { to: 'Out for Delivery', label: 'Mark Arrived at delivery' };
    if (['Out for Delivery', 'At Destination Depot', 'Unloaded'].includes(status)) return { to: 'Delivered', label: 'Mark Delivered / Offloaded' };
    return null;
};

const PublicLoad: React.FC<{ loadId: string; mode: 'track' | 'accept' | 'update' }> = ({ loadId, mode }) => {
    const [load, setLoad] = useState<Summary | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const driverName = useRef<HTMLInputElement>(null);
    const vehicleReg = useRef<HTMLInputElement>(null);
    const driverCell = useRef<HTMLInputElement>(null);
    const loadingEta = useRef<HTMLInputElement>(null);
    const [reqMsg, setReqMsg] = useState('');
    const [reqBusy, setReqBusy] = useState(false);
    const [reqSent, setReqSent] = useState(false);

    const [statusBusy, setStatusBusy] = useState(false);
    const [delEta, setDelEta] = useState('');
    const submitStatus = async (to: string, askEta: boolean) => {
        setStatusBusy(true); setErr(null);
        try {
            await callPublic({ loadId, action: 'status', to, deliveryEta: askEta ? delEta : undefined });
            setLoad(await callPublic({ loadId, action: 'track' }) as Summary);  // refresh to next step
        } catch (e) { setErr(e instanceof Error ? e.message : 'Could not update. Please try again.'); }
        finally { setStatusBusy(false); }
    };

    const submitRequest = async () => {
        const message = reqMsg.trim();
        if (!message) return;
        setReqBusy(true);
        try { await callPublic({ loadId, action: 'request', message }); setReqSent(true); setReqMsg(''); }
        catch (e) { setErr(e instanceof Error ? e.message : 'Could not send your request.'); }
        finally { setReqBusy(false); }
    };

    useEffect(() => {
        (async () => {
            try { setLoad(await callPublic({ loadId, action: 'track' }) as Summary); }
            catch (e) { setErr(e instanceof Error ? e.message : 'Could not load this.'); }
        })();
    }, [loadId]);

    const submitAccept = async () => {
        setBusy(true); setErr(null);
        try {
            await callPublic({
                loadId, action: 'accept',
                driverName: driverName.current?.value,
                vehicleReg: vehicleReg.current?.value,
                driverCell: driverCell.current?.value,
                loadingEta: loadingEta.current?.value,
            });
            setDone(true);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not submit. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const idx = load ? stageIndex(load.status) : 0;

    return (
        <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 16, overflow: 'hidden', marginTop: 28, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                <div style={{ background: NAVY, padding: '22px 30px' }}>
                    <img src="/fbn-logo.jpg" alt="FBN Transport" style={{ height: 46, background: '#fff', borderRadius: 4, padding: 4 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ color: YELLOW, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 }}>{mode === 'accept' ? 'Load Acceptance' : mode === 'update' ? 'Load Update' : 'Shipment Tracking'}</div>
                </div>
                <div style={{ height: 5, background: YELLOW }} />
                <div style={{ padding: 34 }}>
                    {err && !load ? <p style={{ color: '#b91c1c' }}>{err}</p> : !load ? <p style={{ color: '#6b7280' }}>Loading…</p> : (
                        <>
                            <h2 style={{ color: NAVY, margin: '0 0 4px', fontSize: 26 }}>Load {load.load_con_number}</h2>
                            <p style={{ color: '#6b7280', fontSize: 16, margin: '0 0 24px' }}>{load.collection_point} → {load.delivery_point}</p>

                            {mode === 'track' && (
                                <>
                                    <div style={{ marginBottom: 20 }}>
                                        {STAGES.map((s, i) => (
                                            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 0' }}>
                                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: i <= idx ? '#16a34a' : '#e5e7eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{i <= idx ? '✓' : i + 1}</div>
                                                <span style={{ color: i === idx ? NAVY : i < idx ? '#16a34a' : '#9ca3af', fontWeight: i === idx ? 800 : 600, fontSize: 15 }}>{s}{i === idx ? '  ← current' : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ background: '#f3f4f6', borderRadius: 10, padding: 16, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
                                        {load.collection_date && <div>Collection: <strong>{fmt(load.collection_date)}</strong></div>}
                                        {load.delivery_date && <div>Delivery (planned): <strong>{fmt(load.delivery_date)}</strong></div>}
                                        {load.loading_eta && <div>ETA at loading point: <strong>{fmtDT(load.loading_eta)}</strong></div>}
                                        {load.vehicle_reg && <div>Vehicle: <strong>{load.vehicle_reg}</strong></div>}
                                        {load.has_pod && <div style={{ color: '#16a34a', fontWeight: 700, marginTop: 4 }}>POD received ✓</div>}
                                    </div>
                                    {/* Client → ops request channel (no detail editing, just a note). */}
                                    <div style={{ marginTop: 22, borderTop: '1px solid #e5e7eb', paddingTop: 18 }}>
                                        {load.request_reply ? (
                                            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                                                <div style={{ fontSize: 12, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: 1 }}>FBN replied</div>
                                                <p style={{ color: '#065f46', fontSize: 14, margin: '6px 0 0' }}>{load.request_reply}</p>
                                            </div>
                                        ) : null}
                                        {reqSent || load.request_status === 'open' ? (
                                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                                                <p style={{ color: '#1e40af', fontSize: 14, margin: 0, fontWeight: 600 }}>✔ Your request is with our team — we'll be in touch shortly.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <label style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Need anything for this delivery?</label>
                                                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 8px' }}>e.g. "Please call me 30 min before delivery." Our team will respond — you can't change the booking here.</p>
                                                <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={3} placeholder="Type your request or special instruction…" style={{ width: '100%', padding: 11, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                                <button onClick={submitRequest} disabled={reqBusy || !reqMsg.trim()} style={{ marginTop: 8, background: reqBusy || !reqMsg.trim() ? '#9ca3af' : NAVY, color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{reqBusy ? 'Sending…' : 'Send request'}</button>
                                            </>
                                        )}
                                    </div>
                                    <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 20 }}>FBN Transport · Commercial Freight Specialists</p>
                                </>
                            )}

                            {mode === 'accept' && (done || load.accepted_at ? (
                                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                    <div style={{ fontSize: 48 }}>✅</div>
                                    <h3 style={{ color: NAVY }}>Load accepted</h3>
                                    <p style={{ color: '#4b5563' }}>Thank you. FBN Transport has your acceptance and driver details for load {load.load_con_number}.</p>
                                </div>
                            ) : (
                                <>
                                    <p style={{ color: '#374151', fontSize: 15, marginBottom: 18 }}>Please confirm you accept this load and enter the driver &amp; vehicle details.</p>
                                    {err && <p style={{ color: '#b91c1c', fontSize: 14 }}>{err}</p>}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label style={lbl}>Driver name</label>
                                            <input ref={driverName} style={inp} placeholder="Driver full name" />
                                        </div>
                                        <div>
                                            <label style={lbl}>Vehicle registration</label>
                                            <input ref={vehicleReg} style={inp} placeholder="e.g. ND 123-456" />
                                        </div>
                                        <div>
                                            <label style={lbl}>Driver cell</label>
                                            <input ref={driverCell} style={inp} placeholder="082..." />
                                        </div>
                                        <div>
                                            <label style={lbl}>ETA at loading point (date &amp; time)</label>
                                            <input ref={loadingEta} type="datetime-local" style={inp} />
                                        </div>
                                    </div>
                                    <button onClick={submitAccept} disabled={busy} style={{ width: '100%', background: busy ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', padding: 16, borderRadius: 10, fontSize: 17, fontWeight: 800, cursor: 'pointer', marginTop: 10 }}>
                                        {busy ? 'Submitting…' : 'Accept load'}
                                    </button>
                                </>
                            ))}

                            {mode === 'update' && (() => {
                                const next = NEXT_ACTION(load.status);
                                const delivered = ['Delivered', 'POD Submitted', 'Invoiced'].includes(load.status);
                                return (
                                    <>
                                        <div style={{ background: '#f3f4f6', borderRadius: 10, padding: 14, fontSize: 14, color: '#374151', marginBottom: 18 }}>
                                            Current status: <strong style={{ color: NAVY }}>{STAGES[stageIndex(load.status)]}</strong>
                                            {load.delivery_eta && <div style={{ marginTop: 4 }}>Delivery ETA: <strong>{fmtDT(load.delivery_eta)}</strong></div>}
                                        </div>
                                        {err && <p style={{ color: '#b91c1c', fontSize: 14 }}>{err}</p>}
                                        {delivered ? (
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ color: '#16a34a', fontWeight: 700, fontSize: 16 }}>✅ Delivered</p>
                                                {!load.has_pod && <a href={`${window.location.origin}${window.location.pathname}?pod=${loadId}`} style={{ display: 'inline-block', marginTop: 8, background: '#16a34a', color: '#fff', textDecoration: 'none', padding: '14px 26px', borderRadius: 10, fontSize: 16, fontWeight: 800 }}>Upload signed POD + documents →</a>}
                                                {load.has_pod && <p style={{ color: '#16a34a' }}>POD received — thank you ✓</p>}
                                            </div>
                                        ) : next ? (
                                            <>
                                                <p style={{ color: '#374151', fontSize: 15, marginBottom: 12 }}>Tap to update us as the load progresses:</p>
                                                {next.askEta && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <label style={lbl}>ETA at delivery (date &amp; time)</label>
                                                        <input type="datetime-local" value={delEta} onChange={e => setDelEta(e.target.value)} style={inp} />
                                                    </div>
                                                )}
                                                <button onClick={() => submitStatus(next.to, !!next.askEta)} disabled={statusBusy} style={{ width: '100%', background: statusBusy ? '#9ca3af' : NAVY, color: '#fff', border: 'none', padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                                                    {statusBusy ? 'Saving…' : next.label}
                                                </button>
                                                <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 14 }}>Each update notifies FBN and the client automatically.</p>
                                            </>
                                        ) : (
                                            <p style={{ color: '#6b7280' }}>No action needed right now. Thank you.</p>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const inp: React.CSSProperties = { width: '100%', padding: 12, margin: '4px 0 4px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: NAVY };

export default PublicLoad;
