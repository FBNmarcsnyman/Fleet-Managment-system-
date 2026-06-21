import React, { useEffect, useState } from 'react';

// Public, no-login page where a carrier submits a quote against an RFQ via the
// ?rfq=<token> link in the broadcast email. Talks only to the token-authenticated
// `rfq-public` edge function (no Supabase session).
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rfq-public`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const call = async (body: Record<string, unknown>): Promise<any> => {
    const resp = await Promise.race<Response>([
        fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(body) }),
        new Promise<Response>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
    ]);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || data?.error) throw new Error(data?.error || `${resp.status}`);
    return data;
};

const rand = (n?: number | null) => n || n === 0 ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const input = 'w-full bg-white border border-gray-300 rounded-lg p-3 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1';

const Row: React.FC<{ k: string; v?: React.ReactNode }> = ({ k, v }) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 last:border-0">
        <span className="text-sm text-gray-500">{k}</span>
        <span className="text-sm font-bold text-gray-900 text-right">{v || '—'}</span>
    </div>
);

const PublicRfqQuote: React.FC<{ token: string }> = ({ token }) => {
    const [state, setState] = useState<'loading' | 'ready' | 'error' | 'done' | 'declined'>('loading');
    const [error, setError] = useState('');
    const [rfq, setRfq] = useState<any>(null);
    const [recipient, setRecipient] = useState<any>(null);
    const [price, setPrice] = useState('');
    const [vehicle, setVehicle] = useState('');
    const [eta, setEta] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        call({ token })
            .then(d => { setRfq(d.rfq); setRecipient(d.recipient); setVehicle(d.rfq?.vehicleType || ''); setState(d.rfq?.status === 'Open' ? 'ready' : 'error'); if (d.rfq?.status !== 'Open') setError('This request has closed.'); })
            .catch(e => { setError(String(e.message || e)); setState('error'); });
    }, [token]);

    const submit = async (canAssist: boolean) => {
        if (saving) return;
        if (canAssist && !price) { setError('Please enter your rate, or choose "Can\'t assist".'); return; }
        setSaving(true); setError('');
        try {
            await call({ token, action: 'submit', quote: { canAssist, price: canAssist && price ? Number(price) : undefined, vehicleOffered: vehicle || undefined, eta: eta || undefined, notes: notes || undefined } });
            setState(canAssist ? 'done' : 'declined');
        } catch (e) { setError(String((e as Error).message || e)); setSaving(false); }
    };

    const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div className="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-[#13294b] px-6 py-5 text-white">
                    <h1 className="text-lg font-black tracking-tight">FBN Transport</h1>
                    <p className="text-xs text-blue-200">Carrier quote request</p>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );

    if (state === 'loading') return <Shell><p className="text-center text-gray-500 py-10">Loading request…</p></Shell>;
    if (state === 'error') return <Shell><p className="text-center text-red-600 py-10 font-semibold">{error || 'This link is no longer valid.'}</p></Shell>;
    if (state === 'done') return <Shell><div className="text-center py-8"><p className="text-4xl mb-3">✅</p><p className="text-lg font-bold text-gray-900">Quote submitted</p><p className="text-sm text-gray-500 mt-1">Thank you — our ops team will be in touch if you're awarded the load.</p></div></Shell>;
    if (state === 'declined') return <Shell><div className="text-center py-8"><p className="text-4xl mb-3">👍</p><p className="text-lg font-bold text-gray-900">Noted, thanks</p><p className="text-sm text-gray-500 mt-1">We've recorded that you can't assist on this one.</p></div></Shell>;

    return (
        <Shell>
            <p className="text-sm text-gray-600 mb-1">Good day {recipient?.companyName || 'there'},</p>
            <h2 className="text-xl font-black text-gray-900">{rfq.origin} → {rfq.destination}</h2>
            <p className="text-xs font-mono text-gray-400 mb-4">{rfq.requestNumber}{rfq.arrangingBranch ? ` · ${rfq.arrangingBranch}` : ''}</p>

            <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <Row k="Vehicle required" v={rfq.vehicleType} />
                <Row k="Load" v={[rfq.loadType, rfq.commodity].filter(Boolean).join(' · ')} />
                <Row k="Weight" v={rfq.weightKg ? `${Number(rfq.weightKg).toLocaleString('en-ZA')} kg` : null} />
                <Row k="GIT cover" v={rfq.gitRequired ? 'Required' : 'Not required'} />
                <Row k="Collection" v={[rfq.collectionDate, rfq.collectionTime].filter(Boolean).join(' · ')} />
                <Row k="Delivery" v={[rfq.deliveryDate, rfq.deliveryTime].filter(Boolean).join(' · ')} />
                {rfq.notes && <Row k="Notes" v={rfq.notes} />}
            </div>

            <p className="text-sm font-bold text-gray-900 mb-3">Can you assist? Submit your best rate:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={label}>Your rate (R)</label><input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 18500" className={input} /></div>
                <div><label className={label}>Vehicle offered</label><input value={vehicle} onChange={e => setVehicle(e.target.value)} className={input} /></div>
                <div><label className={label}>Availability / ETA</label><input value={eta} onChange={e => setEta(e.target.value)} placeholder="e.g. available from 06:00" className={input} /></div>
                <div><label className={label}>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className={input} /></div>
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <button onClick={() => submit(true)} disabled={saving} className="flex-1 py-3 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit my quote'}</button>
                <button onClick={() => submit(false)} disabled={saving} className="py-3 px-4 rounded-lg text-sm font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50">Can't assist</button>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-4">Replying as {recipient?.companyName || 'your company'}. Need to change details? Reply to the email.</p>
        </Shell>
    );
};

export default PublicRfqQuote;
