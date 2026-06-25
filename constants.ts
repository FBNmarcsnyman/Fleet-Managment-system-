
import { Branch, VehicleStatus } from './types';

export const BRANCHES: Branch[] = ['FBN JHB', 'FBN DBN', 'FBN CPT', 'LOADMASTER'];

// Weight categories used in AddVehicleForm dropdowns and the FleetAssetAdmin
// inline editor. Order roughly follows operational priority (prime movers
// first, trailers in the middle, misc at the end).
// Trailer types changed 2026-06: Marc dropped the generic "Standard Trailer"
// and split into Triaxle (5 length variants from 13m to 15m) and Skeleton
// (6m and 12m for superlink pairs). Superlink Trailer kept as a separate
// option for legacy/other configurations.
export const VEHICLE_CATEGORIES: string[] = [
    'Horse',
    'Triaxle 13m',
    'Triaxle 13.5m',
    'Triaxle 14m',
    'Triaxle 14.5m',
    'Triaxle 15m',
    'Skeleton 6m',
    'Skeleton 12m',
    'Superlink Trailer',
    '8 TONNER',
    '12 TONNER',
    '15 TONNER',
    '1 TONNER',
    '2 TONNER',
    'BAKKIE',
    'Forklift',
    'Other',
];

// Logical groupings used by Asset Admin tabs. Each maps to the categories
// that should show under that group filter.
export const VEHICLE_CATEGORY_GROUPS: { label: string; categories: string[] }[] = [
    { label: 'Horses', categories: ['Horse'] },
    { label: 'Trailers', categories: ['Triaxle 13m', 'Triaxle 13.5m', 'Triaxle 14m', 'Triaxle 14.5m', 'Triaxle 15m', 'Skeleton 6m', 'Skeleton 12m', 'Superlink Trailer'] },
    { label: 'Rigids', categories: ['15 TONNER', '12 TONNER', '8 TONNER', '2 TONNER', '1 TONNER'] },
    { label: 'Bakkies', categories: ['BAKKIE'] },
    { label: 'Other', categories: ['Forklift', 'Other'] },
];

export const VEHICLE_STATUSES: VehicleStatus[] = [
    'On the road',
    'In for service',
    'Off the road',
    'Sold',
];

// Display order for the Asset List when grouped by category.
// Marc's rule: motorized prime movers + rigids on top, trailers below,
// misc at the bottom. Anything not in this list falls to the end.
export const CATEGORY_ORDER: string[] = [
    'Horse',
    '15 TONNER',
    '12 TONNER',
    '8 TONNER',
    '2 TONNER',
    '1 TONNER',
    'BAKKIE',
    'Skeleton 6m',
    'Skeleton 12m',
    'Triaxle 13m',
    'Triaxle 13.5m',
    'Triaxle 14m',
    'Triaxle 14.5m',
    'Triaxle 15m',
    'Superlink Trailer',
    'Forklift',
    'Other',
];

export const DEFAULT_COST_CATEGORIES = [
    'Tolls',
    'Driver Salary',
    'Insurance',
    'Licensing',
    'Repairs & Maintenance',
    'Tracking',
];

export const COMMODITIES = [
    'General Cargo',
    'FMCG',
    'Electronics',
    'Perishables',
    'Construction Materials',
    'Hazchem',
    'Automotive Parts',
    'Furniture',
    'Agriculture',
    'Industrial Machinery'
];

export const PACKAGING_TYPES = [
    'Pallets',
    'IBCs',
    'Drums',
    'Crates',
    'Bags/Sacks',
    'Loose/Bulk',
    'Bundles',
    'Rolls',
    'Cartons'
];

export const LOAD_SPECS = [
    'Dedicated',
    'Consolidated',
    'LCL / Part Load',
    'Superlink (34t)',
    'Tri-Axle (28t)',
    '15t',
    '12t',
    '8t',
    '5t',
    '2t',
    'Tautliner',
    'Flat Deck',
    '1m Deck',
    '3m Deck',
    '6m Rigid',
    '8m Rigid',
    '12m Flatbed',
    'Link',
    '6m Container',
    '12m Container',
    'Tanker',
    'Lowbed',
    'Side Tipper',
    'Dropside',
    'Refrigerated',
];

export const NOTIFICATION_TRIGGERS = [
    { key: 'new_critical_job', label: 'New Critical Job Card Created' },
    { key: 'service_overdue', label: 'Vehicle Service Becomes Overdue' },
    { key: 'stock_low', label: 'Inventory Part Reaches Reorder Level' },
    { key: 'purchase_approval', label: 'Purchase Request Awaiting Approval' },
];

// Checklist items
export const LIGHT_DUTY_CHECKLIST = {
    exteriorChecks: [
        "Body & Paintwork Condition",
        "Windscreen & Windows Condition",
        "Wiper Blades Condition",
        "Mirrors Condition & Security",
        "Lights & Indicators Function",
        "Tires & Wheels Condition",
        "License Disc Validity",
    ],
    interiorChecks: [
        "Seatbelts Function",
        "Hooter Function",
        "Brakes & Handbrake Function",
        "Gauges & Warning Lights",
        "Fire Extinguisher Presence & Date",
        "First Aid Kit Presence",
    ],
    underBonnetChecks: [
        "Engine Oil Level",
        "Coolant Level",
        "Brake Fluid Level",
        "Windscreen Washer Fluid Level",
        "Battery Security",
        "Visible Leaks",
    ]
};

export const HEAVY_DUTY_RIGID_CHECKLIST = {
    ...LIGHT_DUTY_CHECKLIST,
    heavyDutyChecks: [
        "Air Tanks Drained",
        "Suspension Condition",
        "Fifth Wheel & Kingpin Security",
        "Chevrons & Reflective Tape",
        "Load Body / Tarp Condition",
    ]
};

export const TRUCK_TRACTOR_CHECKLIST = HEAVY_DUTY_RIGID_CHECKLIST; // Alias for now

export const TRAILER_CHECKLIST = {
    trailerExterior: [
        "Body & Paintwork",
        "Chassis & Frame",
        "Landing Legs",
        "Lights & Reflectors",
        "License Disc & Number Plate",
        "Chevrons & Reflective Tape",
    ],
    trailerRunningGear: [
        "Tires & Wheels Condition",
        "Brake System (inc. Susie pipes)",
        "Suspension (Airbags/Springs)",
    ]
};

export const FORKLIFT_CHECKLIST = {
    preOpChecks: [
        "General Condition & Cleanliness",
        "Tires Condition",
        "Forks & Mast Condition",
        "Chains & Hoses Condition",
        "Hydraulic Fluid Level",
        "Battery Level / Fuel Level",
        "Visible Leaks",
    ],
    operationalChecks: [
        "Horn Function",
        "Lights & Strobe Function",
        "Brakes & Park Brake Function",
        "Steering Function",
        "Lift, Lower & Tilt Function",
        "Gauges & Warning Lights",
    ]
};

export const SPOT_CHECK_CHECKLIST = {
    driverCompliance: [
        "Driver's License & PDP Validity",
        "Driver's Appearance (Uniform)",
        "Driver's Fitness for Duty",
    ],
    vehicleCondition: [
        "Overall Vehicle Cleanliness",
        "Tire Condition (Visual)",
        "Any Obvious New Damage",
    ],
    documentation: [
        "Correct Paperwork for Load",
        "Fire Extinguisher & First Aid Kit",
        "License Disc Validity",
    ]
};
