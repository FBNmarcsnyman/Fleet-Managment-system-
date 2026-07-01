import { invokeFn } from './supabase';
import { brandedEmail, emailButton } from './emailTemplate';

// ONE source of truth for the "please upload the signed POD" email — used by the
// Deliveries/POD board, the Load Board, and anywhere else a POD chase happens, so
// the branding, the wording, and the audit trail (date · who · count) stay identical.
// Returns the load-update payload to persist (podRequestedAt/By/Count) on success.
export interface PodRequestResult {
    ok: boolean;
    error?: string;
    to?: string;
    update?: { podRequestedAt: string; podRequestedBy: string; podRequestCount: number };
}

export async function sendPodRequest(lc: any, requestedBy: string, accountsCc: string[] = []): Promise<PodRequestResult> {
    const to = (lc.subcontractorEmail || '').trim();
    if (!to) return { ok: false, error: 'No subcontractor email on this load — add one in the load details first.' };
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const link = `${base}?pod=${lc.id}`;
    const route = `${lc.collectionPoint || ''}${lc.deliveryPoint ? ' to ' + lc.deliveryPoint : ''}`;
    const prevCount = Number(lc.podRequestCount || 0);
    const followUp = prevCount > 0
        ? `<p style="background:#fff7ed;border-left:3px solid #f5b700;padding:8px 12px;border-radius:6px;font-size:13px;color:#92400e;margin:0 0 14px"><strong>Friendly follow-up</strong> — this POD has been requested ${prevCount} time${prevCount > 1 ? 's' : ''} already. Please upload it as soon as possible.</p>`
        : '';
    const html = brandedEmail(
        `<p>Good day ${lc.forAttention || lc.subcontractorName || ''},</p>`
        + followUp
        + `<p>Please upload the <strong>signed POD</strong> for load <strong>${lc.loadConNumber}</strong>${route ? ` (${route})` : ''}:</p>`
        + emailButton(link, 'Upload signed POD &rarr;', '#16a34a')
        + `<p style="font-size:13px;color:#334155;margin:6px 0 0"><strong>Please upload ONLY the signed delivery note / FBN POD / client backing documents.</strong></p>`
        + `<p style="font-size:13px;color:#b91c1c;font-weight:800;margin:6px 0 0">DO NOT UPLOAD YOUR INVOICE HERE.</p>`
        + `<p style="font-size:13px;color:#64748b;margin:14px 0 0">Tap the button on your phone to snap or attach the signed POD — no login needed. Or simply reply to this email with the POD attached.</p>`
    );
    // CC loadcons@ (always), the load's own CC, and the transporter's ACCOUNTS email(s) —
    // their accounts usually hold the signed POD (attached to the carrier invoice), so
    // copying them in means whoever actually has it can upload. Deduped.
    const cc = Array.from(new Set([
        'loadcons@fbn-transport.co.za',
        ...String(lc.ccEmail || '').split(/[,;]/).map((t: string) => t.trim()),
        ...accountsCc.map((t: string) => t.trim()),
    ].filter(Boolean).filter(e => e.toLowerCase() !== to.toLowerCase())));
    try {
        const { data, error } = await invokeFn('send-email', { body: { to, cc, subject: `POD required - Load ${lc.loadConNumber}`, html, fromName: 'FBN Transport' } });
        if (error || (data as any)?.error) return { ok: false, error: (data as any)?.error || error?.message || 'send failed', to };
        return { ok: true, to, update: { podRequestedAt: new Date().toISOString(), podRequestedBy: requestedBy, podRequestCount: prevCount + 1 } };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'error', to };
    }
}
