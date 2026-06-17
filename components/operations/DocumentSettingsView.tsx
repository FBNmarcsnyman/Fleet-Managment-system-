import React, { useEffect, useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { DocSettings, DEFAULT_DOC_SETTINGS, getDocSettings, saveDocSettings } from '../../lib/docSettings';
import { brandedEmail, emailButton } from '../../lib/emailTemplate';

// Sample data so the email previews look like a real send.
const SAMPLE = { loadConNumber: 'FBN-2026-06-0001', name: 'Wayne', client: 'PERI', route: 'PERI JHB to PERI EL' };

// The exact email bodies the app sends (kept in sync with the senders), so you
// can verify the look & wording here without sending a test.
const EMAIL_SAMPLES: { key: string; label: string; subject: string; html: string }[] = [
    {
        key: 'loadcon', label: 'LoadCon → Transporter', subject: `FBN Load Confirmation ${SAMPLE.loadConNumber} - Transnet, Salt River to Transnet, Bloemfontein`,
        html: brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${SAMPLE.loadConNumber}</div>
          <p>Good day ${SAMPLE.name},</p>
          <p>Please find attached your FBN Load Confirmation for the load from <strong>Salt River</strong> to <strong>Bloemfontein</strong>.</p>
          <table style="border-collapse:collapse;margin:6px 0 14px">
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;vertical-align:top">Collection</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">Transnet, RSE Store, Salt River &nbsp;<a href="#" style="color:#1d4ed8">📍 View on map</a></td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;vertical-align:top">Delivery</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">Transnet, Wagon Build, Bloemfontein &nbsp;<a href="#" style="color:#1d4ed8">📍 View on map</a></td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Loading date</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">18/06/2026</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Load type / size</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">12M</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Weight (kg)</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">18000</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Transport rate</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">R 21600</td></tr>
          </table>
          <p>Kindly <strong>confirm acceptance</strong> and send your driver name, vehicle registration and driver cell using the button below. POD to be returned on delivery.</p>
          ${emailButton('#', 'Accept this load &amp; send driver details &rarr;', '#16a34a')}
          <p>Regards,<br>FBN Transport</p>`),
    },
    {
        key: 'clientOrder', label: 'Client Order → Client', subject: `FBN Transport Order ${SAMPLE.loadConNumber} - Transnet, Salt River to Transnet, Bloemfontein`,
        html: brandedEmail(`<div style="text-align:right;font-weight:800;color:#13294b;font-size:16px;margin-bottom:10px">${SAMPLE.loadConNumber}</div>
          <p>Good day ${SAMPLE.client},</p>
          <p><strong>Thank you for your load — we are pleased to confirm it is booked</strong> and all arrangements are in place. Your order details are set out below and attached for your records:</p>
          <table style="border-collapse:collapse;margin:6px 0 14px">
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">FBN order no.</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">${SAMPLE.loadConNumber}</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Your reference</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">PO 88421</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;vertical-align:top">Collection</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">Transnet, RSE Store, Salt River &nbsp;<a href="#" style="color:#1d4ed8">📍 View on map</a></td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700;vertical-align:top">Delivery</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">Transnet, Wagon Build, Bloemfontein &nbsp;<a href="#" style="color:#1d4ed8">📍 View on map</a></td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Loading date</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">18/06/2026</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Load type / size</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">12M</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Weight (kg)</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">18000</td></tr>
            <tr><td style="padding:5px 14px 5px 0;color:#13294b;font-size:13px;font-weight:700">Commodity</td><td style="padding:5px 0;color:#13294b;font-size:13px;font-weight:700">SUB FRAMES</td></tr>
          </table>
          ${emailButton('#', 'Track your shipment &rarr;', '#13294b')}
          <p>You'll receive regular updates as the load progresses through collection and delivery, and the signed POD as soon as it is available. Should you need anything in the meantime, simply reply to this email.</p>
          <p>Kind regards,<br>FBN Transport &middot; Commercial Freight Specialists</p>`),
    },
    {
        key: 'amended', label: 'AMENDED re-confirm', subject: `AMENDED Load Confirmation ${SAMPLE.loadConNumber} - please re-confirm`,
        html: brandedEmail(`<p>Good day ${SAMPLE.name},</p>
          <p><strong style="color:#b45309">AMENDED DETAILS — please review &amp; re-confirm.</strong></p>
          <p>The load confirmation <strong>${SAMPLE.loadConNumber}</strong> (${SAMPLE.route}) has been <strong>amended</strong>.</p>
          <ul style="font-size:14px;color:#1f2937"><li>Loading date: 19/06/2026</li><li>Transport rate: 16500</li></ul>
          ${emailButton('#', 'Review &amp; confirm amended load &rarr;', '#b45309')}
          <p>Regards,<br>FBN Transport</p>`),
    },
    {
        key: 'podReq', label: 'POD request → Transporter', subject: `POD required - Load ${SAMPLE.loadConNumber}`,
        html: brandedEmail(`<p>Good day ${SAMPLE.name},</p>
          <p>Please send through the <strong>POD</strong> for load <strong>${SAMPLE.loadConNumber}</strong> (${SAMPLE.route}) now that it has delivered.</p>
          ${emailButton('#', 'Upload POD &rarr;', '#16a34a')}
          <p>Thank you,<br>FBN Transport</p>`),
    },
    {
        key: 'podAvail', label: 'POD available → Client', subject: `POD available - shipment ${SAMPLE.loadConNumber}`,
        html: brandedEmail(`<p>Good day ${SAMPLE.client},</p>
          <p>The <strong>POD</strong> for your delivered shipment <strong>${SAMPLE.loadConNumber}</strong> is now available to view and download.</p>
          ${emailButton('#', 'View / download POD &rarr;', '#16a34a')}
          <p>Regards,<br>FBN Transport</p>`),
    },
];

// Edit the boilerplate / red text that appears on every LoadCon, Order & POD.
const DocumentSettingsView: React.FC = () => {
    const { showToast } = useUIState();
    const [s, setS] = useState<DocSettings>(DEFAULT_DOC_SETTINGS);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState<'wording' | 'email'>('wording');
    const [emailKey, setEmailKey] = useState(EMAIL_SAMPLES[0].key);

    useEffect(() => { getDocSettings().then(v => { setS(v); setLoaded(true); }); }, []);

    const set = <K extends keyof DocSettings>(k: K, v: DocSettings[K]) => setS(p => ({ ...p, [k]: v }));

    const save = async () => {
        setSaving(true);
        const res = await saveDocSettings(s);
        setSaving(false);
        showToast(res.ok ? 'Document settings saved — applies to all new documents.' : `Could not save: ${res.error}`);
    };

    const label = 'block text-xs font-black text-slate-500 uppercase tracking-widest mb-1';
    const input = 'w-full bg-white text-slate-800 p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-1 focus:ring-blue-500 outline-none';

    if (!loaded) return <div className="text-slate-500 p-6">Loading…</div>;

    const tabBtn = (k: 'wording' | 'email', t: string) => (
        <button onClick={() => setTab(k)} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition ${tab === k ? 'bg-[#13294b] text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>{t}</button>
    );

    const current = EMAIL_SAMPLES.find(e => e.key === emailKey) || EMAIL_SAMPLES[0];

    if (tab === 'email') {
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-4xl">
                <div className="flex gap-2 mb-5">{tabBtn('wording', 'Document Wording')}{tabBtn('email', 'Email Preview')}</div>
                <h3 className="text-xl font-black text-slate-900 mb-1">Email Preview</h3>
                <p className="text-xs text-slate-500 mb-4">Exactly how each email looks when sent. (While <strong>EMAILS: TEST</strong> is on, all of these go only to you.)</p>
                <div className="flex flex-wrap gap-2 mb-4">
                    {EMAIL_SAMPLES.map(e => (
                        <button key={e.key} onClick={() => setEmailKey(e.key)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${emailKey === e.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>{e.label}</button>
                    ))}
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs text-slate-600"><strong>Subject:</strong> {current.subject}</div>
                    <iframe title="email preview" srcDoc={current.html} style={{ width: '100%', height: '60vh', border: 'none', background: '#fff' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-3xl">
            <div className="flex gap-2 mb-5">{tabBtn('wording', 'Document Wording')}{tabBtn('email', 'Email Preview')}</div>
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h3 className="text-xl font-black text-slate-900">Document Settings</h3>
                    <p className="text-xs text-slate-500">Edit the standard wording that prints on every LoadCon, Client Order &amp; POD.</p>
                </div>
                <button onClick={save} disabled={saving} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-sm">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={label}>Head office name</label><input className={input} value={s.officeName} onChange={e => set('officeName', e.target.value)} /></div>
                    <div><label className={label}>PODs email</label><input className={input} value={s.podsEmail} onChange={e => set('podsEmail', e.target.value)} /></div>
                </div>
                <div><label className={label}>Head office address lines (one per line)</label>
                    <textarea className={input} rows={4} value={s.officeLines.join('\n')} onChange={e => set('officeLines', e.target.value.split('\n'))} /></div>

                <div><label className={label}>NOTES heading (red) — use {'{podsEmail}'} where the email should appear</label>
                    <textarea className={input} rows={3} value={s.notesHead} onChange={e => set('notesHead', e.target.value)} /></div>
                <div><label className={label}>NOTES bullet points (one per line)</label>
                    <textarea className={input} rows={6} value={s.notesBullets.join('\n')} onChange={e => set('notesBullets', e.target.value.split('\n').filter(x => x.trim()))} /></div>

                <div><label className={label}>Default special instructions (red)</label>
                    <textarea className={input} rows={2} value={s.defaultSpecial} onChange={e => set('defaultSpecial', e.target.value)} /></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={label}>GIT required / load</label><input className={input} value={s.gitAmount} onChange={e => set('gitAmount', e.target.value)} /></div>
                    <div><label className={label}>Footer line</label><input className={input} value={s.footer} onChange={e => set('footer', e.target.value)} /></div>
                </div>
            </div>
            <div className="mt-5 text-right">
                <button onClick={save} disabled={saving} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-sm">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
        </div>
    );
};

export default DocumentSettingsView;
