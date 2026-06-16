
import {
  User,
  Vehicle,
  FuelEntry,
  ServiceEntry,
  OtherCost,
  RecurringCost,
  RevenueEntry,
  ServiceInterval,
  PlannedService,
  FuelPriceRecord,
  Bowser,
  BowserRefill,
  JobCard,
  ChecklistTemplate,
  ChecklistItemTemplate,
  ChecklistSubmission,
  Tire,
  TireInspection,
  Part,
  PurchaseRequest,
  PurchaseOrder,
  HRCase,
  Client,
  Supplier,
  Quote,
  LoadConfirmation,
  Manifest,
  TripSheet,
  IncidentReport,
  Notification,
  Budget,
  Forecast,
  Permission,
  SupplierApplication,
  Message
} from './types';
import { addDays, subDays, format } from 'date-fns';
import { LIGHT_DUTY_CHECKLIST, HEAVY_DUTY_RIGID_CHECKLIST, TRUCK_TRACTOR_CHECKLIST, TRAILER_CHECKLIST, FORKLIFT_CHECKLIST, SPOT_CHECK_CHECKLIST } from './constants';

const PERMISSIONS_CONFIG: { [key in User['role']]: Permission[] } = {
    'Super Admin': ['access_management', 'access_fleet', 'access_operations', 'access_workshop', 'access_finance', 'access_incidents', 'access_hr', 'access_user_management', 'access_settings'],
    'Admin': ['access_management', 'access_fleet', 'access_operations', 'access_workshop', 'access_finance', 'access_incidents', 'access_hr', 'access_user_management', 'access_settings'],
    'Workshop Manager': ['access_workshop', 'access_fleet'],
    'Accounts': ['access_finance', 'access_operations', 'access_management'],
    'Ops': ['access_operations', 'access_fleet', 'access_incidents'],
    'Staff': [],
    'Driver': [],
    'Client': [],
    'Supplier': [],
};

export const mockUsers: User[] = [
    { name: 'Alice Admin', email: 'alice@fbn.com', role: 'Super Admin', permissions: PERMISSIONS_CONFIG['Super Admin'], assignedBranches: ['FBN JHB', 'FBN DBN', 'FBN CPT', 'LOADMASTER'] },
    { name: 'Bob Workshop', email: 'bob@fbn.com', role: 'Workshop Manager', permissions: PERMISSIONS_CONFIG['Workshop Manager'], assignedBranches: ['FBN JHB'] },
    { name: 'Charlie Driver', email: 'charlie@fbn.com', role: 'Driver', permissions: PERMISSIONS_CONFIG['Driver'], assignedBranches: ['FBN JHB'], assignedVehicleIds: ['v1'], licenseNumber: '123456789', licenseExpiry: format(addDays(new Date(), 365), 'yyyy-MM-dd'), pdpExpiry: format(addDays(new Date(), 180), 'yyyy-MM-dd') },
    { name: 'David Driver', email: 'david@fbn.com', role: 'Driver', permissions: PERMISSIONS_CONFIG['Driver'], assignedBranches: ['FBN DBN'], assignedVehicleIds: ['v3'], licenseNumber: '987654321', licenseExpiry: format(addDays(new Date(), 25), 'yyyy-MM-dd'), pdpExpiry: format(addDays(new Date(), 400), 'yyyy-MM-dd') },
    { name: 'Major Retail Co', email: 'eve@client.com', role: 'Client', permissions: PERMISSIONS_CONFIG['Client'], assignedBranches: [], clientId: 'c1' },
    { name: 'Super Subcontractors', email: 'frank@supplier.com', role: 'Supplier', permissions: PERMISSIONS_CONFIG['Supplier'], assignedBranches: [], supplierId: 's1' },
];

