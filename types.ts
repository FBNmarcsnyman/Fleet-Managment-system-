
// Fix: Resolve circular dependency by defining and exporting the Branch type here.
export type Branch = 'FBN JHB' | 'FBN DBN' | 'FBN CPT' | 'LOADMASTER';

export type WidgetType = 
  | 'ACTION_CENTER'
  | 'OPERATIONS_SUMMARY'
  | 'FINANCIAL_SUMMARY_STATS'
  | 'MONTHLY_FINANCIALS_CHART'
  | 'TIRE_STATUS_CHART'
  | 'TOP_PROFIT_VEHICLES'
  | 'JOB_PRIORITY_CHART'
  | 'OVERDUE_SERVICES_LIST'
  | 'FUEL_PRICE_TICKER'
  | 'BOWSER_STATUS'
  | 'FUEL_ANALYTICS'
  | 'COMPLIANCE_EXPIRY'
  | 'LOAD_PIPELINE'
  | 'SUBCONTRACTOR_MARGIN'
  | 'TOP_CLIENTS';

export interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  vin: string;
  branch: Branch;
  weightCategory: string;
  status: VehicleStatus;
  purchasePrice: number;
  currentValue: number;
  linkedVehicleId?: string;
  currentOdometer?: number;
  currentHours?: number;
  assignedDriverId?: string;
  healthScore?: number;
  palletSpaces?: number;
  payloadKg?: number;
  cubicMeters?: number;
  deckMeters?: number;
  costPerKmTarget?: number;
  monthlyFixedCost?: number;
}

export type VehicleStatus = 'On the road' | 'In for service' | 'Off the road' | 'Sold';

// A driver as an operational record — no login required. Seeded from the fleet
// list; used for dispatch allocation and POD/tracking comms via their cell.
export interface Driver {
  id: string;
  name: string;
  cell?: string;
  idNumber?: string;
  licenceNo?: string;
  licenceCode?: string;
  licenceExpiry?: string;
  pdpExpiry?: string;
  assignedVehicleId?: string;
  branch?: string;
  isActive: boolean;
  notes?: string;
  licenceDocUrl?: string;
}

export interface FuelEntry {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  liters: number;
  tripDistance?: number;
  sourceBowserId?: string; // Track which bowser was used, if any
}

export interface FuelEntryWithCost extends FuelEntry {
  cost: number;
}

export interface CalculatedFuelEntry extends FuelEntry {
    distance: number;
    consumption: number;
    cost: number;
    cpk: number;
}

export interface VehiclePerformanceStats {
    avgCpk: number;
    avgConsumption: number;
    latestOdo: number;
    points: number;          // number of valid consumption data points
    totalLitres: number;
    totalCost: number;
    totalDistance: number;
    bestConsumption: number; // lowest L/100km (most efficient fill)
    worstConsumption: number;// highest L/100km (least efficient fill)
}

export interface ServiceEntry {
    id: string;
    vehicleId: string;
    date: string;
    startOdometer: number;
    endOdometer: number;
    startHours?: number;
    endHours?: number;
    description: string;
    cost: number;
    attachment?: Attachment;
}

export interface OtherCost {
    id: string;
    vehicleId: string;
    date: string;
    category: string;
    amount: number;
}

export interface RecurringCost {
    id: string;
    vehicleId: string;
    category: string;
    amount: number;
    frequency: 'monthly' | 'annually';
    startDate: string;
    endDate: string | null;
}

export interface RevenueEntry {
    id: string;
    vehicleId: string;
    date: string;
    description: string;
    amount: number;
}

export interface ServiceInterval {
    id: string;
    vehicleId: string;
    description: string;
    distanceInterval: number | null;
    timeIntervalDays: number | null;
    hoursInterval: number | null;
}

export interface ServiceStatus {
    description: string;
    status: 'OK' | 'Due Soon' | 'Overdue';
    details: string;
}

export interface Message {
    id: string;
    vehicleId: string;
    userId: string;
    userName: string;
    timestamp: string;
    text: string;
}

export type Role = 'Staff' | 'Driver' | 'Admin' | 'Super Admin' | 'Client' | 'Supplier' | 'Workshop Manager' | 'Accounts' | 'Ops';

export interface User {
    id?: string;
    name: string;
    email: string;
    role: Role;
    permissions: Permission[];
    assignedBranches: Branch[];
    assignedVehicleIds?: string[];
    licenseNumber?: string;
    licenseExpiry?: string;
    pdpExpiry?: string;
    dgCertExpiry?: string;
    medicalExpiry?: string;
    inductionDate?: string;
    lastRefresherDate?: string;
    clientId?: string;
    supplierId?: string;
    navigationPreferences?: {
        order: ViewType[];
        hidden: ViewType[];
    };
    isActive?: boolean;
}

