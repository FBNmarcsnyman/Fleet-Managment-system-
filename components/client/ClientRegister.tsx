import React, { useState } from 'react';

// Public, no-login client self-registration (/client-register). Posts to the
// client-register edge fn which inserts a PENDING client and notifies admin.
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-register`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const INDUSTRIES = ['Manufacturer', 'Retailer / Wholesaler', 'Importer / Exporter', 'Clearing & Forwarding', 'Mining', 'Agriculture', 'FMCG', 'Construction', 'Automotive', 'Chemicals', 'Other'];
const ROUTES = ['DBN-JHB', 'JHB-DBN', 'DBN-CPT', 'CPT-DBN', 'CPT-JHB', 'JHB-CPT', 'JHB-PE', 'JHB-RBAY', 'DBN-PE', 'Cross-border'];
const CARGO = ['General', 'Palletised', 'Containerised', 'Bulk', 'Refrigerated / Reefer', 'HAZMAT / Dangerous Goods', 'Abnormal / Oversized', 'Perishable', 'Livestock', 'Liquids / Tanker'];
const LOAD_SIZES = ['Part loads / LCL', 'Full loads / FTL', 'Both part & full loads'];

const NAVY = '#13294b', GOLD = '#f5b700';
const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';
const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold border transition ${on ? 'bg-[#13294b] text-white border-[#13294b]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#13294b]'}`;

const ClientRegister: React.FC = () => {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [done, setDone] = useState<{ ref: string } | null>(null);
    const [f, setF] = useState({
        companyName: '', registrationNumber: '', vatNumber: '', industry: INDUSTRIES[0],
        contactName: '', contactEmail: '', contactMobile: '', address: '', billingAddress: '', typicalLoadSizes: LOAD_SIZES[0],
    });
    const [routes, setRoutes] = useState<string[]>([]);
    const [cargo, setCargo] = useState<string[]>([]);
    const [emailOptin, setEmailOptin] = useState(true);
    const [waOptin, setWaOptin] = useState(false);
    const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
    const toggle = (list: string[], setList: (x: string[]) => void, v: string) => setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

    const submit = async () => {
        setErr(null);
        if (!f.companyName.trim()) { setErr('Please enter your company name.'); return; }
        if (!f.contactEmail.trim()) { setErr('Please enter a contact email.'); return; }
        setBusy(true);
        try {
            const payload = { company: f, preferredRoutes: routes, cargoTypes: cargo, marketingEmailOptin: emailOptin, marketingWhatsappOptin: waOptin };
            const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify(payload) });
            const d = await r.json();
            if (!r.ok || d.error) throw new Error(d.error || 'Registration failed.');
            setDone({ ref: d.reference });
        } catch (e) { setErr(e instanceof Error ? e.message : 'Registration failed.'); }
        finally { setBusy(false); }
    };

    if (done) return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-10 text-center">
                <div className="text-5xl mb-3">✓</div>
                <h1 className="text-2xl font-black text-[#13294b]">Registration received</h1>
                <p className="text-slate-600 text-sm mt-2">Thanks! Our team will review your details and activate your account. You'll get a welcome email with your login once approved. Reference <strong>{done.ref}</strong>.</p>
                <a href="/" className="inline-block mt-6 bg-[#13294b] text-white font-bold py-2.5 px-6 rounded-lg text-sm">Done</a>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans">
            <div className="max-w-3xl mx-auto">
                <div className="rounded-2xl overflow-hidden mb-5" style={{ background: NAVY }}>
                    <div className="px-7 py-5">
                        <img src="/fbn-logo.jpg" alt="FBN Transport" className="h-9 bg-white rounded px-2 py-1 mb-2" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        <div className="text-white font-black text-lg">Open an account with FBN Transport</div>
                        <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>Client registration</div>
                    </div>
                    <div style={{ height: 4, background: GOLD }} />
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                    {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}

                    {/* Company */}
                    <div>
                        <h3 className="text-sm font-black text-[#13294b] uppercase tracking-widest mb-3">Company</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className={lbl}>Company name *</label><input value={f.companyName} onChange={e => set('companyName', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Registration number</label><input value={f.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>VAT number</label><input value={f.vatNumber} onChange={e => set('vatNumber', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Industry</label><select value={f.industry} onChange={e => set('industry', e.target.value)} className={inp}>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div>
                            <div><label className={lbl}>Typical load sizes</label><select value={f.typicalLoadSizes} onChange={e => set('typicalLoadSizes', e.target.value)} className={inp}>{LOAD_SIZES.map(i => <option key={i}>{i}</option>)}</select></div>
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="text-sm font-black text-[#13294b] uppercase tracking-widest mb-3">Primary contact</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={lbl}>Contact name</label><input value={f.contactName} onChange={e => set('contactName', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Email *</label><input type="email" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Mobile</label><input value={f.contactMobile} onChange={e => set('contactMobile', e.target.value)} className={inp} /></div>
                        </div>
                    </div>

                    {/* Addresses */}
                    <div>
                        <h3 className="text-sm font-black text-[#13294b] uppercase tracking-widest mb-3">Addresses</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><label className={lbl}>Physical address</label><input value={f.address} onChange={e => set('address', e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Billing address</label><input value={f.billingAddress} onChange={e => set('billingAddress', e.target.value)} className={inp} /></div>
                        </div>
                    </div>

                    {/* Routes */}
                    <div>
                        <h3 className="text-sm font-black text-[#13294b] uppercase tracking-widest mb-2">Preferred routes</h3>
                        <div className="flex flex-wrap gap-1.5">{ROUTES.map(r => <button key={r} type="button" onClick={() => toggle(routes, setRoutes, r)} className={chip(routes.includes(r))}>{r}</button>)}</div>
                    </div>

                    {/* Cargo */}
                    <div>
                        <h3 className="text-sm font-black text-[#13294b] uppercase tracking-widest mb-2">Cargo types you ship</h3>
                        <div className="flex flex-wrap gap-1.5">{CARGO.map(c => <button key={c} type="button" onClick={() => toggle(cargo, setCargo, c)} className={chip(cargo.includes(c))}>{c}</button>)}</div>
                    </div>

                    {/* Marketing */}
                    <div>
                        <h3 className="text-sm font-black text-[#13294b] uppercase tracking-widest mb-2">Stay in touch</h3>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"><input type="checkbox" checked={emailOptin} onChange={e => setEmailOptin(e.target.checked)} /> Email me FBN updates &amp; offers</label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mt-1"><input type="checkbox" checked={waOptin} onChange={e => setWaOptin(e.target.checked)} /> WhatsApp me FBN updates &amp; offers</label>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-200">
                        <button onClick={submit} disabled={busy || !f.companyName.trim() || !f.contactEmail.trim()} className="bg-emerald-600 disabled:opacity-40 text-white font-black py-2.5 px-8 rounded-lg text-sm">{busy ? 'Submitting…' : 'Register'}</button>
                    </div>
                </div>
                <p className="text-center text-[11px] text-slate-400 mt-4">FBN Transport CC · Commercial Freight Specialists</p>
            </div>
        </div>
    );
};

export default ClientRegister;
