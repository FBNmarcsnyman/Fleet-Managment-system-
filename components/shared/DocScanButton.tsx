import React, { useRef, useState } from 'react';
import { extractFromDocument } from '../../lib/docScan';

// Upload a photo/PDF of a document → AI extracts fields → onResult(data). The
// parent maps the data into its form so the user reviews before saving.
const DocScanButton: React.FC<{
    prompt: string;
    schema: any;
    onResult: (data: any) => void;
    label?: string;
    className?: string;
}> = ({ prompt, schema, onResult, label = '📄 Scan document', className }) => {
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (ref.current) ref.current.value = '';
        if (!file) return;
        setBusy(true); setErr(null);
        try {
            const data = await extractFromDocument(file, prompt, schema);
            onResult(data);
        } catch (e: any) {
            setErr(e?.message || 'Could not read the document.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <span className="inline-flex items-center gap-2">
            <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
            <button type="button" onClick={() => ref.current?.click()} disabled={busy}
                className={className || 'bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-sm disabled:opacity-50'}>
                {busy ? 'Reading…' : label}
            </button>
            {err && <span className="text-xs text-red-500 max-w-[16rem]">{err}</span>}
        </span>
    );
};

export default DocScanButton;