export type ViewType =
  | 'management'
  | 'fleet'
  | 'fuel'
  | 'operations'
  | 'partners'
  | 'quotes'
  | 'workshop'
  | 'finance'
  | 'incidentManagement'
  | 'hr'
  | 'userManagement'
  | 'settings'
  | 'driverDashboard';

export type Permission = 
  | 'access_management'
  | 'access_fleet'
  | 'access_fuel'
  | 'access_operations'
  | 'access_workshop'
  | 'access_finance'
  | 'access_incidents'
  | 'access_hr'
  | 'access_user_management'
  | 'access_settings';

export interface FuelPriceRecord {
    id: string;
    startDate: string;
    pricePerLiter: number;
}

export interface Bowser {
    id: string;
    name: string;
    capacity: number;
    currentStock: number;
}

export interface BowserRefill {
    id: string;
    bowserId: string;
    date: string;
    liters: number;
    costPerLiter: number;
    supplier: string;
    rebatePercentage?: number;
    finalCostPerLiter: number;
    referenceNumber: string; // Audit trail for bulk fuel purchases
}

export interface ChecklistItemTemplate {
    id: string;
    label: string;
    requiresPhotoOnFail: boolean;
}

export interface ChecklistTemplate {
    id: string;
    name: string;
    items: ChecklistItemTemplate[];
}

export interface ChecklistSubmission {
    id: string;
    templateId: string;
    templateName: string;
    vehicleId: string;
    userId: string;
    userName: string;
    date: string;
    odometer: number;
    hours?: number;
    results: ChecklistItemResult[];
    status: 'Submitted' | 'Reviewed';
    reviewedBy?: string;
    reviewedAt?: string;
}

