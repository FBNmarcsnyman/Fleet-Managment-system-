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
    const { vehicles = [], jobCards = [], serviceStatuses = [], users = [], vehicleComplianceDocs = [] } = useVehicles() as any;

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

        (serviceStatuses || []).filter((s: any) => s.status === 'Overdue')
            .forEach((s: any, i: number) => add(`svc-${s.vehicleId || ''}-${s.description || i}`, 'SERVICE', `Service overdue: ${s.description}`, 'workshop'));

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

        return alerts;
    }, [vehicles, jobCards, serviceStatuses, users, vehicleComplianceDocs]);
};
