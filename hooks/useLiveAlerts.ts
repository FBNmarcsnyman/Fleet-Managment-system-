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