export const mockVehicles: Vehicle[] = [
    { id: 'v1', name: 'JHB-TRUCK-01', make: 'Scania', model: 'R 460', year: 2021, registration: 'JHB 01 GP', vin: 'VIN001', branch: 'FBN JHB', weightCategory: 'Horse', status: 'On the road', purchasePrice: 1800000, currentValue: 1500000, currentOdometer: 121500, currentHours: 2500, assignedDriverId: 'charlie@fbn.com' },
    { id: 'v2', name: 'JHB-TRUCK-02', make: 'Mercedes-Benz', model: 'Actros', year: 2022, registration: 'JHB 02 GP', vin: 'VIN002', branch: 'FBN JHB', weightCategory: 'Horse', status: 'In for service', purchasePrice: 2100000, currentValue: 1900000, currentOdometer: 95000, currentHours: 1800 },
    { id: 'v3', name: 'DBN-RIGID-01', make: 'Isuzu', model: 'NPR 400', year: 2020, registration: 'DBN 01 KZN', vin: 'VIN003', branch: 'FBN DBN', weightCategory: '8 TONNER', status: 'On the road', purchasePrice: 750000, currentValue: 600000, currentOdometer: 85200, assignedDriverId: 'david@fbn.com' },
    { id: 'v4', name: 'JHB-TRAILER-01', make: 'Henred Fruehauf', model: 'Superlink', year: 2021, registration: 'JHB T01 GP', vin: 'VIN004', branch: 'FBN JHB', weightCategory: 'Superlink Trailer', status: 'On the road', purchasePrice: 600000, currentValue: 500000, currentOdometer: 240000, linkedVehicleId: 'v1' },
];

export const fuelEntries: FuelEntry[] = [
    { id: 'f1', vehicleId: 'v1', date: subDays(new Date(), 5).toISOString(), odometer: 120500, liters: 450 },
    { id: 'f2', vehicleId: 'v1', date: subDays(new Date(), 2).toISOString(), odometer: 121500, liters: 480, tripDistance: 1000 },
    { id: 'f3', vehicleId: 'v3', date: subDays(new Date(), 3).toISOString(), odometer: 85000, liters: 120 },
];

export const serviceEntries: ServiceEntry[] = [
    { id: 's1', vehicleId: 'v1', date: subDays(new Date(), 60).toISOString(), startOdometer: 110000, endOdometer: 110000, description: 'Major Service', cost: 15000 },
];

export const otherCosts: OtherCost[] = [
    { id: 'oc1', vehicleId: 'v1', date: '2023-10', category: 'Tolls', amount: 3500 },
];

export const recurringCosts: RecurringCost[] = [
    { id: 'rc1', vehicleId: 'v1', category: 'Insurance', amount: 4000, frequency: 'monthly', startDate: '2022-01-01', endDate: null },
];

export const revenueEntries: RevenueEntry[] = [
    { id: 'rev1', vehicleId: 'v1', date: subDays(new Date(), 10).toISOString(), description: 'Load to CPT', amount: 35000 },
];

export const serviceIntervals: ServiceInterval[] = [
    { id: 'si1', vehicleId: 'v1', description: 'Minor Service', distanceInterval: 20000, timeIntervalDays: null, hoursInterval: null },
    { id: 'si2', vehicleId: 'v1', description: 'Major Service', distanceInterval: 60000, timeIntervalDays: null, hoursInterval: null },
    { id: 'si3', vehicleId: 'v3', description: 'Standard Service', distanceInterval: 15000, timeIntervalDays: 180, hoursInterval: null },
];

export const jobCards: JobCard[] = [
    { id: 'jc1', vehicleId: 'v2', itemDescription: 'Replace front left headlight', reportedDate: subDays(new Date(), 3).toISOString(), type: 'Repair', status: 'Awaiting Parts', priority: 'High', severity: 'Medium', reporterNotes: 'Bulb has blown.' },
];

export const clients: Client[] = [
    { id: 'c1', name: 'Major Retail Co', contactPerson: 'John Smith', contactEmail: 'john@retail.com', contactPhone: '0111234567', address: '123 Retail St, Sandton', slaLevel: 'Premium' },
];

export const suppliers: Supplier[] = [
    /* Fix: Added missing required properties 'complianceDocs' and 'rateCards' to mock suppliers */
    { id: 's1', name: 'Super Subcontractors', type: 'Transport', contactPerson: 'Sue Storm', contactEmail: 'sue@super.com', contactPhone: '0311234567', address: '1 Carrier Ave, Durban', averageRating: 4.5, complianceStatus: 'Compliant', complianceDocs: [], rateCards: [] },
    { id: 's2', name: 'Parts R Us', type: 'Workshop', contactPerson: 'Peter Parker', contactEmail: 'peter@parts.com', contactPhone: '0119876543', address: '2 Component Cres, JHB', complianceStatus: 'Compliant', complianceDocs: [], rateCards: [] },
];

