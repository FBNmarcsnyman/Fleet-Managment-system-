import React, { useState } from 'react';
import { invokeFn } from '../../lib/supabase';

// Lazy signed-URL thumbnail for a private inspection photo (path = "inspections/...").
// Click to fetch a short-lived signed URL (inspection-doc-url) and reveal the image.
const InspectionPhoto: React.FC<{ path: string; label?: string }> = ({ path, label }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const load = async () => {
        if (url || loading) return;
        setLoading(true);
        try { const { data, error } = await invokeFn('inspection-doc-url', { body: { path } }); if (error || !data?.url) setFailed(true); else setUrl(data.url); }
        catch { setFailed(true); } finally { setLoading(false); }
    };
    if (failed) return <span className="text-xs text-slate-400">photo unavailable</span>;
    if (url) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label || 'photo'} className="h-20 w-20 object-cover rounded-lg border border-slate-200" /></a>;
    return <button onClick={load} className="h-20 w-20 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:bg-slate-50">{loading ? '…' : `📷 ${label || 'View'}`}</button>;
};

export default InspectionPhoto;