export interface ChecklistItemResult {
    itemId: string;
    item: string;
    status: 'Pass' | 'Needs Attention' | 'Fail';
    notes: string;
    attachment?: Attachment;
    createJobCard?: boolean;
    priority?: 'Low' | 'Medium' | 'High' | 'Critical';
    severity?: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface Attachment {
    name: string;
    type: string;
    data: string;
}

export type JobCardStatus =
  | 'Reported'
  | 'Awaiting Inspection'
  | 'Awaiting Parts'
  | 'Pending Scheduling'
  | 'Scheduled'
  | 'In Progress'
  | 'Awaiting Sign-off'
  | 'Resolved';

export type JobCardType = 'Repair' | 'Service' | 'Inspection' | 'Tyre Change' | 'Spot Check';

export interface JobCard {
    id: string;
    vehicleId: string;
    submissionId?: string;
    checklistItemId?: string;
    serviceIntervalId?: string;
    itemDescription: string;
    reporterNotes?: string;
    reporterAttachment?: Attachment;
    type: JobCardType;
    status: JobCardStatus;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    assignedToUserId?: string;
    reportedDate: string;
    completionDate?: string;
    laborHours?: number;
    notes?: { userId: string, text: string, timestamp: string }[];
    partsUsed?: { partId: string, quantity: number, unitCost: number }[];
    proposedStartDate?: string;
    proposedEndDate?: string;
}

export interface ComplianceDoc {
    id: string;
    type: 'GIT' | 'BEE' | 'TAX' | 'LOGS' | 'COY_REG' | 'OTH';
    name: string;
    attachment: Attachment;
    expiryDate?: string;
    status: 'Valid' | 'Expired' | 'Pending Review';
}

// A named person at a client or subcontractor — the controller / booking
// contact you liaise with. Choosing one auto-fills their email on an order.
export interface Contact {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
}

export interface Supplier {
    id: string;
    name: string;
    type: 'Workshop' | 'Transport' | 'Other';
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    contacts?: Contact[];
    address: string;
    averageRating?: number;
    complianceStatus: 'Compliant' | 'Expired' | 'Pending';
    expiryDate?: string;
    // New detailed fields
    beeStatus?: string;
    hazCompliant?: boolean;
    specializations?: string[];
    regions?: string;
    fleetSize?: string;
    controllerContact?: string;
    accountsContact?: string;
    complianceDocs: ComplianceDoc[];
    rateCards: Attachment[];
    isActive?: boolean;
}

export type SupplierApplicationStatus = 'Pending' | 'Approved' | 'Rejected';

export interface SupplierApplication {
    id: string;
    status: SupplierApplicationStatus;
    submittedDate: string;
    companyName: string;
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    specializations: string[];
    routes: string;
    fleetSize?: string;
    beeStatus?: string;
    hazCompliant?: boolean;
    fleetList: Attachment;
    rateCard: Attachment;
    insurance: Attachment;
}

// An internal branch of a client (holding account) — e.g. PERI Scaffolding's
// DBN / JHB / CPT branches, each with their own delivery address + contact.
export interface ClientBranch {
    name: string;
    address?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    // The people at THIS branch who book / give us loads. Each can be picked as
    // the booking contact on a load for this client's branch.
    contacts?: Contact[];
}

export interface Client {
    id: string;
    name: string;
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    contacts?: Contact[];
    branches?: ClientBranch[];
    address: string;
    slaLevel?: string;
    isActive?: boolean;
}

export interface LoadConfirmation {
    id: string;
    loadConNumber: string;
    quoteId?: string;
    clientId: string;
    supplierId?: string;
    date: string;
    items: any[];
    legs: any[];
    totalAmount: number; 
    supplierRate?: number; 
    collectionBranch: Branch;
    destinationBranch: Branch;
    priority: 'Low' | 'Medium' | 'High';
    status: LoadConfirmationStatus;
    collectionPoint: string;
    deliveryPoint: string;
    collectionDate?: string;
    deliveryDate?: string;
    vehicleId?: string;
    driverId?: string;
    podPhoto?: Attachment;
    podSignature?: string;
    paymentStatus?: 'Awaiting POD' | 'Awaiting Review' | 'Ready for Payment' | 'Paid';
    customerOrderNumber?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    cargoPhotos?: Attachment[];
    damageReport?: string;
    notes?: any[];
    podAnalysis?: PodAnalysisResult;
    deliveryArea?: string;
    sentToSupplierDate?: string;
    subcontractorVehicleReg?: string;
    subcontractorDriverName?: string;
    subcontractorDriverCell?: string;
    acceptedAt?: string;
    loadingEta?: string;
    deliveryEta?: string;
    clientRequest?: string;
    clientRequestAt?: string;
    clientRequestStatus?: string;
    clientRequestReply?: string;
    commodity?: string;
    packaging?: string;
    loadSpec?: string;
    // Transport Order (loadcon) fields — mirror the FBN Transport Order form.
    arrangingBranch?: string;
    loadRefNo?: string;
    clientName?: string;
    clientContact?: string;
    clientEmail?: string;
    route?: string;
    fbnRepresentative?: string;
    loadingTime?: string;
    offloadingTime?: string;
    collectionContact?: string;
    collectionTelephone?: string;
    deliveryContact?: string;
    deliveryTelephone?: string;
    loadType?: string;
    quantity?: string;
    weightKg?: string;
    volume?: string;
    cargoValue?: string;
    equipmentRequired?: string[];
    containerNo?: string;
    containerTurnInAddress?: string;
    containerOperator?: string;
    containerSealNo?: string;
    specialInstructions?: string;
    subcontractorName?: string;
    forAttention?: string;
    subcontractorEmail?: string;
    podEmail?: string;
    ccEmail?: string;
    delayReason?: string;
    eta?: string;
}

export type LoadConfirmationStatus =
  | 'Booked'
  | 'Driver Assigned'
  | 'At Collection Point'
  | 'Loading'
  | 'Collected'
  | 'At Collection Depot'
  | 'In Transit'
  | 'At Destination Depot'
  | 'Unloaded'
  | 'Out for Delivery'
  | 'Delivered'
  | 'POD Submitted'
  | 'Invoiced'
  | 'Cancelled';

export interface PlannedService {
    id: string;
    vehicleId: string;
    description: string;
    startDate: string;
    endDate: string;
}

export interface PodAnalysisResult {
    recipientName: string;
    documentIssues: string;
    isSignaturePresent: boolean;
}

export type IncidentReportType = 'Accident' | 'Near-miss' | 'Traffic Violation' | 'Fine' | 'Other' | string;
export type AtFaultParty = 'Driver' | 'Third Party';

export interface IncidentQuote {
    vendor: string;
    amount: number;
    attachment: Attachment;
}

export type IncidentStatus = 'Reported' | 'Claim Submitted' | 'Awaiting Quotes' | 'Awaiting Repair' | 'Repairs Complete' | 'Closed';

export interface IncidentReport {
    id: string;
    vehicleId: string;
    userId: string;
    date: string;
    incidentType: IncidentReportType;
    description: string;
    thirdPartyInvolved: boolean;
    attachments: Attachment[];
    status: IncidentStatus;
    quotes: IncidentQuote[];
    notes?: string;
    atFaultParty?: AtFaultParty;
    insuranceClaimNumber?: string;
    sapsCaseNumber?: string;
    finalRepairer?: string;
    finalRepairCost?: number;
    fineNumber?: string;
    fineAmount?: number;
    violationCode?: string;
}

export interface HRCase {
    id: string;
    driverId: string;
    incidentId?: string;
    tireId?: string;
    vehicleId?: string;
    damageReason: string;
    costToRecover: number;
    reportedDate: string;
    status: 'Pending' | 'Actioned' | 'Closed';
}

export interface Tire {
    id: string;
    serialNumber: string;
    brand: string;
    size: string;
    type: 'New' | 'Retread';
    purchaseDate: string;
    purchasePrice: number;
    status: TireStatus;
    assignedVehicleId?: string;
    assignedPosition?: string;
    mountHistory: any[];
    retreadDetails?: any;
}

export type TireStatus = 'In Storage' | 'Mounted' | 'Out for Retread' | 'Scrapped';

export interface TireInspection {
    id: string;
    tireId: string;
    date: string;
    vehicleOdometer: number;
    treadDepth: number;
    pressure: number;
    notes?: string;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface QuoteItem {
    id: string;
    description: string;
    packagingType: string;
    quantity: number;
    rate: number;
    total: number;
    weight?: number;
    volume?: number;
}

export interface QuoteLeg {
    id: string;
    collectionPoint: string;
    deliveryPoint: string;
    movementType: 'Internal' | 'Subcontractor';
}

export interface SubcontractorQuote {
    id: string;
    supplierId: string;
    rate: number;
    timestamp: string;
}

export interface Quote {
    id: string;
    quoteNumber: string;
    clientId: string;
    date: string;
    expiryDate: string;
    items: QuoteItem[];
    legs: QuoteLeg[];
    totalAmount: number;
    status: QuoteStatus;
    sentToClient: boolean;
    customerOrderNumber?: string;
    notes?: string;
    specialRequirements?: string;
    collectionDate?: string;
    subcontractorQuotes: SubcontractorQuote[];
    commodity?: string;
    packaging?: string;
    loadSpec?: string;
}

export interface Manifest {
    id: string;
    manifestNumber: string;
    originBranch: Branch;
    destinationBranch: Branch;
    dispatchDate: string;
    arrivalDate?: string;
    vehicleId: string;
    driverId: string;
    loadConfirmationIds: string[];
    status: 'In Transit' | 'Arrived';
}

export interface TripSheet {
    id: string;
    tripSheetNumber: string;
    branch: Branch;
    dispatchDate: string;
    completionDate?: string;
    vehicleId: string;
    driverId: string;
    loadConfirmationIds: string[];
    status: 'Out for Delivery' | 'Completed';
}

export type NotificationType = 'JOB_CARD' | 'SERVICE' | 'INVENTORY' | 'PURCHASE';

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    timestamp: string;
    link: { view: ViewType; params?: any };
    isRead: boolean;
}

export interface Part {
    id: string;
    name: string;
    partNumber?: string;
    supplierId?: string;
    quantityInStock: number;
    minStockLevel: number;
    cost: number;
    branchId?: string;
}

export interface PurchaseRequest {
    id: string;
    partId: string;
    jobCardId?: string;
    quantity: number;
    requestedByUserId: string;
    requestedDate: string;
    isUrgent: boolean;
    status: 'Pending' | 'Awaiting Quotes' | 'Awaiting Approval' | 'Approved' | 'Rejected' | 'Ordered' | 'Completed';
    quotes?: any[];
}

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    purchaseRequestId: string;
    supplierId: string;
    orderDate: string;
    items: any[];
    totalCost: number;
    status: 'Ordered' | 'Partially Received' | 'Received';
}

