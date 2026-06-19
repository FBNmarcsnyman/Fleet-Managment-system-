import { useMemo } from 'react';
import { useVehicles } from '../contexts/AppContexts';
import { differenceInDays } from 'date-fns';
import { Notification, ViewType } from '../types';

/**
 * Derives live operational alerts from current state — off-road vehicles,
 * open critical job cards, overdue services, and driver/vehicle documents
 * expiring within 30 days. These are computed (not stored), so they clear
 * automatically once the underlying issue is resolved.
 */
export const useLiveAlerts = (): Notification[] => {
    const { vehicles = [], jobCards = [], serviceStatuses, users = [], vehicleComplianceDocs = [], loadConfirmations = [], suppliers = [] } = useVehicles() as any;

    return useMemo(() => {
        const alerts: Notification[] = [];
        const now = new Date().toISOString();
        const today = new Date();
        const add = (id: string, type: Notification['type'], message: string, view: ViewType) =>
            alerts.push({ id, type, message, timestamp: now, link: { view }, isRead: false });

        // NEW LOAD needing action — every freshly-booked collection that hasn't
        // been given a driver/subbie yet shows here on-screen for ops, on every
        // load, and clears itself the moment it's assigned. The `load-` id prefix
        // lets the notification centre open the load straight from the alert.
        (loadConfirmations || []).forEach((lc: any) => {
            if (!lc.isCollection) return;
            if (lc.status !== 'Booked') return;
            if (lc.supplierId || lc.vehicleId || lc.subcontractorName) return;
            const lane = [lc.collectionPoint, lc.deliveryPoint].filter(Boolean).join(' → ');
            add(`load-${lc.id}`, 'JOB_CARD', `NEW collection ${lc.loadConNumber || ''} — ${lc.clientName || 'client'}${lane ? `: ${lane}` : ''}. Assign driver & ETA.`, 'operations');
        });

        // CONSOLIDATION — 2+ active loads from different branches heading to the
        // same delivery area can share a run. Surfaces on the planning board.
        const areaOf = (addr?: string): string => {
            if (!addr) return '';
            const parts = String(addr).split(',').map(s => s.trim()).filter(Boolean).filter(s => !/south africa/i.test(s));
            for (let i = 0; i < parts.length; i++) if (/^\d{4}$/.test(parts[i])) return (parts[i - 1] || '').toUpperCase();
            return (parts[parts.length - 1] || '').toUpperCase();
        };
        const DONE_STATUSES = ['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'];
        const byArea = new Map<string, any[]>();
        (loadConfirmations || []).forEach((lc: any) => {
            if (DONE_STATUSES.includes(lc.status)) return;
            const a = areaOf(lc.deliveryPoint); if (!a) return;
            const arr = byArea.get(a) || []; arr.push(lc); byArea.set(a, arr);
        });
        byArea.forEach((arr, area) => {
            if (arr.length < 2) return;
            if (new Set(arr.map((l: any) => l.collectionBranch).filter(Boolean)).size < 2) return; // only cross-branch
            add(`consol-${area}`, 'JOB_CARD', `${arr.length} loads heading to ${area} from different branches — consolidate?`, 'operations');
        });

        (vehicles || []).filter((v: any) => v.status === 'Off the road').forEach((v: any) =>
            add(`offroad-${v.id}`, 'JOB_CARD', `${v.name} (${v.registration}) is OFF THE ROAD`, 'fleet'));

        (jobCards || []).filter((j: any) => (j.severity === 'Critical' || j.priority === 'Critical') && j.status !== 'Resolved')
            .forEach((j: any) => add(`jc-${j.id}`, 'JOB_CARD', `Critical job open: ${j.itemDescription}`, 'workshop'));

        // serviceStatuses is a Map<vehicleId, ServiceStatus[]> — flatten it.
        const vName = new Map((vehicles || []).map((v: any) => [v.id, v.name]));
        if (serviceStatuses && typeof serviceStatuses.forEach === 'function') {
            serviceStatuses.forEach((list: any[], vehicleId: string) => {
                (list || []).forEach((s: any, i: number) => {
                    if (s.status === 'Overdue') {
                        add(`svc-${vehicleId}-${s.description || i}`, 'SERVICE', `${vName.get(vehicleId) || 'Vehicle'}: ${s.description} service overdue`, 'workshop');
                    }
                });
            });
        }

        const flagDoc = (id: string, label: string, date: string, view: ViewType) => {
            const days = differenceInDays(new Date(date), today);
            if (days <= 30) add(id, 'SERVICE', `${label} ${days < 0 ? 'has EXPIRED' : `expires in ${days} day${days === 1 ? '' : 's'}`}`, view);
        };

        (users || []).forEach((u: any) => {
            if (u.role !== 'Driver' && u.role !== 'Staff') return;
            if (u.licenseExpiry) flagDoc(`cmp-${u.email}-lic`, `${u.name}'s licence`, u.licenseExpiry, 'hr');
            if (u.pdpExpiry) flagDoc(`cmp-${u.email}-pdp`, `${u.name}'s PDP`, u.pdpExpiry, 'hr');
            if (u.medicalExpiry) flagDoc(`cmp-${u.email}-med`, `${u.name}'s medical`, u.medicalExpiry, 'hr');
        });

        (vehicleComplianceDocs || []).forEach((d: any) => {
            if (!d.expiryDate) return;
            const v = (vehicles || []).find((x: any) => x.id === d.vehicleId);
            flagDoc(`cmpv-${d.id}`, `${v ? v.name : 'Vehicle'} ${d.name || d.type}`, d.expiryDate, 'fleet');
        });

        // Loads assigned to a non-compliant subcontractor — allowed, but flagged
        // for management so they can chase the carrier's paperwork.
        const supById = new Map((suppliers || []).map((s: any) => [s.id, s]));
        (loadConfirmations || []).forEach((lc: any) => {
            if (!lc.supplierId) return;
            if (['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'].includes(lc.status)) return;
            const sup: any = supById.get(lc.supplierId);
            if (sup && sup.complianceStatus !== 'Compliant') {
                add(`noncomp-${lc.id}`, 'JOB_CARD', `Load ${lc.loadConNumber || ''} is on a NON-COMPLIANT carrier (${sup.name}) — chase paperwork`, 'operations');
            }
        });

        return alerts;
    }, [vehicles, jobCards, serviceStatuses, users, vehicleComplianceDocs, loadConfirmations, suppliers]);
};
