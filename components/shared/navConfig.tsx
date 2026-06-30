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

// A clickable destination. `subView` deep-links to an in-portal tab (e.g. the
// Accounts > Transporters child opens the Partners portal on its subbie tab).
// `altPermission` lets restricted (loadcons-only) operators still see an item.
// `badgeKey` flags where a live count badge should render.
export type NavItem = { view: ViewType; label: string; icon: React.ElementType; permission: Permission; altPermission?: Permission; subView?: string; badgeKey?: string };
// A collapsible parent that groups related destinations under one heading.
export type NavGroup = { kind: 'group'; key: string; label: string; icon: React.ElementType; children: NavItem[] };
export type NavEntry = NavItem | NavGroup;
export const isGroup = (e: NavEntry): e is NavGroup => (e as NavGroup).kind === 'group';

// The primary sidebar, grouped. Operations (own line-haul = FBN) and Broking
// (brokered freight) are two areas of ONE portal, now nested under Operations.
// Accounts gathers the people + money side (clients, transporters, the master
// POD list, invoicing). FBN Fleet holds the asset register + compliance docs.
export const ALL_NAV_ENTRIES: NavEntry[] = [
    { view: 'management', label: 'Management', icon: DashboardIcon, permission: 'access_management' },
    {
        kind: 'group', key: 'operations', label: 'Operations', icon: TruckIcon, children: [
            { view: 'operations', label: 'FBN', icon: TruckIcon, permission: 'access_operations', altPermission: 'access_loadcons', badgeKey: 'operations' },
            { view: 'broking', label: 'Broking', icon: DocumentTextIcon, permission: 'access_operations', altPermission: 'access_loadcons', badgeKey: 'broking' },
        ],
    },
    { view: 'quotes', label: 'Quotes', icon: CurrencyDollarIcon, permission: 'access_operations' },
    { view: 'fuel', label: 'Fuel', icon: FuelIcon, permission: 'access_fuel' },
    {
        kind: 'group', key: 'fleet', label: 'FBN Fleet', icon: CarIcon, children: [
            { view: 'fleet', label: 'Assets & Maintenance', icon: CarIcon, permission: 'access_fleet' },
            { view: 'compliance', label: 'Compliance', icon: DocumentTextIcon, permission: 'access_hr' },
        ],
    },
    {
        kind: 'group', key: 'accounts', label: 'Accounts', icon: UsersIcon, children: [
            { view: 'partners', label: 'Clients', icon: UsersIcon, permission: 'access_operations' },
            { view: 'transporters', label: 'Transporters', icon: TruckIcon, permission: 'access_operations' },
            { view: 'accountsPods', label: 'PODs (All)', icon: DocumentTextIcon, permission: 'access_operations' },
            { view: 'finance', label: 'Invoicing / Debtors / Creditors', icon: CurrencyDollarIcon, permission: 'access_finance' },
        ],
    },
    { view: 'workshop', label: 'Workshop', icon: WorkshopIcon, permission: 'access_workshop' },
    { view: 'hr', label: 'HR', icon: BriefcaseIcon, permission: 'access_hr' },
    { view: 'incidentManagement', label: 'Claims / Incidents', icon: ExclamationTriangleIcon, permission: 'access_incidents' },
];

// Flattened leaves (groups expanded) — for screens that work per-destination,
// e.g. the Settings "show/hide & reorder my tabs" preference editor.
export const ALL_NAV_ITEMS: NavItem[] = ALL_NAV_ENTRIES.flatMap(e => isGroup(e) ? e.children : [e]);

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
    collectHome: 'Collections',
    fleet: 'FBN Fleet',
    fuel: 'Fuel',
    broking: 'Broking',
    operations: 'Operations',
    partners: 'Clients',
    transporters: 'Transporters',
    quotes: 'Quotes',
    workshop: 'Workshop',
    finance: 'Invoicing / Debtors / Creditors',
    accountsPods: 'PODs — All',
    incidentManagement: 'Claims / Incidents',
    hr: 'Human Resources',
    compliance: 'Compliance & Documents',
    userManagement: 'User Management',
    settings: 'Settings',
    driverDashboard: 'Driver Dashboard',
};
