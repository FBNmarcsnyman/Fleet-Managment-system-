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
import { FuelIcon } from '../icons/FuelIcon';
import { TruckIcon } from '../icons/TruckIcon';

export type NavItem = { view: ViewType; label: string; icon: React.ElementType; permission: Permission };

// The primary portals shown in the sidebar, in their default order. Broking
// (brokered freight) and Operations (own consolidation / line-haul) are two
// flat tabs that both open the Operations portal; the portal shows the matching
// area's tab strip + its own dashboard, keyed off the current view.
export const ALL_NAV_ITEMS: NavItem[] = [
    { view: 'management', label: 'Management', icon: DashboardIcon, permission: 'access_management' },
    { view: 'fleet', label: 'FBN Fleet', icon: CarIcon, permission: 'access_fleet' },
    { view: 'fuel', label: 'Fuel', icon: FuelIcon, permission: 'access_fuel' },
    { view: 'broking', label: 'Broking', icon: DocumentTextIcon, permission: 'access_operations' },
    { view: 'operations', label: 'Operations', icon: TruckIcon, permission: 'access_operations' },
    { view: 'partners', label: 'Clients & Subbies', icon: UsersIcon, permission: 'access_operations' },
    { view: 'quotes', label: 'Quotes', icon: CurrencyDollarIcon, permission: 'access_operations' },
    { view: 'workshop', label: 'Workshop', icon: WorkshopIcon, permission: 'access_workshop' },
    { view: 'finance', label: 'Finance', icon: CurrencyDollarIcon, permission: 'access_finance' },
    { view: 'incidentManagement', label: 'Incidents', icon: ExclamationTriangleIcon, permission: 'access_incidents' },
    { view: 'hr', label: 'HR', icon: BriefcaseIcon, permission: 'access_hr' },
];

// Sub-views (in-portal tabs) that belong to the Operations (consolidation) side.
// Everything else in the Operations portal is Broking.
export const OPS_SUBVIEWS = ['opsDashboard', 'shipments', 'imports', 'containers'];

// Admin / setup items, shown at the foot of the sidebar.
export const SETTINGS_NAV_ITEMS: NavItem[] = [
    { view: 'userManagement', label: 'Users', icon: UsersIcon, permission: 'access_user_management' },
    { view: 'settings', label: 'Settings', icon: SettingsIcon, permission: 'access_settings' },
];

// Human-friendly title for the current view — shown in the top bar.
export const VIEW_TITLES: Partial<Record<ViewType, string>> = {
    management: 'Management Overview',
    fleet: 'FBN Fleet',
    fuel: 'Fuel',
    broking: 'Broking',
    operations: 'Operations',
    partners: 'Clients & Subcontractors',
    quotes: 'Quotes',
    workshop: 'Workshop',
    finance: 'Finance',
    incidentManagement: 'Incident Management',
    hr: 'Human Resources',
    userManagement: 'User Management',
    settings: 'Settings',
    driverDashboard: 'Driver Dashboard',
};