export interface Budget {
    id: string;
    targetId: string;
    amount: number;
    startDate: string;
    period: 'monthly';
}

export interface Forecast {
    id: string;
    targetId: string;
    generatedDate: string;
    forecastedCosts: any[];
    insights: string;
}

export interface Route {
    id: string;
    origin: string;
    destination: string;
    distanceKm?: number;
    estimatedHours?: number;
    averageFuelLiters?: number;
    tollCost?: number;
    targetSellPerPallet?: number;
    targetSellPerCbm?: number;
    targetSellPerKg?: number;
    targetSellPerDeckM?: number;
    minimumSellFullLoad?: number;
    targetSellFullLoad?: number;
    premiumSellFullLoad?: number;
    isActive: boolean;
    notes?: string;
}

export type VehicleComplianceType =
    | 'COF'
    | 'LICENSE_DISC'
    | 'TRACKER_CERT'
    | 'INSURANCE'
    | 'PERMIT'
    | 'CROSS_BORDER'
    | 'DG_PERMIT'
    | 'OTHER';

export type DocStatus = 'Valid' | 'Expired' | 'Pending Review';

export interface VehicleComplianceDoc {
    id: string;
    vehicleId: string;
    type: VehicleComplianceType;
    name: string;
    issueDate?: string;
    expiryDate?: string;
    status: DocStatus;
    fileName?: string;
    fileUrl?: string;
    notes?: string;
}
