import React, { useMemo, useRef, useState } from 'react';
import { Supplier, ComplianceDoc } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import DateField from './DateField';

const DOC_TYPES: { type: ComplianceDoc['type']; label: string }[] = [
    { type: 'COY_REG', label: 'Company Registration (CIPC)' },
    { type: 'TAX', label: 'Tax Clearance / Good Standing' },
    { type: 'BEE', label: 'BEE Certificate / Affidavit' },
    { type: 'GIT', label: 'Goods-in-Transit Insurance' },
    { type: 'LOGS', label: 'Public Liability Insurance' },
    { type: 'OTH', label: 'Other' },
];

const statusPill = (s: string) => s === 'Valid' ? 'bg-emerald-100 text-emerald-700' : s === 'Expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

const ComplianceVettingView: React.FC = () => {
    const { suppliers = [], handleAddSupplierComplianceDoc, handleVetComplianceDoc, handleDeleteComplianceDoc } = useOperations();
    const { showToast } = useUIState();
    const transport = useMemo(() => (suppliers as Supplier[]).filter(s => s.type === 'Transport' && s.isActive !== false), [suppliers]);

    const [supplierId, setSupplierId] = useState('');
    const [docType, setDocType] = useState<ComplianceDoc['type']>('COY_REG');
    const [expiry, setExpiry] = useState('');
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const selected = transport.find(s => s.id === supplierId);

    // All docs awaiting vetting across every subcontractor.
    const pending = useMemo(() => transport.flatMap(s => (s.complianceDocs || []).filter(d => d.status === 'Pending Review').map(d => ({ s, d }))), [transport]);

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (!file || !supplierId) return;
        const label = DOC_TYPES.find(t => t.type === docType)?.label || 'Document';
        setBusy(true);
        // markValid=true: staff are uploading an already-vetted doc.
        const res = await handleAddSupplierComplianceDoc(supplierId, { type: docType, name: label, file, expiryDate: expiry || undefined }, true);
        setBusy(false);
        showToast(res.ok ? `${label} uploaded & marked valid for ${selected?.name}.` : `Upload failed: ${res.error}`);
        if (res.ok) setExpiry('');
    };

    const accept = async (sid: string, d: ComplianceDoc) => { const r = await handleVetComplianceDoc(sid, d.id, 'Valid'); showToast(r.ok ? `${d.name} accepted.` : `Failed: ${r.error}`); };
    const reject = async (sid: string, d: ComplianceDoc) => { if (!confirm(`Reject & remove ${d.name}?`)) return; const r = await handleDeleteComplianceDoc(sid, d.id); showToast(r.ok ? `${d.name} rejected.` : `Failed: ${r.error}`); };

    const input = 'bg-white text-slate-800 p-2.5 rounded-lg border border-slate-300 text-sm';

    return (
        <div className="space-y-6">
            {/* Vetting queue */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-1">Compliance Vetting Queue</h3>
                <p className="text-xs text-slate-500 mb-4">Documents uploaded by subcontractors awaiting management approval.</p>
                {pending.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Nothing awaiting vetting. ✓</p> : (
                    <div className="space-y-2">
                        {pending.map(({ s, d }) => (
                            <div key={d.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                                    <p className="text-xs text-slate-500">{d.name}{d.expiryDate ? ` · expires ${new Date(d.expiryDate).toLocaleDateString('en-ZA')}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <a href={d.attachment?.data || '#'} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:underline">View</a>
                                    <button onClick={() => accept(s.id, d)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-lg">Accept</button>
                                    <button onClick={() => reject(s.id, d)} className="text-xs font-bold bg-slate-200 hover:bg-red-100 text-slate-700 py-1.5 px-3 rounded-lg">Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Staff upload for an already-vetted subbie */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-1">Upload a vetted document</h3>
                <p className="text-xs text-slate-500 mb-4">For subcontractors already on file and manually vetted — uploads are marked <strong>Valid</strong>.</p>
                <div className="flex flex-wrap items-end gap-3">
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Subcontractor</label>
                        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={input + ' min-w-[200px]'}>
                            <option value="">-- choose --</option>
                            {transport.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Document</label>
                        <select value={docType} onChange={e => setDocType(e.target.value as ComplianceDoc['type'])} className={input}>
                            {DOC_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                        </select></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Expiry (optional)</label>
                        <DateField value={expiry} onChange={v => setExpiry(v)} className={input} /></div>
                    <button onClick={() => fileRef.current?.click()} disabled={!supplierId || busy} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-lg text-sm">{busy ? 'Uploading…' : 'Upload (Valid)'}</button>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
                </div>

                {selected && (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                        <p className="text-xs font-black text-slate-500 uppercase mb-2">{selected.name} — documents on file</p>
                        {(selected.complianceDocs || []).length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
                            <div className="space-y-1.5">
                                {(selected.complianceDocs || []).map(d => (
                                    <div key={d.id} className="flex items-center justify-between text-sm">
                                        <a href={d.attachment?.data || '#'} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[55%]">{d.name}</a>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusPill(d.status)}`}>{d.status}</span>
                                            {d.status === 'Pending Review' && <button onClick={() => accept(selected.id, d)} className="text-[11px] font-bold text-emerald-600">Accept</button>}
                                            <button onClick={() => reject(selected.id, d)} className="text-[11px] font-bold text-slate-400 hover:text-red-600">Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplianceVettingView;
