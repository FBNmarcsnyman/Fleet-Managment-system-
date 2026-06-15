import { LoadConfirmation, LoadConfirmationStatus } from '../types';

// ---------------------------------------------------------------------------
// Load lifecycle engine.
//
// Two journeys:
//  • DIRECT (dedicated / full load, same branch): collect → run → deliver.
//  • DEPOT  (consolidated load, OR a load that moves between two FBN branches):
//    collect → origin depot check → inter-depot linehaul → destination depot →
//    unload → load for delivery → deliver.
// ---------------------------------------------------------------------------

// Consolidated / part / groupage load (shares a vehicle, routes via depots).
export const isConsolidated = (lc: LoadConfirmation): boolean => {
    const s = `${lc.loadSpec || ''} ${lc.loadType || ''}`.toLowerCase();
    return /consol|lcl|part|groupage/.test(s);
};

// Does this load run through depots? Yes when it's consolidated, or when it
// moves between two different FBN branches (inter-depot linehaul / cross-dock).
export const usesDepotRoute = (lc: LoadConfirmation): boolean => {
    if (isConsolidated(lc)) return true;
    return !!(lc.collectionBranch && lc.destinationBranch && lc.collectionBranch !== lc.destinationBranch);
};

const DIRECT_FLOW: LoadConfirmationStatus[] = [
    'Booked', 'Driver Assigned', 'At Collection Point', 'Loading', 'Collected', 'In Transit', 'Delivered', 'POD Submitted',
];
const DEPOT_FLOW: LoadConfirmationStatus[] = [
    'Booked', 'Driver Assigned', 'At Collection Point', 'Loading', 'Collected',
    'At Collection Depot', 'In Transit', 'At Destination Depot', 'Unloaded', 'Out for Delivery', 'Delivered', 'POD Submitted',
];

export const stageFlow = (lc: LoadConfirmation): LoadConfirmationStatus[] =>
    usesDepotRoute(lc) ? DEPOT_FLOW : DIRECT_FLOW;

// Friendly status names shown as the load's current state.
export const STATUS_LABEL: Record<LoadConfirmationStatus, string> = {
    'Booked': 'Unassigned',
    'Driver Assigned': 'Assigned',
    'At Collection Point': 'Arrived to load',
    'Loading': 'Loading',
    'Collected': 'Loaded / collected',
    'At Collection Depot': 'At origin depot (checking)',
    'In Transit': 'In transit',
    'At Destination Depot': 'At destination depot',
    'Unloaded': 'Unloaded at depot',
    'Out for Delivery': 'Out for delivery',
    'Delivered': 'Delivered',
    'POD Submitted': 'POD submitted',
    'Invoiced': 'Invoiced',
    'Cancelled': 'Cancelled',
};

// The action verb for the button that MOVES a load INTO each status.
const ADVANCE_LABEL: Partial<Record<LoadConfirmationStatus, string>> = {
    'At Collection Point': 'Arrived to load',
    'Loading': 'Start loading',
    'Collected': 'Mark loaded',
    'At Collection Depot': 'Arrived at depot',
    'In Transit': 'Dispatch',
    'At Destination Depot': 'Arrived at dest. depot',
    'Unloaded': 'Unloaded',
    'Out for Delivery': 'Load for delivery',
    'Delivered': 'Mark delivered',
};

const TERMINAL = new Set<LoadConfirmationStatus>(['Delivered', 'POD Submitted', 'Invoiced', 'Cancelled']);

// The next status in this load's journey, plus the button label to get there.
// Returns null at/after delivery (POD is handled by its own control) or when the
// load still needs a transporter (assignment comes first).
export const nextStep = (lc: LoadConfirmation): { status: LoadConfirmationStatus; label: string } | null => {
    if (!isAssigned(lc) && lc.status === 'Booked') return null; // assign first
    const flow = stageFlow(lc);
    const i = flow.indexOf(lc.status);
    if (i < 0 || i >= flow.length - 1) return null;
    const next = flow[i + 1];
    if (next === 'POD Submitted' || next === 'Delivered') {
        return next === 'Delivered' ? { status: 'Delivered', label: 'Mark delivered' } : null;
    }
    return { status: next, label: ADVANCE_LABEL[next] || `Mark ${STATUS_LABEL[next]}` };
};

export const isAssigned = (lc: LoadConfirmation): boolean => !!(lc.supplierId || lc.vehicleId);

// Which board owns the load right now.
const COLLECTION_STATUSES = new Set<LoadConfirmationStatus>(['Booked', 'Driver Assigned', 'At Collection Point', 'Loading', 'Collected', 'At Collection Depot']);
const DELIVERY_STATUSES = new Set<LoadConfirmationStatus>(['In Transit', 'At Destination Depot', 'Unloaded', 'Out for Delivery']);

export const isCollectionStage = (s: LoadConfirmationStatus) => COLLECTION_STATUSES.has(s);
export const isDeliveryStage = (s: LoadConfirmationStatus) => DELIVERY_STATUSES.has(s);
export const isTerminal = (s: LoadConfirmationStatus) => TERMINAL.has(s);

// True when the load crosses between two branches (shown as an incoming transfer
// on the receiving branch's delivery board).
export const isInterBranch = (lc: LoadConfirmation): boolean =>
    !!(lc.collectionBranch && lc.destinationBranch && lc.collectionBranch !== lc.destinationBranch);

// A colour hint for status chips (tailwind classes).
export const statusChip = (s: LoadConfirmationStatus): string => {
    if (s === 'Delivered' || s === 'POD Submitted' || s === 'Invoiced') return 'bg-emerald-900/40 text-emerald-300';
    if (s === 'Cancelled') return 'bg-red-900/40 text-red-300';
    if (s === 'In Transit') return 'bg-blue-900/40 text-blue-300';
    if (s === 'Booked') return 'bg-amber-900/40 text-amber-300';
    return 'bg-gray-700/60 text-gray-300';
};
