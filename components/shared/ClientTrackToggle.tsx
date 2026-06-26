import React, { useEffect, useState } from 'react';
import { directSelect, directUpdate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AppContexts';

// Management switch for the CLIENT-FACING live tracking page. When OFF, the public
// ?track= page stops showing live progress (it shows a "we'll update you by email/
// WhatsApp" note instead) — but email + WhatsApp status/ETA/geofence notifications
// KEEP GOING regardless. Admin / Super Admin only. Stored in email_settings.
const ClientTrackToggle: React.FC = () => {
    const { currentUser } = useAuth();
    const [on, setOn] = useState<boolean>(true);
    const [busy, setBusy] = useState(false);
    const role = (currentUser as any)?.role;
    const isManager = role === 'Admin' || role === 'Super Admin';

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await directSelect('email_settings?id=eq.1&select=client_live_tracking');
            const row = Array.isArray(data) ? data[0] : data;
            if (active && row && typeof row.client_live_tracking === 'boolean') setOn(row.client_live_tracking);
        })();
        return () => { active = false; };
    }, []);

    if (!isManager) return null;

    const toggle = async () => {
        const next = !on;
        if (on && !window.confirm('Turn the client LIVE TRACKING page off? Clients will stop seeing the live tracking link, but they will still get email + WhatsApp status/ETA updates.')) return;
        setBusy(true);
        const { error } = await directUpdate('email_settings', { id: '1' }, { client_live_tracking: next, updated_at: new Date().toISOString() });
        setBusy(false);
        if (error) { alert('Could not change client tracking: ' + error.message); return; }
        setOn(next);
    };

    return (
        <button onClick={toggle} disabled={busy}
            title={on
                ? 'Client live tracking is ON — clients see the live tracking page. Click to turn it off (email/WhatsApp updates continue).'
                : 'Client live tracking is OFF — clients only get email/WhatsApp updates. Click to turn it back on.'}
            className={`hidden md:flex items-center gap-2 text-[10px] font-black tracking-tight px-2.5 py-1 rounded-full border transition ${on ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25' : 'bg-slate-500/20 border-slate-500/50 text-slate-300 hover:bg-slate-500/30'}`}>
            <span className={`w-2 h-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
            {busy ? '…' : on ? 'CLIENT TRACK: ON' : 'CLIENT TRACK: OFF'}
        </button>
    );
};

export default ClientTrackToggle;
