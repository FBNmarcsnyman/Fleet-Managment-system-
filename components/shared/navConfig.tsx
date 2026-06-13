import React from 'react';
import { Permission, ViewType } from '../../types';
import { CarIcon } from '../icons/CarIcon';
import { DashboardIcon } from '../icons/DashboardIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { WorkshopIcon } from '../icons/WorkshopIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { CurrencyDollarIcon } from '../icons/CurrencyDollarIcon';

export type NavItem = { view: ViewType; label: string; icon: React.ElementType; permission: Permission };

// The primary portals shown in the sidebar, in their default order.
export const ALL_NAV_ITEMS: NavItem[] = [
    { view: 'management', label: 'Management', icon: DashboardIcon, permission: 'access_management' },
    { view: 'fleet', label: 'Fleet', icon: CarIcon, permission: 'access_fleet' },
    { view: 'operations', label: 'Operations', icon: DocumentTextIcon, permission: 'access_operations' },
    { view: 'workshop', label: 'Workshop', icon: WorkshopIcon, permission: 'access_workshop' },
    { view: 'finance', label: 'Finance', icon: CurrencyDollarIcon, permission: 'access_finance' },
    { view: 'incidentManagement', label: 'Incidents', icon: ExclamationTriangleIcon, permission: 'access_incidents' },
    { view: 'hr', label: 'HR', icon: BriefcaseIcon, permission: 'access_hr' },
];

// Admin / setup items, shown at the foot of the sidebar.
export const SETTINGS_NAV_ITEMS: NavItem[] = [
    { view: 'userManagement', label: 'Users', icon: UsersIcon, permission: 'access_user_management' },
    { view: 'settings', label: 'Settings', icon: SettingsIcon, permission: 'access_settings' },
];

// Human-friendly title for the current view — shown in the top bar.
export const VIEW_TITLES: Partial<Record<ViewType, string>> = {
    management: 'Management Overview',
    fleet: 'Fleet',
    operations: 'Operations',
    workshop: 'Workshop',
    finance: 'Finance',
    incidentManagement: 'Incident Management',
    hr: 'Human Resources',
    userManagement: 'User Management',
    settings: 'Settings',
    driverDashboard: 'Driver Dashboard',
};
