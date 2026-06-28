import React, { useRef, useState } from 'react';
import { Supplier, ComplianceDoc } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { UploadIcon } from '../icons/UploadIcon';
import DateField from '../operations/DateField';

interface SupplierDocumentsProps {
    supplier: Supplier;
}

// The documents we ask every subcontractor to load during onboarding.
const REQUIRED: { type: ComplianceDoc['type']; label: string; hasExpiry: boolean }[] = [
    { type: 'COY_REG', label: 'Company Registration (CIPC)', hasExpiry: false },
    { type: 'TAX', label: 'Tax Clearance / Good Standing', hasExpiry: true },
    { type: 'BEE', label: 'BEE Certificate / Affidavit', hasExpiry: true },
    { type: 'GIT', label: 'Goods-in-Transit Insurance', hasExpiry: true },
    { type: 'LOGS', label: 'Public Liability Insurance', hasExpiry: true },
    { type: 'OTH', label: 'Other (operator card, etc.)', hasExpiry: true },
];

const daysUntil = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

const statusPill = (doc: ComplianceDoc) => {
    const days = daysUntil(doc.expiryDate);
    if (doc.status === 'Expired' || (days !== null && days < 0)) return <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Expired</span>;
    if (days !== null && days <= 30) return <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Expires in {days}d</span>;
    if (doc.status === 'Pending Review') return <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">Pending review</span>;
    return <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Valid</span>;
};

const SupplierDocuments: React.FC<SupplierDocumentsProps> = ({ supplier }) => {
    const { handleAddSupplierComplianceDoc } = useOperations();
    const { showToast } = useUIState();
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [expiry, setExpiry] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<string | null>(null);

    const docsByType = (t: ComplianceDoc['type']) => (supplier.complianceDocs || []).filter(d => d.type === t);

    const onFile = async (type: ComplianceDoc['type'], label: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(type);
        const res = await handleAddSupplierComplianceDoc(supplier.id, { type, name: label, file, expiryDate: expiry[type] || undefined });
        setBusy(null);
        if (!res.ok) { showToast(`Upload failed: ${res.error}`); return; }
        setExpiry(p => ({ ...p, [type]: '' }));
        showToast(`${label} uploaded.`);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-white mb-1">Compliance Vault</h2>
            <p className="text-sm text-gray-400 mb-6">Load your documents here. FBN gets a reminder before anything expires, and your loads keep flowing.</p>
            <div className="space-y-3">
                {REQUIRED.map(req => {
                    const docs = docsByType(req.type);
                    return (
                        <div key={req.type} className="bg-gray-700/50 p-4 rounded-lg">
                            <div className="flex flex-wrap justify-between items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-white">{req.label}</span>
                                    {docs.length > 0 ? statusPill(docs[docs.length - 1]) : <span className="text-xs text-gray-500">Not loaded yet</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {req.hasExpiry && (
                                        <div className="w-40"><DateField value={expiry[req.type] || ''} onChange={v => setExpiry(p => ({ ...p, [req.type]: v }))}
                                            className="bg-gray-900 text-white text-xs p-2 rounded-md border border-gray-600 w-full" /></div>
                                    )}
                                    <button type="button" disabled={busy === req.type} onClick={() => fileRefs.current[req.type]?.click()}
                                        className="cursor-pointer text-sm font-semibold text-white bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 px-3 py-2 rounded-md flex items-center">
                                        <UploadIcon className="h-4 w-4 mr-2" /> {busy === req.type ? 'Uploading…' : docs.length ? 'Replace' : 'Upload'}
                                    </button>
                                    <input ref={el => { fileRefs.current[req.type] = el; }} type="file" accept="image/*,application/pdf"
                                        className="hidden" onChange={e => onFile(req.type, req.label, e)} />
                                </div>
                            </div>
                            {docs.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-600/50 space-y-1">
                                    {docs.map(d => (
                                        <div key={d.id} className="flex justify-between items-center text-xs">
                                            <a href={d.attachment?.data || '#'} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate max-w-[60%]">{d.attachment?.name || d.name}</a>
                                            <span className="text-gray-400">{d.expiryDate ? `Expires ${new Date(d.expiryDate).toLocaleDateString('en-ZA')}` : 'No expiry'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SupplierDocuments;
