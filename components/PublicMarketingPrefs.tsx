import React, { useEffect, useState } from 'react';

// Public, no-login self-service for a marketing contact: opt out / back in,
// update their details, and add colleagues. Reached via ?prefs=<id>&t=<token>.
const NAVY = '#13294b', YELLOW = '#f5b700';
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-prefs`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const call = async (body: Record<string, unknown>): Promise<any> => {
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok || d?.error) throw new Error(d?.error || `${r.status}`);
    return d;
};

const PublicMarketingPrefs: React.FC<{ contactId: string; token: string }> = ({ contactId, token }) => {
    const [c, setC] = useState<any>(null);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [company, setCompany] = useState(''); const [position, setPosition] = useState('');
    const [people, setPeople] = useState<{ name: string; email: string; position: string }[]>([{ name: '', email: '', position: '' }]);

    const load = async () => {
        try { const d = await call({ action: 'load', contactId, token }); setC(d.contact); setName(d.contact.name || ''); setEmail(d.contact.email || ''); setCompany(d.contact.company || ''); }
        catch (e) { setErr(e instanceof Error ? e.message : 'Could not load.'); }
    };
    useEffect(() => { load(); }, [contactId, token]);

    const act = async (action: string, extra: Record<string, unknown> = {}, ok = 'Saved.') => {
        setBusy(true); setMsg(''); setErr('');
        try { await call({ action, contactId, token, ...extra }); setMsg(ok); await load(); }
        catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
        finally { setBusy(false); }
    };
    const addPeople = async () => {
        const valid = people.filter(p => /\S+@\S+\.\S+/.test(p.email));
        if (!valid.length) { setErr('Add at least one colleague email.'); return; }
        await act('add', { people: valid }, `Added ${valid.length} colleague(s) — thank you.`);
        setPeople([{ name: '', email: '', position: '' }]);
    };

    const inp: React.CSSProperties = { width: '100%', padding: 11, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' };
    const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer' });

    return (
        <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', justifyContent: 'center', padding: 16, fontFamily: 'Arial, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 16, overflow: 'hidden', marginTop: 28, height: 'fit-content' }}>
                <div style={{ background: NAVY, padding: '22px 30px' }}>
                    <img src="/fbn-logo.jpg" alt="FBN Transport" style={{ height: 42, background: '#fff', borderRadius: 4, padding: 4 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ color: YELLOW, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 }}>Your contact preferences</div>
                </div>
                <div style={{ height: 5, background: YELLOW }} />
                <div style={{ padding: 30 }}>
                    {err && !c ? <p style={{ color: '#b91c1c' }}>{err}</p> : !c ? <p style={{ color: '#6b7280' }}>Loading…</p> : (
                        <>
                            <h2 style={{ color: NAVY, margin: '0 0 4px', fontSize: 22 }}>{c.company || 'Your details'}</h2>
                            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 18px' }}>Update your details, add colleagues, or change whether we may email you.</p>
                            {msg && <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 14 }}>{msg}</div>}
                            {err && <p style={{ color: '#b91c1c', fontSize: 13 }}>{err}</p>}

                            {/* Marketing preference */}
                            <div style={{ background: c.optedOut ? '#fef2f2' : '#eff6ff', border: `1px solid ${c.optedOut ? '#fecaca' : '#bfdbfe'}`, borderRadius: 10, padding: 14, marginBottom: 18 }}>
                                <p style={{ margin: '0 0 8px', fontSize: 14, color: '#374151' }}>{c.optedOut ? 'You are currently OPTED OUT of FBN marketing emails.' : 'You are receiving FBN marketing emails.'}</p>
                                {c.optedOut
                                    ? <button onClick={() => act('optin', {}, 'Opted back in — welcome back.')} disabled={busy} style={btn('#16a34a')}>Opt back in</button>
                                    : <button onClick={() => act('optout', {}, 'You have been unsubscribed.')} disabled={busy} style={btn('#b91c1c')}>Unsubscribe</button>}
                            </div>

                            {/* My details */}
                            <label style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>Your details</label>
                            <div style={{ display: 'grid', gap: 8, margin: '6px 0 8px' }}>
                                <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
                                <input style={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                                <input style={inp} value={position} onChange={e => setPosition(e.target.value)} placeholder="Position (optional)" />
                                <input style={inp} value={company} onChange={e => setCompany(e.target.value)} placeholder="Company" />
                            </div>
                            <button onClick={() => act('update', { name, email, company, position }, 'Your details were updated.')} disabled={busy} style={{ ...btn(NAVY), marginBottom: 22 }}>Save my details</button>

                            {/* Add colleagues */}
                            <label style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>Add colleagues (so the right people are copied in)</label>
                            <div style={{ margin: '6px 0 8px', display: 'grid', gap: 8 }}>
                                {people.map((p, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                        <input style={inp} value={p.name} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name" />
                                        <input style={inp} value={p.email} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} placeholder="Email" />
                                        <input style={inp} value={p.position} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, position: e.target.value } : x))} placeholder="Position" />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setPeople(ps => [...ps, { name: '', email: '', position: '' }])} style={{ ...btn('#475569'), padding: '9px 16px' }}>+ Another</button>
                                <button onClick={addPeople} disabled={busy} style={btn('#16a34a')}>Add colleagues</button>
                            </div>
                            <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 22 }}>FBN Transport · Commercial Freight Specialists</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicMarketingPrefs;