export const quotes: Quote[] = [
    // Fix: Add missing required property 'subcontractorQuotes'
    { id: 'q1', quoteNumber: 'QU-1001', clientId: 'c1', date: subDays(new Date(), 5).toISOString(), expiryDate: addDays(new Date(), 2).toISOString(), items: [], legs: [], totalAmount: 25000, status: 'Accepted', sentToClient: true, subcontractorQuotes: [] },
];

export const loadConfirmations: LoadConfirmation[] = [
    { id: 'lc1', loadConNumber: 'LCN-1001', quoteId: 'q1', clientId: 'c1', date: subDays(new Date(), 4).toISOString(), items: [], legs: [], totalAmount: 25000, collectionBranch: 'FBN JHB', destinationBranch: 'FBN DBN', priority: 'High', status: 'Booked', collectionPoint: 'JHB Warehouse', deliveryPoint: 'DBN Port' },
];

const photoRequiredRegex = /condition|tire|mirror|light|window|panel|body|tape|windscreen|crack|dent|leak/i;

const createChecklistItems = (checklistObject: { [key: string]: string[] }, templateIdPrefix: string): ChecklistItemTemplate[] => {
    return Object.values(checklistObject)
        .flat()
        .map((label, index) => ({
            id: `${templateIdPrefix}-item-${index}`,
            label,
            requiresPhotoOnFail: photoRequiredRegex.test(label)
        }));
};

export const checklistTemplates: ChecklistTemplate[] = [
    {
        id: 'clt-ldv',
        name: 'Light Duty Vehicle Checklist',
        items: createChecklistItems(LIGHT_DUTY_CHECKLIST, 'clt-ldv')
    },
    {
        id: 'clt-hdr',
        name: 'Heavy Duty Rigid Checklist',
        items: createChecklistItems(HEAVY_DUTY_RIGID_CHECKLIST, 'clt-hdr')
    },
    {
        id: 'clt-tt',
        name: 'Heavy Duty Truck-Tractor Checklist',
        items: createChecklistItems(TRUCK_TRACTOR_CHECKLIST, 'clt-tt')
    },
    {
        id: 'clt-trl',
        name: 'Trailer Checklist',
        items: createChecklistItems(TRAILER_CHECKLIST, 'clt-trl')
    },
    {
        id: 'clt-fl',
        name: 'Forklift Checklist',
        items: createChecklistItems(FORKLIFT_CHECKLIST, 'clt-fl')
    },
    {
        id: 'clt-sc',
        name: "Manager's Spot Check",
        items: createChecklistItems(SPOT_CHECK_CHECKLIST, 'clt-sc')
    }
];

export const mockMessages: Message[] = [
    { id: 'm1', vehicleId: 'v1', userId: 'charlie@fbn.com', userName: 'Charlie Driver', timestamp: subDays(new Date(), 1).toISOString(), text: 'Heads up, there is a rattling noise coming from the front left wheel when going over bumps.' },
    { id: 'm2', vehicleId: 'v1', userId: 'alice@fbn.com', userName: 'Alice Admin', timestamp: new Date().toISOString(), text: 'Roger that, Charlie. Please create a job card for it when you get a chance.' },
    { id: 'm3', vehicleId: 'v3', userId: 'david@fbn.com', userName: 'David Driver', timestamp: subDays(new Date(), 2).toISOString(), text: 'Just completed the delivery to MegaMart.' },
];

export const supplierApplications: SupplierApplication[] = [];
export const plannedServices: PlannedService[] = [];
export const fuelPriceRecords: FuelPriceRecord[] = [{ id: 'fp1', startDate: subDays(new Date(), 10).toISOString(), pricePerLiter: 23.50 }];
export const bowsers: Bowser[] = [
    { id: 'b1', name: 'JHB Bowser', capacity: 23000, currentStock: 15250 },
    { id: 'b2', name: 'DBN Bowser', capacity: 23000, currentStock: 18100 },
];
export const bowserRefills: BowserRefill[] = [];
export const checklistSubmissions: ChecklistSubmission[] = [];
export const tires: Tire[] = [];
export const tireInspections: TireInspection[] = [];
export const parts: Part[] = [];
export const purchaseRequests: PurchaseRequest[] = [];
export const purchaseOrders: PurchaseOrder[] = [];
export const hrCases: HRCase[] = [];
export const manifests: Manifest[] = [];
export const tripSheets: TripSheet[] = [];
export const incidentReports: IncidentReport[] = [];
export const notifications: Notification[] = [];
export const budgets: Budget[] = [];
export const forecasts: Forecast[] = [];
export const messages: Message[] = mockMessages;
