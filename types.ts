
// Fix: Resolve circular dependency by defining and exporting the Branch type here.
export type Branch = 'FBN JHB' | 'FBN DBN' | 'FBN CPT' | 'LOADMASTER';

export type WidgetType = 
  | 'ACTION_CENTER'
  | 'BROKING_SHIPMENTS_SNAPSHOT'
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
  // Dealer maintenance plan: when on a plan, services due soon are flagged to
  // "book into the dealer plan" ahead of time (see hooks/useServiceStatus).
  onMaintenancePlan?: boolean;
  maintenancePlanProvider?: string;
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
  | 'broking'
  | 'collectHome'
  | 'partners'
  | 'quotes'
  | 'workshop'
  | 'finance'
  | 'incidentManagement'
  | 'hr'
  | 'compliance'
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
    // Which emails this person receives, each independently toggleable:
    //  getsDocs    = the order doc — for a CLIENT that's the Client Order; for a
    //                SUBCONTRACTOR that's the LoadCon. (A client NEVER gets a LoadCon.)
    //  getsPod     = the signed POD (the copy to SIGN at delivery, for a subbie).
    //  getsPodUpload = NOT sent the POD to sign, but reminded to UPLOAD the POD /
    //                docs once delivery is complete (e.g. accounts, back in office).
    //  getsUpdates = the running status updates.
    // Undefined = legacy (treated as both docs + updates for the main contact).
    getsDocs?: boolean;
    getsPod?: boolean;
    getsPodUpload?: boolean;
    getsUpdates?: boolean;
    basedAt?: string;   // where this person is based (city/branch) — for marketing & routing
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
    vehicleTypes?: string[];
    trailerTypes?: string[];
    controllerContact?: string;
    accountsContact?: string;
    complianceDocs: ComplianceDoc[];
    rateCards: Attachment[];
    isActive?: boolean;
    isVetted?: boolean;
    vettedAt?: string;
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
    vehicleTypes?: string[];
    trailerTypes?: string[];
    inviteToken?: string;
    fleetList: Attachment;
    rateCard: Attachment;
    insurance: Attachment;
}

// Carrier (subcontractor) invitation campaign. FBN uploads transporter emails,
// emails them a branded invite with a personalised accept link, and tracks each
// down the funnel.
export type SubcontractorInviteStatus = 'Pending' | 'Invited' | 'Applied' | 'Vetted' | 'Declined';

export interface SubcontractorInvite {
    id: string;
    email: string;
    companyName?: string;
    contactPerson?: string;
    token: string;
    status: SubcontractorInviteStatus;
    sentCount: number;
    lastSentAt?: string;
    appliedAt?: string;
    applicationId?: string;
    supplierId?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
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
    backDated?: boolean;
    updatedAt?: string;
    isCollection?: boolean;
    // Import groupage (LCL/FCL from forwarders): the unpack depot the cargo waits
    // at, and the stage (awaiting_release → released → collected) before it joins
    // the normal collection flow.
    unpackDepot?: string;
    importStage?: 'awaiting_release' | 'released' | 'collected' | string;
    repEmail?: string;
    collectionRef?: string;
    updateCc?: string;
    clientCc?: string;
    loadedPackages?: number;
    loadingIssues?: string;
    dimensions?: string;
    cubeM3?: number;
    cargoPhotoUrls?: string[];
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
    podUploadEmail?: string; // contacts reminded to UPLOAD the POD once delivered (e.g. accounts)
    // Multi-leg via a TRANSIT depot: leg 1 (subbie) collects and drops at the
    // transit depot; FBN then plans the onward leg to the final delivery.
    transitDepot?: string;          // e.g. 'FBN JHB' — where leg 1 ends / cross-docks
    transitReceivedAt?: string;     // ISO timestamp the cargo was received at the transit depot
    onwardCarrierType?: 'fleet' | 'subbie'; // how the onward leg is being carried
    onwardPlannedDate?: string;     // planned final-delivery date (set at the transit depot)
    onwardPlannedTime?: string;
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

export type QuoteStatus = 'Requested' | 'More Info Requested' | 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Archived';

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
    requestData?: Record<string, any>;
    requestMoreInfo?: Record<string, any>;
}

// ── Carrier RFQ board ────────────────────────────────────────────────────────
// Ops raise a load request and broadcast it to multiple carriers who run the
// lane; carriers reply with a price if they can assist.
export type RfqStatus = 'Open' | 'Awarded' | 'Closed' | 'Cancelled';
export type RfqChannel = 'email' | 'whatsapp' | 'portal';

export interface RfqRecipient {
    id: string;
    rfqRequestId: string;
    supplierId?: string;
    email?: string;
    companyName?: string;
    channel: RfqChannel;
    token: string;
    status: string;            // Sent / Viewed / Quoted / Declined
    sentAt?: string;
}

export interface CarrierQuote {
    id: string;
    rfqRequestId: string;
    recipientId?: string;
    supplierId?: string;
    companyName?: string;
    canAssist: boolean;
    price?: number;
    vehicleOffered?: string;
    availableDate?: string;
    eta?: string;
    notes?: string;
    status: string;            // Submitted / Shortlisted / Awarded / Rejected
    submittedAt: string;
}

export interface RfqRequest {
    id: string;
    requestNumber: string;
    arrangingBranch?: string;  // sets the from-address (DBN/JHB)
    clientId?: string;         // optional client this load is for
    quoteId?: string;          // optional client quote it was raised from / feeds
    origin: string;
    destination: string;
    vehicleType?: string;
    loadType?: string;         // Full Load / Mixed Load
    commodity?: string;
    weightKg?: number;
    gitRequired: boolean;
    hazardous?: boolean;
    collectionDate?: string;
    collectionTime?: string;
    deliveryDate?: string;
    deliveryTime?: string;
    notes?: string;
    status: RfqStatus;
    awardedQuoteId?: string;
    closesAt?: string;
    createdAt: string;
    recipients: RfqRecipient[];
    quotes: CarrierQuote[];
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

export type NotificationType = 'JOB_CARD' | 'SERVICE' | 'INVENTORY' | 'PURCHASE' | 'COMPLIANCE' | 'ONBOARDING' | 'RFQ';

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
    | 'FIRE_PERMIT'
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
