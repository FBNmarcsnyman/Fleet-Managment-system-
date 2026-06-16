import React, { useEffect, useState } from 'react';
import { useUIState } from '../../contexts/AppContexts';
import { DocSettings, DEFAULT_DOC_SETTINGS, getDocSettings, saveDocSettings } from '../../lib/docSettings';

// Edit the boilerplate / red text that appears on every LoadCon, Order & POD.
const DocumentSettingsView: React.FC = () => {
    const { showToast } = useUIState();
    const [s, setS] = useState<DocSettings>(DEFAULT_DOC_SETTINGS);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);

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

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-3xl">
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
