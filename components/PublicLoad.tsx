import React, { useEffect, useRef, useState } from 'react';
import { driveViewUrl } from '../lib/driveView';

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
    pod_url?: string;
    accepted_at?: string;
    driver_accepted_at?: string;
    collection_arrived_at?: string;
    collection_departed_at?: string;
    client_name?: string;
    request_status?: string;
    request_reply?: string;
    live_tracking?: boolean;
    cargo?: string;
    packaging?: string;
}

// One clean label/value row for the detail table (mirrors the branded email layout).
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid #eef2f6', alignItems: 'flex-start' }}>
        <div style={{ width: 110, flexShrink: 0, color: '#6b7280', fontSize: 13 }}>{label}</div>
        <div style={{ flex: 1, color: '#1f2937', fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>{children}</div>
    </div>
);

// Public client-facing stages (no internal jargon).
const STAGES = ['Booked', 'Collecting', 'In Transit', 'Out for Delivery', 'Delivered'];
const stageIndex = (status: string): number => {
    if (['Booked', 'Driver Assigned'].includes(status)) return 0;
    if (['At Collection Point', 'Loading', 'Collected', 'At Collection Depot'].includes(status)) return 1;
    // "At Destination Depot"/"Unloaded" = arrived at an FBN depot, still in transit
    // to the final door — NOT yet out for delivery (was wrongly shown as Out for Delivery).
    if (['In Transit', 'At Destination Depot', 'Unloaded'].includes(status)) return 2;
    if (['Out for Delivery'].includes(status)) return 3;
    if (['Delivered', 'POD Submitted', 'Invoiced'].includes(status)) return 4;
    return 0;
};
const fmt = (d?: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };
// ETA is a datetime — show date + time, e.g. "18 Jun 2026, 08:00".
const fmtDT = (d?: string) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

// Supplier portal: the next action(s) they can push, by current internal status.
const NEXT_ACTION = (status: string): { to: string; label: string; askEta?: boolean; askLoaded?: boolean } | null => {
    if (['Booked', 'Driver Assigned'].includes(status)) return { to: 'At Collection Point', label: 'Mark Arrived to collect' };
    if (['At Collection Point', 'Loading'].includes(status)) return { to: 'Collected', label: 'Mark as Loaded / Collected', askLoaded: true };
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
    const [pkgCount, setPkgCount] = useState('');
    const [loadIssues, setLoadIssues] = useState('');
    const submitStatus = async (to: string, askEta: boolean, askLoaded?: boolean) => {
        setStatusBusy(true); setErr(null);
        try {
            await callPublic({
                loadId, action: 'status', to,
                deliveryEta: askEta ? delEta : undefined,
                loadedPackages: askLoaded && pkgCount ? pkgCount : undefined,
                loadingIssues: askLoaded ? (loadIssues || undefined) : undefined,
            });
            setLoad(await callPublic({ loadId, action: 'track' }) as Summary);  // refresh to next step
        } catch (e) { setErr(e instanceof Error ? e.message : 'Could not update. Please try again.'); }
        finally { setStatusBusy(false); }
    };

    // Own-fleet driver accepts the collection from the WhatsApp job link.
    const submitDriverAccept = async () => {
        setStatusBusy(true); setErr(null);
        try { await callPublic({ loadId, action: 'driver-accept' }); setLoad(await callPublic({ loadId, action: 'track' }) as Summary); }
        catch (e) { setErr(e instanceof Error ? e.message : 'Could not accept. Please try again.'); }
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
                            <h2 style={{ color: NAVY, margin: '0 0 18px', fontSize: 26 }}>Load {load.load_con_number}</h2>

                            {mode === 'track' && (
                                <>
                                    {/* Clean detail table — same shape as the branded email (no bunched text). */}
                                    <div style={{ background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 12, padding: '4px 16px', marginBottom: 20 }}>
                                        <Row label="Collect from">{load.collection_point || '—'}</Row>
                                        <Row label="Deliver to">{load.delivery_point || '—'}</Row>
                                        {load.collection_date && <Row label="Collection date">{fmt(load.collection_date)}</Row>}
                                        {load.delivery_date && <Row label="Delivery date">{fmt(load.delivery_date)}</Row>}
                                        {load.cargo && <Row label="Cargo">{load.cargo}</Row>}
                                        {load.packaging && <Row label="Packaging">{load.packaging}</Row>}
                                        {load.loading_eta && <Row label="ETA at loading">{fmtDT(load.loading_eta)}</Row>}
                                        {load.vehicle_reg && <Row label="Vehicle">{load.vehicle_reg}</Row>}
                                        <Row label="Status">
                                            <span style={{ color: idx >= 4 ? '#16a34a' : NAVY }}>{STAGES[idx]}</span>
                                            {load.has_pod ? <span style={{ color: '#16a34a', marginLeft: 8 }}>· POD received ✓</span> : idx >= 4 ? <span style={{ color: '#b45309', marginLeft: 8 }}>· awaiting POD</span> : null}
                                        </Row>
                                    </div>

                                    {/* Progress stepper (when live tracking on) or a friendly note (when off). */}
                                    {load.live_tracking !== false ? (
                                        <div style={{ marginBottom: 20 }}>
                                            {STAGES.map((s, i) => (
                                                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 0' }}>
                                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: i <= idx ? '#16a34a' : '#e5e7eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{i <= idx ? '✓' : i + 1}</div>
                                                    <span style={{ color: i === idx ? NAVY : i < idx ? '#16a34a' : '#9ca3af', fontWeight: i === idx ? 800 : 600, fontSize: 15 }}>{s}{i === idx ? '  ← current' : ''}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ background: '#f3f4f6', borderRadius: 10, padding: 16, fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 4 }}>
                                            <p style={{ margin: 0 }}><strong>FBN Transport will keep you updated by email and WhatsApp</strong> at each stage and with the delivery ETA. You can also add a note or request an update below.</p>
                                        </div>
                                    )}

                                    {load.has_pod && load.pod_url && (
                                        <a href={driveViewUrl(load.pod_url)} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', marginTop: 14, background: '#16a34a', color: '#fff', textDecoration: 'none', fontWeight: 800, padding: '12px 20px', borderRadius: 8 }}>View signed POD</a>
                                    )}

                                    {/* Client → ops channel — ALWAYS available (add remarks / extra info / request an update). */}
                                    <div style={{ marginTop: 22, borderTop: '1px solid #e5e7eb', paddingTop: 18 }}>
                                        {load.request_reply ? (
                                            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                                                <div style={{ fontSize: 12, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: 1 }}>FBN replied</div>
                                                <p style={{ color: '#065f46', fontSize: 14, margin: '6px 0 0' }}>{load.request_reply}</p>
                                            </div>
                                        ) : null}
                                        {reqSent || load.request_status === 'open' ? (
                                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                                                <p style={{ color: '#1e40af', fontSize: 14, margin: 0, fontWeight: 600 }}>✔ Your note is with our team — we'll be in touch shortly.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <label style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Add info, remarks or request an update</label>
                                                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 8px' }}>e.g. weight, order/reference number, collection remarks, or "please call 30 min before delivery." Our team will action it.</p>
                                                <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={3} placeholder="Type weight / order no / remarks / your request…" style={{ width: '100%', padding: 11, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                                                <button onClick={submitRequest} disabled={reqBusy || !reqMsg.trim()} style={{ marginTop: 8, background: reqBusy || !reqMsg.trim() ? '#9ca3af' : NAVY, color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{reqBusy ? 'Sending…' : 'Send to FBN'}</button>
                                            </>
                                        )}
                                    </div>
                                    <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 20 }}>FBN Transport · Commercial Freight Specialists</p>
                                </>
                            )}

                            {mode === 'accept' && (done || load.accepted_at ? (
                                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                    <div style={{ fontSize: 48 }}>✓</div>
                                    <h3 style={{ color: NAVY }}>Load accepted</h3>
                                    <p style={{ color: '#4b5563' }}>Thank you. FBN Transport has your acceptance and driver details for load {load.load_con_number}.</p>
                                </div>
                            ) : (
                                <>
                                    {(load.driver_name || load.vehicle_reg || load.loading_eta) && (
                                        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                                            <div style={{ fontSize: 12, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: 1 }}>✓ Already assigned</div>
                                            <p style={{ color: '#065f46', fontSize: 14, margin: '6px 0 0' }}>
                                                {load.driver_name ? <>Driver: <strong>{load.driver_name}</strong>. </> : ''}
                                                {load.vehicle_reg ? <>Vehicle: <strong>{load.vehicle_reg}</strong>. </> : ''}
                                                {load.loading_eta ? <>ETA: <strong>{fmtDT(load.loading_eta)}</strong>.</> : ''}
                                            </p>
                                            <p style={{ color: '#047857', fontSize: 12, margin: '4px 0 0' }}>Already on file — only change these if something is different.</p>
                                        </div>
                                    )}
                                    <p style={{ color: '#374151', fontSize: 15, marginBottom: 18 }}>Please confirm you accept this load and enter the driver &amp; vehicle details.</p>
                                    {err && <p style={{ color: '#b91c1c', fontSize: 14 }}>{err}</p>}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div>
                                            <label style={lbl}>Driver name</label>
                                            <input ref={driverName} style={inp} placeholder="Driver full name" defaultValue={load.driver_name || ''} />
                                        </div>
                                        <div>
                                            <label style={lbl}>Vehicle registration</label>
                                            <input ref={vehicleReg} style={inp} placeholder="e.g. ND 123-456" defaultValue={load.vehicle_reg || ''} />
                                        </div>
                                        <div>
                                            <label style={lbl}>Driver cell</label>
                                            <input ref={driverCell} style={inp} placeholder="082..." defaultValue={(load as any).driver_cell || ''} />
                                        </div>
                                        <div>
                                            <label style={lbl}>ETA at loading point (date &amp; time)</label>
                                            <input ref={loadingEta} type="datetime-local" style={inp} defaultValue={(load.loading_eta || '').slice(0, 16)} />
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
                                const needAccept = !load.driver_accepted_at && ['Booked', 'Driver Assigned'].includes(load.status);
                                return (
                                    <>
                                        <div style={{ background: '#f3f4f6', borderRadius: 10, padding: 14, fontSize: 14, color: '#374151', marginBottom: 18 }}>
                                            Current status: <strong style={{ color: NAVY }}>{STAGES[stageIndex(load.status)]}</strong>
                                            {load.driver_accepted_at && <div style={{ marginTop: 4, color: '#16a34a', fontWeight: 700 }}>✓ You accepted this collection</div>}
                                            {load.delivery_eta && <div style={{ marginTop: 4 }}>Delivery ETA: <strong>{fmtDT(load.delivery_eta)}</strong></div>}
                                        </div>
                                        {err && <p style={{ color: '#b91c1c', fontSize: 14 }}>{err}</p>}
                                        {needAccept ? (
                                            <>
                                                <div style={{ background: '#f8fafc', border: '1px solid #eef2f6', borderRadius: 12, padding: '4px 16px', marginBottom: 16 }}>
                                                    <Row label="Collect from">{load.collection_point || '—'}</Row>
                                                    <Row label="Deliver to">{load.delivery_point || '—'}</Row>
                                                    {load.collection_date && <Row label="Date">{fmt(load.collection_date)}</Row>}
                                                    {load.cargo && <Row label="Cargo">{load.cargo}</Row>}
                                                </div>
                                                <p style={{ color: '#374151', fontSize: 15, marginBottom: 12 }}>Accept this collection to let the office know you're on the way.</p>
                                                <button onClick={submitDriverAccept} disabled={statusBusy} style={{ width: '100%', background: statusBusy ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', padding: 16, borderRadius: 10, fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
                                                    {statusBusy ? 'Saving…' : 'Accept collection'}
                                                </button>
                                            </>
                                        ) : delivered ? (
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ color: '#16a34a', fontWeight: 700, fontSize: 16 }}>✓ Delivered</p>
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
                                                {next.askLoaded && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <label style={lbl}>Number of packages loaded</label>
                                                        <input type="number" value={pkgCount} onChange={e => setPkgCount(e.target.value)} placeholder="e.g. 24" style={inp} />
                                                        <label style={{ ...lbl, marginTop: 10 }}>Any issues at loading? (leave blank if all good)</label>
                                                        <textarea value={loadIssues} onChange={e => setLoadIssues(e.target.value)} placeholder="e.g. 2 cartons damaged, short-loaded by 1 pallet…" rows={3} style={{ ...inp, resize: 'vertical' }} />
                                                    </div>
                                                )}
                                                <button onClick={() => submitStatus(next.to, !!next.askEta, !!next.askLoaded)} disabled={statusBusy} style={{ width: '100%', background: statusBusy ? '#9ca3af' : NAVY, color: '#fff', border: 'none', padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
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
