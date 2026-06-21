import React, { useEffect, useState } from 'react';
import { directSelect, directUpdate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AppContexts';

// Admin-only switch for "email test mode". When ON, the send-email function
// redirects EVERY outbound email (LoadCons / orders / PODs / tracking) to the
// test recipient only — nothing reaches real clients/transporters. When OFF,
// emails go to whoever is loaded on each record. Enforced server-side; this is
// just the control + live indicator.
const TestModeToggle: React.FC = () => {
    const { currentUser } = useAuth();
    // Default ON (matches the DB default + safe assumption) so the pill shows for
    // admins immediately — then refine from the freeze-proof read.
    const [on, setOn] = useState<boolean>(true);
    const [busy, setBusy] = useState(false);
    // Only Marc (super admin) controls TEST/LIVE — so he can switch to TEST while
    // developing or chasing an issue without anyone else flipping it.
    const email = ((currentUser as any)?.email || '').toLowerCase();
    const isController = email === 'marcsnyman@fbn-transport.co.za';

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await directSelect('email_settings?id=eq.1&select=test_mode');
            const row = Array.isArray(data) ? data[0] : data;
            if (active && row && typeof row.test_mode === 'boolean') setOn(row.test_mode);
        })();
        return () => { active = false; };
    }, []);

    if (!isController) return null;

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
