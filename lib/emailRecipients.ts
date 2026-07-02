// Standing (fixed) CC recipients for system emails — the "email registry" (Phase 1.4).
// These are the department addresses that used to be hardcoded (loadcons@ / ops@ /
// debtors@). Now editable in Settings (email_settings.cc_*), read here cached, with the
// old constants as fallbacks so behaviour is IDENTICAL until someone edits them. Senders
// spread these into their CC arrays; the client↔subbie wall (dropAddrs) still applies.
import { directSelect } from './supabase';

const DEF_LOADCONS = ['loadcons@fbn-transport.co.za'];
const DEF_OPS = ['ops@fbn-transport.co.za'];
const DEF_DEBTORS = ['fbndebtors@fbn-transport.co.za'];

const split = (s?: string | null): string[] => String(s || '').split(/[,;]/).map(t => t.trim()).filter(Boolean);

let cache: { loadcons: string[]; ops: string[]; debtors: string[] } | null = null;

export async function loadEmailRecipients(): Promise<void> {
    try {
        const { data } = await directSelect('email_settings?id=eq.1&select=cc_loadcons,cc_ops,cc_debtors');
        const row: any = Array.isArray(data) ? data[0] : data;
        if (row) {
            const l = split(row.cc_loadcons), o = split(row.cc_ops), d = split(row.cc_debtors);
            cache = { loadcons: l.length ? l : DEF_LOADCONS, ops: o.length ? o : DEF_OPS, debtors: d.length ? d : DEF_DEBTORS };
        }
    } catch { /* keep defaults */ }
}
void loadEmailRecipients();

/** The LoadCons monitoring team — CC'd on LoadCons, Orders, amended loadcons, POD chases. */
export const loadconsCc = (): string[] => cache?.loadcons || DEF_LOADCONS;
/** Ops general inbox — CC'd on status/handover updates. */
export const opsCc = (): string[] => cache?.ops || DEF_OPS;
/** Accounts / debtors — CC'd on proformas and carrier invoices. */
export const debtorsCc = (): string[] => cache?.debtors || DEF_DEBTORS;
