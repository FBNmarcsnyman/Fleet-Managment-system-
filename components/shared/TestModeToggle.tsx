import React, { useEffect, useState } from 'react';
import { supabase, directUpdate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AppContexts';

// Admin-only switch for "email test mode". When ON, the send-email function
// redirects EVERY outbound email (LoadCons / orders / PODs / tracking) to the
// test recipient only — nothing reaches real clients/transporters. When OFF,
// emails go to whoever is loaded on each record. Enforced server-side; this is
// just the control + live indicator.
const TestModeToggle: React.FC = () => {
    const { currentUser } = useAuth();
    const [on, setOn] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    const role = (currentUser as any)?.role || '';
    const isAdmin = role === 'Super Admin' || role === 'Admin';

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await (supabase as any).from('email_settings').select('test_mode').eq('id', 1).single();
                if (active) setOn(!!(data as any)?.test_mode);
            } catch { if (active) setOn(true); }
        })();
        return () => { active = false; };
    }, []);

    if (!isAdmin || on === null) return null;

    const toggle = async () => {
        const next = !on;
        if (!next && !window.confirm('Switch emails to LIVE? Real clients and transporters will start receiving LoadCons, orders and PODs.')) return;
        setBusy(true);
        const { error } = await directUpdate('email_settings', { id: '1' }, { test_mode: next, updated_at: new Date().toISOString() });
        setBusy(false);
        if (error) { alert('Could not change email mode: ' + error.message); return; }
        setOn(next);
    };

    return (
        <button onClick={toggle} disabled={busy}
            title={on
                ? 'TEST MODE: all emails go only to marcsnyman@fbn-transport.co.za. Click to go LIVE.'
                : 'LIVE: emails go to the real recipients. Click to switch back to TEST.'}
            className={`hidden sm:flex items-center gap-2 text-[10px] font-black tracking-tight px-2.5 py-1 rounded-full border transition ${on ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'}`}>
            <span className={`w-2 h-2 rounded-full ${on ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]' : 'bg-emerald-400'}`}></span>
            {busy ? '…' : on ? 'EMAILS: TEST' : 'EMAILS: LIVE'}
        </button>
    );
};

export default TestModeToggle;
