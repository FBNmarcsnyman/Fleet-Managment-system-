import React, { useEffect, useState } from 'react';
import { directSelect, directUpdate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AppContexts';

// Management kill-switch for ALL WhatsApp messaging. When OFF, the send-whatsapp
// function sends nothing (driver job links, status nudges, chase crons, client
// WhatsApp) — but EMAILS and the rest of the program keep running and clients are
// still updated by email. Enforced server-side (email_settings.whatsapp_enabled);
// this is just the control + live indicator. Admin / Super Admin only.
const WhatsAppToggle: React.FC = () => {
    const { currentUser } = useAuth();
    const [on, setOn] = useState<boolean>(true);
    const [busy, setBusy] = useState(false);
    const role = (currentUser as any)?.role;
    const isManager = role === 'Super Admin'; // system kill-switch — Super Admin only

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await directSelect('email_settings?id=eq.1&select=whatsapp_enabled');
            const row = Array.isArray(data) ? data[0] : data;
            if (active && row && typeof row.whatsapp_enabled === 'boolean') setOn(row.whatsapp_enabled);
        })();
        return () => { active = false; };
    }, []);

    if (!isManager) return null;

    const toggle = async () => {
        const next = !on;
        if (on && !window.confirm('Turn WhatsApp OFF for the whole system? Drivers/clients will stop getting WhatsApp messages. Emails and everything else keep running and clients are still updated by email.')) return;
        setBusy(true);
        const { error } = await directUpdate('email_settings', { id: '1' }, { whatsapp_enabled: next, updated_at: new Date().toISOString() });
        setBusy(false);
        if (error) { alert('Could not change WhatsApp mode: ' + error.message); return; }
        setOn(next);
    };

    return (
        <button onClick={toggle} disabled={busy}
            title={on
                ? 'WhatsApp is ON — drivers and clients receive WhatsApp messages. Click to turn it OFF (emails keep running).'
                : 'WhatsApp is OFF — no WhatsApp messages are sent; emails still go out. Click to turn it back ON.'}
            className={`hidden sm:flex items-center gap-2 text-[10px] font-black tracking-tight px-2.5 py-1 rounded-full border transition ${on ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25' : 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30'}`}>
            <span className={`w-2 h-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]'}`}></span>
            {busy ? '…' : on ? 'WHATSAPP: ON' : 'WHATSAPP: OFF'}
        </button>
    );
};

export default WhatsAppToggle;
