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

// A child inside a collapsible nav group. It opens a portal (`view`) and, for
// portals with internal sub-tabs, deep-links to a specific sub-view.
export type NavChild = { view: ViewType; subView: string; label: string };
export type NavGroup = { key: string; label: string; icon: React.ElementType; permission: Permission; children: NavChild[] };

// The primary portals shown in the sidebar, in their default order.
export const ALL_NAV_ITEMS: NavItem[] = [
    { view: 'management', label: 'Management', icon: DashboardIcon, permission: 'access_management' },
    { view: 'fleet', label: 'FBN Fleet', icon: CarIcon, permission: 'access_fleet' },
    { view: 'fuel', label: 'Fuel', icon: FuelIcon, permission: 'access_fuel' },
    { view: 'partners', label: 'Clients & Subbies', icon: UsersIcon, permission: 'access_operations' },
    { view: 'quotes', label: 'Quotes', icon: CurrencyDollarIcon, permission: 'access_operations' },
    { view: 'workshop', label: 'Workshop', icon: WorkshopIcon, permission: 'access_workshop' },
    { view: 'finance', label: 'Finance', icon: CurrencyDollarIcon, permission: 'access_finance' },
    { view: 'incidentManagement', label: 'Incidents', icon: ExclamationTriangleIcon, permission: 'access_incidents' },
    { view: 'hr', label: 'HR', icon: BriefcaseIcon, permission: 'access_hr' },
];

// Collapsible groups — Broking (brokered freight) and Operations (own
// consolidation / line-haul). Both render through the Operations portal but
// land on different sub-views, so each business reads as its own area with its
// own dashboard. Keep these sub-view strings in sync with OperationsPortal.
export const NAV_GROUPS: NavGroup[] = [
    {
        key: 'broking', label: 'Broking', icon: DocumentTextIcon, permission: 'access_operations',
        children: [
            { view: 'operations', subView: 'dashboard', label: 'Dashboard' },
            { view: 'operations', subView: 'loadBoard', label: 'Load Board' },
            { view: 'operations', subView: 'subcontractorLoads', label: 'LoadCons' },
            { view: 'operations', subView: 'emailLog', label: 'Emails' },
            { view: 'operations', subView: 'driverChats', label: 'Driver Chats' },
            { view: 'operations', subView: 'docSettings', label: 'Doc Settings' },
        ],
    },
    {
        key: 'operations', label: 'Operations', icon: TruckIcon, permission: 'access_operations',
        children: [
            { view: 'operations', subView: 'opsDashboard', label: 'Dashboard' },
            { view: 'operations', subView: 'shipments', label: 'Shipments' },
            { view: 'operations', subView: 'containers', label: 'Containers' },
        ],
    },
];

// Sub-views that belong to the Operations (consolidation) side; everything else
// in the Operations portal is Broking. Used to highlight the right group and to
// pick which in-portal tab strip to show.
export const OPS_SUBVIEWS = ['opsDashboard', 'shipments', 'containers'];

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
