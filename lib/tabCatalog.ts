// Single catalogue of every section's sub-tabs, used by the admin "Tab Access" screen
// and by each portal to hide tabs per role/branch. Keys are namespaced `${section}:${view}`
// so the same view name in two sections (e.g. Broking "Dashboard" vs Fleet "Dashboard")
// can be controlled independently.

export interface TabDef { view: string; label: string; }
export interface TabSection { key: string; label: string; tabs: TabDef[]; }

export const TAB_SECTIONS: TabSection[] = [
    {
        key: 'broking', label: 'Broking', tabs: [
            { view: 'dashboard', label: 'Dashboard' },
            { view: 'loadBoard', label: 'Load Board' },
            { view: 'subcontractorLoads', label: 'LoadCons' },
            { view: 'driverChats', label: 'Driver Chats' },
            { view: 'deliveries', label: 'Deliveries / POD' },
            { view: 'transporterLoads', label: 'By Transporter' },
            { view: 'monthlyLoadcons', label: 'Month View' },
            { view: 'emailLog', label: 'Emails' },
            { view: 'docSettings', label: 'Doc Settings' },
        ],
    },
    {
        key: 'operations', label: 'Operations', tabs: [
            { view: 'opsDashboard', label: 'Daily Overview' },
            { view: 'opsDay', label: 'Day' },
            { view: 'opsManifests', label: 'Manifests' },
            { view: 'opsTripSheets', label: 'Trip Sheets' },
            { view: 'deliveries', label: 'Deliveries / POD' },
            { view: 'liveMap', label: 'Live Map' },
            { view: 'shipments', label: 'Shipments' },
            { view: 'imports', label: 'Imports' },
            { view: 'lclStatus', label: 'Status Report' },
            { view: 'containers', label: 'Containers' },
        ],
    },
    {
        key: 'accounts', label: 'Accounts', tabs: [
            { view: 'clients', label: 'Clients CRM' },
            { view: 'contacts', label: 'Marketing Contacts' },
            { view: 'comms', label: 'Comms & Marketing' },
            { view: 'transporters', label: 'Transporters' },
            { view: 'vetting', label: 'Compliance Vetting' },
            { view: 'onboarding', label: 'Supplier Onboarding' },
            { view: 'accountsPods', label: 'PODs (All)' },
            { view: 'finance', label: 'Invoicing / Debtors / Creditors' },
        ],
    },
    {
        key: 'workshop', label: 'Workshop', tabs: [
            { view: 'jobCards', label: 'Job Cards' },
            { view: 'servicePlanner', label: 'Service Planner' },
            { view: 'checklistReview', label: 'Checklist Review' },
            { view: 'checklistManagement', label: 'Checklist Management' },
            { view: 'tireManagement', label: 'Tyre Management' },
            { view: 'parts', label: 'Parts & Inventory' },
            { view: 'suppliers', label: 'Suppliers' },
        ],
    },
    {
        key: 'fleet', label: 'Fleet', tabs: [
            { view: 'dashboard', label: 'Dashboard' },
            { view: 'vehicles', label: 'Asset List' },
            { view: 'admin', label: 'Asset Admin' },
            { view: 'drivers', label: 'Drivers' },
            { view: 'maintenance', label: 'Maintenance' },
            { view: 'fleetMap', label: 'Live Map' },
            { view: 'routePlanner', label: 'Route Planner' },
            { view: 'operationsLog', label: 'Operations Log' },
        ],
    },
];

export const tabKey = (section: string, view: string) => `${section}:${view}`;
