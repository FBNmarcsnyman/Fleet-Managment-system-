import React, { useState } from 'react';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import AddressAutocompleteInput from '../operations/AddressAutocompleteInput';
import DateField from '../operations/DateField';

const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5b700]';
const lbl = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';
const LOAD_TYPES = ['Full load / FTL', 'Part load / LCL', 'Pallets', 'Container', 'Bulk', 'Abnormal'];
const CARGO_TYPES = ['General', 'HAZMAT', 'Abnormal', 'Perishable'];
const URGENCY = ['Standard', 'Urgent', 'Critical / same-day'];

const ClientQuoteRequestForm: React.FC<{ clientId?: string; onDone: () => void }> = ({ clientId, onDone }) => {
    const { handleClientQuoteRequest } = useOperations() as any;
    const { showToast } = useUIState();
    const [f, setF] = useState({
        collectionAddress: '', deliveryAddress: '', collectionDate: '', cargoDescription: '', commodity: '',
        weightKg: '', volumeCbm: '', loadType: LOAD_TYPES[0], cargoType: 'General', unNumber: '', hazClass: '',
        specialRequirements: '', urgency: 'Standard',
    });
    const [busy, setBusy] = useState(false);
    const [ref, setRef] = useState<string | null>(null);
    const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

    const submit = async () => {
        if (!f.collectionAddress.trim() || !f.deliveryAddress.trim()) { showToast('Enter collection and delivery addresses.'); return; }
        setBusy(true);
        const res = await handleClientQuoteRequest({ ...f, weightKg: f.weightKg ? Number(f.weightKg) : null, volumeCbm: f.volumeCbm ? Number(f.volumeCbm) : null, clientId });
        setBusy(false);
        if (res?.ok) setRef(res.value.reference); else showToast(`Could not submit: ${res?.error}`);
    };

    if (ref) return (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-lg mx-auto">
            <div className="text-5xl mb-3">✓</div>
            <h2 className="text-2xl font-black text-[#13294b]">Quote request submitted</h2>
            <p className="text-slate-600 text-sm mt-2">Our team will price it and send you a quote. Reference <strong>{ref}</strong>.</p>
            <button onClick={onDone} className="mt-6 bg-[#13294b] text-white font-bold py-2.5 px-6 rounded-lg text-sm">View my quotes</button>
        </div>
    );

    return (
        <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Request a quote</h2>
            <p className="text-slate-500 mb-6">Tell us what you need moved — we'll price it and send you a quote.</p>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 max-w-3xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={lbl}>Collection address *</label><AddressAutocompleteInput value={f.collectionAddress} onChange={(v: string) => set('collectionAddress', v)} placeholder="Search address…" className={inp} /></div>
                    <div><label className={lbl}>Delivery address *</label><AddressAutocompleteInput value={f.deliveryAddress} onChange={(v: string) => set('deliveryAddress', v)} placeholder="Search address…" className={inp} /></div>
                    <div><label className={lbl}>Collection date</label><DateField value={f.collectionDate} onChange={v => set('collectionDate', v)} className={inp} /></div>
                    <div><label className={lbl}>Urgency</label><select value={f.urgency} onChange={e => set('urgency', e.target.value)} className={inp}>{URGENCY.map(u => <option key={u}>{u}</option>)}</select></div>
                    <div><label className={lbl}>Commodity</label><input value={f.commodity} onChange={e => set('commodity', e.target.value)} className={inp} placeholder="e.g. Steel coils" /></div>
                    <div><label className={lbl}>Load type</label><select value={f.loadType} onChange={e => set('loadType', e.target.value)} className={inp}>{LOAD_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                    <div><label className={lbl}>Weight (kg)</label><input type="number" value={f.weightKg} onChange={e => set('weightKg', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Volume (CBM)</label><input type="number" value={f.volumeCbm} onChange={e => set('volumeCbm', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Cargo type</label><select value={f.cargoType} onChange={e => set('cargoType', e.target.value)} className={inp}>{CARGO_TYPES.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                {f.cargoType === 'HAZMAT' && (
                    <div className="grid grid-cols-2 gap-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div><label className={lbl}>HAZMAT UN number</label><input value={f.unNumber} onChange={e => set('unNumber', e.target.value)} className={inp} placeholder="e.g. UN1203" /></div>
                        <div><label className={lbl}>Class</label><input value={f.hazClass} onChange={e => set('hazClass', e.target.value)} className={inp} placeholder="e.g. 3" /></div>
                    </div>
                )}
                <div><label className={lbl}>Cargo description</label><input value={f.cargoDescription} onChange={e => set('cargoDescription', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Special requirements</label><textarea value={f.specialRequirements} onChange={e => set('specialRequirements', e.target.value)} rows={2} className={inp} style={{ textTransform: 'none' }} placeholder="Tail-lift, crane, after-hours, etc." /></div>
                <div className="flex justify-end pt-2 border-t border-slate-200">
                    <button onClick={submit} disabled={busy} className="bg-emerald-600 disabled:opacity-40 text-white font-black py-2.5 px-8 rounded-lg text-sm">{busy ? 'Submitting…' : 'Submit request'}</button>
                </div>
            </div>
        </div>
    );
};

export default ClientQuoteRequestForm;
