import React, { useEffect, useState } from 'react';

// DRIVER RUN PAGE (no login) — one link per trip sheet. The driver sees every drop in
// order, taps "On my way" (notifies that stop's client) then "Delivered", and uploads
// the POD per stop. Mirrors the ordered run ops build in OperationsTripSheets.
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trip-run`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const APP = window.location.origin + '/';

const NAVY = '#13294b';
const YELLOW = '#f5b700';

interface Stop {
    loadId: string; order: number; urgent?: boolean; failed?: boolean; reason?: string; onTheWayAt?: string | null;
    load_con_number?: string; client_name?: string; delivery_point?: string; delivery_contact?: string; delivery_telephone?: string;
    commodity?: string; packaging?: string; packages?: number | null; weight_kg?: string; status?: string; has_pod?: boolean;
}
interface Run { trip_sheet_number?: string; vehicle_reg?: string; status?: string; stops: Stop[] }

const isDone = (s: Stop) => ['Delivered', 'POD Submitted', 'Invoiced'].includes(s.status || '') || s.has_pod;

const call = async (payload: any) => {
    const res = await fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error || 'Request failed');
    return data;
};

const PublicTripRun: React.FC<{ tripId: string }> = ({ tripId }) => {
    const [run, setRun] = useState<Run | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = async () => { try { setRun(await call({ tripId }) as Run); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the run.'); } };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [tripId]);

    const act = async (loadId: string, action: 'on-the-way' | 'delivered') => {
        setBusy(loadId + action);
        try { await call({ tripId, loadId, action }); await load(); }
        catch (e) { setErr(e instanceof Error ? e.message : 'Could not update.'); }
        setBusy(null);
    };

    const wrap: React.CSSProperties = { minHeight: '100vh', background: '#eef1f5', fontFamily: 'Arial, Helvetica, sans-serif' };
    const card: React.CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 12, overflow: 'hidden' };
    const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', padding: '12px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', flex: 1 });

    if (err && !run) return <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}><div style={{ ...card, padding: 24, maxWidth: 420, textAlign: 'center' }}><div style={{ color: '#b91c1c', fontWeight: 700 }}>{err}</div></div></div>;
    if (!run) return <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: NAVY, fontWeight: 700 }}>Loading run…</div></div>;

    const done = run.stops.filter(isDone).length;
    const total = run.stops.length;
    const activeIdx = run.stops.findIndex(s => !isDone(s));

    return (
        <div style={wrap}>
            <div style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
                {/* Header */}
                <div style={{ background: NAVY, color: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 1 }}>FBN <span style={{ color: YELLOW }}>Transport</span></div>
                    <div style={{ color: YELLOW, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>Delivery run</div>
                    <div style={{ fontSize: 15, marginTop: 6 }}>{run.trip_sheet_number}{run.vehicle_reg ? ` · ${run.vehicle_reg}` : ''}</div>
                    <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                        <div style={{ width: `${total ? (done / total) * 100 : 0}%`, background: '#16a34a', height: '100%' }} />
                    </div>
                    <div style={{ fontSize: 13, marginTop: 6, fontWeight: 700 }}>{done} of {total} delivered</div>
                </div>

                {err && <div style={{ ...card, padding: 12, color: '#b91c1c', fontWeight: 700 }}>{err}</div>}

                {run.stops.map((s, idx) => {
                    const complete = isDone(s);
                    const active = idx === activeIdx;
                    const maps = s.delivery_point ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.delivery_point)}` : '';
                    return (
                        <div key={s.loadId} style={{ ...card, border: active ? `2px solid ${NAVY}` : '2px solid transparent', opacity: complete ? 0.75 : 1 }}>
                            <div style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                    <span style={{ background: complete ? '#16a34a' : NAVY, color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{complete ? '✓' : idx + 1}</span>
                                    <span style={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>{s.client_name || s.load_con_number}</span>
                                    {s.urgent && !complete && <span style={{ marginLeft: 'auto', background: '#fee2e2', color: '#b91c1c', fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase' }}>Urgent</span>}
                                </div>
                                <div style={{ fontSize: 14, color: '#374151', marginLeft: 36 }}>{s.delivery_point || 'No address on file'}</div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 36, marginTop: 2 }}>
                                    {s.load_con_number}{s.packages ? ` · ${s.packages} pkgs` : ''}{s.weight_kg ? ` · ${Math.round(Number(s.weight_kg)).toLocaleString('en-ZA')} kg` : ''}{s.commodity ? ` · ${s.commodity}` : ''}
                                </div>
                                {(s.delivery_contact || s.delivery_telephone) && <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 36, marginTop: 2 }}>Receiver: {s.delivery_contact || ''}{s.delivery_telephone ? ` · ${s.delivery_telephone}` : ''}</div>}

                                <div style={{ display: 'flex', gap: 8, marginTop: 12, marginLeft: 36, flexWrap: 'wrap' }}>
                                    {maps && <a href={maps} target="_blank" rel="noreferrer" style={{ ...btn('#334155'), textAlign: 'center', textDecoration: 'none', display: 'block' }}>Open in Maps</a>}
                                    {s.delivery_telephone && <a href={`tel:${s.delivery_telephone}`} style={{ ...btn('#475569'), textAlign: 'center', textDecoration: 'none', display: 'block', flex: '0 0 auto', padding: '12px 16px' }}>Call</a>}
                                </div>

                                {!complete && (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10, marginLeft: 36 }}>
                                        <button onClick={() => act(s.loadId, 'on-the-way')} disabled={!!busy} style={btn(s.onTheWayAt ? '#9ca3af' : YELLOW)}>{busy === s.loadId + 'on-the-way' ? '…' : s.onTheWayAt ? '✓ Client told' : 'On my way'}</button>
                                        <button onClick={() => act(s.loadId, 'delivered')} disabled={!!busy} style={btn('#16a34a')}>{busy === s.loadId + 'delivered' ? '…' : 'Delivered'}</button>
                                    </div>
                                )}
                                {complete && (
                                    <div style={{ marginTop: 10, marginLeft: 36 }}>
                                        {s.has_pod
                                            ? <span style={{ color: '#16a34a', fontWeight: 800, fontSize: 14 }}>✓ Delivered · POD uploaded</span>
                                            : <a href={`${APP}?pod=${s.loadId}`} style={{ ...btn('#16a34a'), display: 'inline-block', textDecoration: 'none', padding: '10px 18px' }}>Upload signed POD</a>}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {total > 0 && done === total && <div style={{ ...card, padding: 18, textAlign: 'center', color: '#16a34a', fontWeight: 800 }}>All drops delivered — well done. Please upload any outstanding PODs.</div>}
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 12 }}>FBN Transport · driver delivery run</div>
            </div>
        </div>
    );
};

export default PublicTripRun;
