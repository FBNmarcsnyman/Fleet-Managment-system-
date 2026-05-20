import type { Database } from './database.types';
import type {
    User, Permission, Vehicle, Branch, FuelEntry, ServiceEntry, OtherCost, RecurringCost,
    RevenueEntry, ServiceInterval, PlannedService, FuelPriceRecord, Bowser, BowserRefill,
    Budget, Forecast, JobCard, JobCardStatus, JobCardType, ChecklistTemplate,
    ChecklistItemTemplate, ChecklistSubmission, ChecklistItemResult, Tire, TireStatus,
    TireInspection, Part, PurchaseRequest, PurchaseOrder, HRCase, Client, Supplier,
    ComplianceDoc, Attachment, Quote, QuoteStatus, QuoteItem, QuoteLeg, SubcontractorQuote,
    LoadConfirmation, LoadConfirmationStatus, Manifest, TripSheet, IncidentReport,
    IncidentStatus, IncidentQuote, AtFaultParty, SupplierApplication,
    SupplierApplicationStatus, Notification, NotificationType, Message, Route,
    VehicleComplianceDoc, VehicleComplianceType, DocStatus, ViewType,
} from '../types';

type Tables = Database['public']['Tables'];
export type MapperCtx = { branchById: Map<string, Branch> };

const FALLBACK_BRANCH: Branch = 'FBN DBN';

const resolveBranch = (branchId: string | null, ctx: MapperCtx): Branch => {
    if (!branchId) return FALLBACK_BRANCH;
    const b = ctx.branchById.get(branchId);
    if (!b) {
        console.warn('mappers: unknown branch_id', branchId);
        return FALLBACK_BRANCH;
    }
    return b;
};

const resolveBranches = (branchIds: string[] | null, ctx: MapperCtx): Branch[] =>
    (branchIds || [])
        .map(id => ctx.branchById.get(id))
        .filter((b): b is Branch => b !== undefined);

// Synthesize an Attachment-like record from a file URL so consumers using
// <img src={att.data} /> render Storage URLs. Real Attachment objects (full
// upload flow with base64) come back in Commit F.
const urlToAttachment = (url: string | null, name?: string | null, type = ''): Attachment | undefined =>
    url ? { name: name || '', type, data: url } : undefined;

const urlsToAttachments = (urls: string[] | null): Attachment[] =>
    (urls || []).map(url => ({ name: '', type: '', data: url }));

// -- profiles → User ---------------------------------------------------------
export const mapProfile = (row: Tables['profiles']['Row'], ctx: MapperCtx): User => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as User['role'],
    permissions: (row.permissions || []) as Permission[],
    assignedBranches: resolveBranches(row.assigned_branch_ids, ctx),
    assignedVehicleIds: row.assigned_vehicle_ids?.length ? row.assigned_vehicle_ids : undefined,
    licenseNumber: row.license_number ?? undefined,
    licenseExpiry: row.license_expiry ?? undefined,
    pdpExpiry: row.pdp_expiry ?? undefined,
    dgCertExpiry: row.dg_cert_expiry ?? undefined,
    medicalExpiry: row.medical_expiry ?? undefined,
    inductionDate: row.induction_date ?? undefined,
    lastRefresherDate: row.last_refresher_date ?? undefined,
    clientId: row.client_id ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    navigationPreferences: (row.navigation_preferences as User['navigationPreferences']) ?? undefined,
});

// -- vehicles → Vehicle ------------------------------------------------------
export const mapVehicle = (row: Tables['vehicles']['Row'], ctx: MapperCtx): Vehicle => ({
    id: row.id,
    name: row.name,
    make: row.make ?? '',
    model: row.model ?? '',
    year: row.year ?? 0,
    registration: row.registration,
    vin: row.vin ?? '',
    branch: resolveBranch(row.branch_id, ctx),
    weightCategory: row.weight_category ?? '',
    status: row.status,
    purchasePrice: row.purchase_price ?? 0,
    currentValue: row.current_value ?? 0,
    linkedVehicleId: row.linked_vehicle_id ?? undefined,
    currentOdometer: row.current_odometer ?? undefined,
    currentHours: row.current_hours ?? undefined,
    assignedDriverId: row.assigned_driver_id ?? undefined,
    healthScore: row.health_score ?? undefined,
    palletSpaces: row.pallet_spaces ?? undefined,
    payloadKg: row.payload_kg ?? undefined,
    cubicMeters: row.cubic_meters ?? undefined,
    deckMeters: row.deck_meters ?? undefined,
    costPerKmTarget: row.cost_per_km_target ?? undefined,
    monthlyFixedCost: row.monthly_fixed_cost ?? undefined,
});

// -- fuel_entries → FuelEntry ------------------------------------------------
export const mapFuelEntry = (row: Tables['fuel_entries']['Row']): FuelEntry => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    date: row.date,
    odometer: row.odometer,
    liters: row.liters,
    tripDistance: row.trip_distance_km ?? undefined,
    sourceBowserId: row.source_bowser_id ?? undefined,
});

// -- service_entries → ServiceEntry ------------------------------------------
export const mapServiceEntry = (row: Tables['service_entries']['Row']): ServiceEntry => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    date: row.date,
    startOdometer: row.start_odometer ?? 0,
    endOdometer: row.end_odometer ?? 0,
    startHours: row.start_hours ?? undefined,
    endHours: row.end_hours ?? undefined,
    description: row.description,
    cost: row.cost,
    attachment: urlToAttachment(row.attachment_url, row.attachment_name),
});

// -- other_costs → OtherCost -------------------------------------------------
export const mapOtherCost = (row: Tables['other_costs']['Row']): OtherCost => ({
    id: row.id,
    vehicleId: row.vehicle_id ?? '',
    date: row.date,
    category: row.category,
    amount: row.amount,
});

// -- recurring_costs → RecurringCost -----------------------------------------
export const mapRecurringCost = (row: Tables['recurring_costs']['Row']): RecurringCost => ({
    id: row.id,
    vehicleId: row.vehicle_id ?? '',
    category: row.category,
    amount: row.amount,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
});

// -- revenue_entries → RevenueEntry ------------------------------------------
export const mapRevenueEntry = (row: Tables['revenue_entries']['Row']): RevenueEntry => ({
    id: row.id,
    vehicleId: row.vehicle_id ?? '',
    date: row.date,
    description: row.description,
    amount: row.amount,
});

// -- service_intervals → ServiceInterval -------------------------------------
export const mapServiceInterval = (row: Tables['service_intervals']['Row']): ServiceInterval => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    description: row.description,
    distanceInterval: row.distance_interval,
    timeIntervalDays: row.time_interval_days,
    hoursInterval: row.hours_interval,
});

// -- planned_services → PlannedService ---------------------------------------
export const mapPlannedService = (row: Tables['planned_services']['Row']): PlannedService => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
});

// -- fuel_prices → FuelPriceRecord -------------------------------------------
export const mapFuelPrice = (row: Tables['fuel_prices']['Row']): FuelPriceRecord => ({
    id: row.id,
    startDate: row.start_date,
    pricePerLiter: row.price_per_liter,
});

// -- bowsers → Bowser --------------------------------------------------------
export const mapBowser = (row: Tables['bowsers']['Row']): Bowser => ({
    id: row.id,
    name: row.name,
    capacity: row.capacity_liters ?? 0,
    currentStock: row.current_stock_liters ?? 0,
});

// -- bowser_refills → BowserRefill -------------------------------------------
export const mapBowserRefill = (row: Tables['bowser_refills']['Row']): BowserRefill => ({
    id: row.id,
    bowserId: row.bowser_id,
    date: row.date,
    liters: row.liters,
    costPerLiter: row.cost_per_liter,
    supplier: row.supplier ?? '',
    rebatePercentage: row.rebate_percentage ?? undefined,
    finalCostPerLiter: row.final_cost_per_liter,
    referenceNumber: row.reference_number,
});

// -- budgets → Budget --------------------------------------------------------
export const mapBudget = (row: Tables['budgets']['Row']): Budget => ({
    id: row.id,
    targetId: row.target_id,
    amount: row.amount,
    startDate: row.start_date,
    period: 'monthly',
});

// -- forecasts → Forecast ----------------------------------------------------
export const mapForecast = (row: Tables['forecasts']['Row']): Forecast => ({
    id: row.id,
    targetId: row.target_id,
    generatedDate: row.generated_date,
    forecastedCosts: (row.forecasted_costs as any[]) ?? [],
    insights: row.insights ?? '',
});

// -- job_cards → JobCard -----------------------------------------------------
export const mapJobCard = (row: Tables['job_cards']['Row']): JobCard => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    submissionId: row.submission_id ?? undefined,
    checklistItemId: row.checklist_item_id ?? undefined,
    serviceIntervalId: row.service_interval_id ?? undefined,
    itemDescription: row.item_description,
    reporterNotes: row.reporter_notes ?? undefined,
    reporterAttachment: urlToAttachment(row.reporter_attachment_url),
    type: row.type as JobCardType,
    status: row.status as JobCardStatus,
    priority: row.priority,
    severity: row.severity,
    assignedToUserId: row.assigned_to_user_id ?? undefined,
    reportedDate: row.reported_date,
    completionDate: row.completion_date ?? undefined,
    laborHours: row.labor_hours ?? undefined,
    notes: (row.notes as JobCard['notes']) ?? undefined,
    partsUsed: (row.parts_used as JobCard['partsUsed']) ?? undefined,
    proposedStartDate: row.proposed_start_date ?? undefined,
    proposedEndDate: row.proposed_end_date ?? undefined,
});

// -- checklist_templates → ChecklistTemplate ---------------------------------
export const mapChecklistTemplate = (row: Tables['checklist_templates']['Row']): ChecklistTemplate => ({
    id: row.id,
    name: row.name,
    items: (row.items as unknown as ChecklistItemTemplate[]) ?? [],
});

// -- checklist_submissions → ChecklistSubmission -----------------------------
export const mapChecklistSubmission = (row: Tables['checklist_submissions']['Row']): ChecklistSubmission => ({
    id: row.id,
    templateId: row.template_id,
    templateName: row.template_name,
    vehicleId: row.vehicle_id,
    userId: row.user_id,
    userName: row.user_name,
    date: row.date,
    odometer: row.odometer ?? 0,
    hours: row.hours ?? undefined,
    results: (row.results as unknown as ChecklistItemResult[]) ?? [],
    status: row.status,
    reviewedBy: row.reviewed_by_id ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
});

// -- tires → Tire (mountHistory joined separately) ---------------------------
export const mapTire = (
    row: Tables['tires']['Row'],
    mountHistoryByTire: Map<string, Tables['tire_mount_history']['Row'][]>
): Tire => ({
    id: row.id,
    serialNumber: row.serial_number,
    brand: row.brand ?? '',
    size: row.size ?? '',
    type: row.type,
    purchaseDate: row.purchase_date ?? '',
    purchasePrice: row.purchase_price ?? 0,
    status: row.status as TireStatus,
    assignedVehicleId: row.assigned_vehicle_id ?? undefined,
    assignedPosition: row.assigned_position ?? undefined,
    mountHistory: (mountHistoryByTire.get(row.id) || []).map(h => ({
        vehicleId: h.vehicle_id ?? undefined,
        position: h.position ?? undefined,
        mountedDate: h.mounted_date ?? undefined,
        mountedOdometer: h.mounted_odometer ?? undefined,
        removedDate: h.removed_date ?? undefined,
        removedOdometer: h.removed_odometer ?? undefined,
        notes: h.notes ?? undefined,
    })),
    retreadDetails: row.retread_details ?? undefined,
});

// -- tire_inspections → TireInspection ---------------------------------------
export const mapTireInspection = (row: Tables['tire_inspections']['Row']): TireInspection => ({
    id: row.id,
    tireId: row.tire_id,
    date: row.date,
    vehicleOdometer: row.vehicle_odometer ?? 0,
    treadDepth: row.tread_depth_mm ?? 0,
    pressure: row.pressure_psi ?? 0,
    notes: row.notes ?? undefined,
});

// -- parts → Part ------------------------------------------------------------
export const mapPart = (row: Tables['parts']['Row']): Part => ({
    id: row.id,
    name: row.name,
    partNumber: row.part_number ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    quantityInStock: row.quantity_in_stock,
    minStockLevel: row.min_stock_level,
    cost: row.cost,
    branchId: row.branch_id ?? undefined,
});

// -- purchase_requests → PurchaseRequest -------------------------------------
export const mapPurchaseRequest = (row: Tables['purchase_requests']['Row']): PurchaseRequest => ({
    id: row.id,
    partId: row.part_id ?? '',
    jobCardId: row.job_card_id ?? undefined,
    quantity: row.quantity,
    requestedByUserId: row.requested_by_user_id ?? '',
    requestedDate: row.requested_date,
    isUrgent: row.is_urgent,
    status: row.status as PurchaseRequest['status'],
    quotes: (row.quotes as any[]) ?? undefined,
});

// -- purchase_orders → PurchaseOrder -----------------------------------------
export const mapPurchaseOrder = (row: Tables['purchase_orders']['Row']): PurchaseOrder => ({
    id: row.id,
    poNumber: row.po_number,
    purchaseRequestId: row.purchase_request_id ?? '',
    supplierId: row.supplier_id ?? '',
    orderDate: row.order_date,
    items: (row.items as any[]) ?? [],
    totalCost: row.total_cost,
    status: row.status as PurchaseOrder['status'],
});

// -- hr_cases → HRCase -------------------------------------------------------
export const mapHRCase = (row: Tables['hr_cases']['Row']): HRCase => ({
    id: row.id,
    driverId: row.driver_id,
    incidentId: row.incident_id ?? undefined,
    tireId: row.tire_id ?? undefined,
    vehicleId: row.vehicle_id ?? undefined,
    damageReason: row.damage_reason,
    costToRecover: row.cost_to_recover,
    reportedDate: row.reported_date,
    status: row.status,
});

// -- clients → Client --------------------------------------------------------
export const mapClient = (row: Tables['clients']['Row']): Client => ({
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    address: row.address ?? '',
    slaLevel: row.sla_level ?? undefined,
});

// -- suppliers + supplier_compliance_docs + supplier_rate_cards → Supplier ---
export const mapSupplierComplianceDoc = (row: Tables['supplier_compliance_docs']['Row']): ComplianceDoc => ({
    id: row.id,
    type: row.type as ComplianceDoc['type'],
    name: row.name,
    attachment: urlToAttachment(row.file_url, row.file_name) ?? { name: '', type: '', data: '' },
    expiryDate: row.expiry_date ?? undefined,
    status: row.status,
});

export const mapSupplierRateCard = (row: Tables['supplier_rate_cards']['Row']): Attachment => ({
    name: row.name || row.file_name || '',
    type: '',
    data: row.file_url ?? '',
});

export const mapSupplier = (
    row: Tables['suppliers']['Row'],
    complianceDocsBySupplier: Map<string, ComplianceDoc[]>,
    rateCardsBySupplier: Map<string, Attachment[]>
): Supplier => ({
    id: row.id,
    name: row.name,
    type: row.type,
    contactPerson: row.contact_person ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    address: row.address ?? '',
    averageRating: row.average_rating ?? undefined,
    complianceStatus: row.compliance_status,
    expiryDate: row.expiry_date ?? undefined,
    beeStatus: row.bee_status ?? undefined,
    hazCompliant: row.haz_compliant ?? undefined,
    specializations: row.specializations ?? undefined,
    regions: row.regions ?? undefined,
    fleetSize: row.fleet_size ?? undefined,
    controllerContact: row.controller_contact ?? undefined,
    accountsContact: row.accounts_contact ?? undefined,
    complianceDocs: complianceDocsBySupplier.get(row.id) || [],
    rateCards: rateCardsBySupplier.get(row.id) || [],
});

// -- quotes → Quote ----------------------------------------------------------
export const mapQuote = (row: Tables['quotes']['Row']): Quote => ({
    id: row.id,
    quoteNumber: row.quote_number,
    clientId: row.client_id,
    date: row.date,
    expiryDate: row.expiry_date ?? '',
    items: (row.items as unknown as QuoteItem[]) ?? [],
    legs: (row.legs as unknown as QuoteLeg[]) ?? [],
    totalAmount: row.total_amount,
    status: row.status as QuoteStatus,
    sentToClient: row.sent_to_client,
    customerOrderNumber: row.customer_order_number ?? undefined,
    notes: row.notes ?? undefined,
    specialRequirements: row.special_requirements ?? undefined,
    collectionDate: row.collection_date ?? undefined,
    subcontractorQuotes: (row.subcontractor_quotes as unknown as SubcontractorQuote[]) ?? [],
    commodity: row.commodity ?? undefined,
    packaging: row.packaging ?? undefined,
    loadSpec: row.load_spec ?? undefined,
});

// -- load_confirmations → LoadConfirmation -----------------------------------
export const mapLoadConfirmation = (row: Tables['load_confirmations']['Row'], ctx: MapperCtx): LoadConfirmation => ({
    id: row.id,
    loadConNumber: row.load_con_number,
    quoteId: row.quote_id ?? undefined,
    clientId: row.client_id,
    supplierId: row.supplier_id ?? undefined,
    date: row.date,
    items: (row.items as any[]) ?? [],
    legs: (row.legs as any[]) ?? [],
    totalAmount: row.total_amount,
    supplierRate: row.supplier_rate ?? undefined,
    collectionBranch: resolveBranch(row.collection_branch_id, ctx),
    destinationBranch: resolveBranch(row.destination_branch_id, ctx),
    priority: row.priority as LoadConfirmation['priority'],
    status: row.status as LoadConfirmationStatus,
    collectionPoint: row.collection_point ?? '',
    deliveryPoint: row.delivery_point ?? '',
    collectionDate: row.collection_date ?? undefined,
    deliveryDate: row.delivery_date ?? undefined,
    vehicleId: row.vehicle_id ?? undefined,
    driverId: row.driver_id ?? undefined,
    podPhoto: urlToAttachment(row.pod_photo_url, 'POD', 'image/jpeg'),
    podSignature: row.pod_signature_url ?? undefined,
    paymentStatus: row.payment_status ?? undefined,
    customerOrderNumber: row.customer_order_number ?? undefined,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceDate: row.invoice_date ?? undefined,
    cargoPhotos: row.cargo_photo_urls?.length ? urlsToAttachments(row.cargo_photo_urls) : undefined,
    damageReport: row.damage_report ?? undefined,
    notes: (row.notes as any[]) ?? undefined,
    podAnalysis: (row.pod_analysis as unknown as LoadConfirmation['podAnalysis']) ?? undefined,
    deliveryArea: row.delivery_area ?? undefined,
    sentToSupplierDate: row.sent_to_supplier_date ?? undefined,
    subcontractorVehicleReg: row.subcontractor_vehicle_reg ?? undefined,
    subcontractorDriverName: row.subcontractor_driver_name ?? undefined,
    subcontractorDriverCell: row.subcontractor_driver_cell ?? undefined,
    commodity: row.commodity ?? undefined,
    packaging: row.packaging ?? undefined,
    loadSpec: row.load_spec ?? undefined,
});

// -- manifests → Manifest ----------------------------------------------------
export const mapManifest = (row: Tables['manifests']['Row'], ctx: MapperCtx): Manifest => ({
    id: row.id,
    manifestNumber: row.manifest_number,
    originBranch: resolveBranch(row.origin_branch_id, ctx),
    destinationBranch: resolveBranch(row.destination_branch_id, ctx),
    dispatchDate: row.dispatch_date,
    arrivalDate: row.arrival_date ?? undefined,
    vehicleId: row.vehicle_id ?? '',
    driverId: row.driver_id ?? '',
    loadConfirmationIds: row.load_confirmation_ids || [],
    status: row.status,
});

// -- trip_sheets → TripSheet -------------------------------------------------
export const mapTripSheet = (row: Tables['trip_sheets']['Row'], ctx: MapperCtx): TripSheet => ({
    id: row.id,
    tripSheetNumber: row.trip_sheet_number,
    branch: resolveBranch(row.branch_id, ctx),
    dispatchDate: row.dispatch_date,
    completionDate: row.completion_date ?? undefined,
    vehicleId: row.vehicle_id ?? '',
    driverId: row.driver_id ?? '',
    loadConfirmationIds: row.load_confirmation_ids || [],
    status: row.status,
});

// -- incident_reports → IncidentReport ---------------------------------------
export const mapIncidentReport = (row: Tables['incident_reports']['Row']): IncidentReport => ({
    id: row.id,
    vehicleId: row.vehicle_id ?? '',
    userId: row.user_id ?? '',
    date: row.date,
    incidentType: row.incident_type,
    description: row.description,
    thirdPartyInvolved: row.third_party_involved,
    attachments: urlsToAttachments(row.attachment_urls),
    status: row.status as IncidentStatus,
    quotes: (row.quotes as unknown as IncidentQuote[]) ?? [],
    notes: row.notes ?? undefined,
    atFaultParty: (row.at_fault_party ?? undefined) as AtFaultParty | undefined,
    insuranceClaimNumber: row.insurance_claim_number ?? undefined,
    sapsCaseNumber: row.saps_case_number ?? undefined,
    finalRepairer: row.final_repairer ?? undefined,
    finalRepairCost: row.final_repair_cost ?? undefined,
    fineNumber: row.fine_number ?? undefined,
    fineAmount: row.fine_amount ?? undefined,
    violationCode: row.violation_code ?? undefined,
});

// -- supplier_applications → SupplierApplication -----------------------------
export const mapSupplierApplication = (row: Tables['supplier_applications']['Row']): SupplierApplication => ({
    id: row.id,
    status: row.status as SupplierApplicationStatus,
    submittedDate: row.submitted_date,
    companyName: row.company_name,
    contactPerson: row.contact_person ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    address: row.address ?? '',
    specializations: row.specializations ?? [],
    routes: row.routes ?? '',
    fleetSize: row.fleet_size ?? undefined,
    beeStatus: row.bee_status ?? undefined,
    hazCompliant: row.haz_compliant ?? undefined,
    fleetList: urlToAttachment(row.fleet_list_url) ?? { name: '', type: '', data: '' },
    rateCard: urlToAttachment(row.rate_card_url) ?? { name: '', type: '', data: '' },
    insurance: urlToAttachment(row.insurance_url) ?? { name: '', type: '', data: '' },
});

// -- notifications → Notification --------------------------------------------
export const mapNotification = (row: Tables['notifications']['Row']): Notification => ({
    id: row.id,
    type: row.type as NotificationType,
    message: row.message,
    timestamp: row.created_at,
    link: (row.link as { view: ViewType; params?: unknown }) ?? { view: 'management' },
    isRead: row.is_read,
});

// -- messages → Message ------------------------------------------------------
export const mapMessage = (row: Tables['messages']['Row']): Message => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    userId: row.user_id,
    userName: row.user_name,
    timestamp: row.timestamp,
    text: row.text,
});

// -- routes → Route ----------------------------------------------------------
export const mapRoute = (row: Tables['routes']['Row']): Route => ({
    id: row.id,
    origin: row.origin,
    destination: row.destination,
    distanceKm: row.distance_km ?? undefined,
    estimatedHours: row.estimated_hours ?? undefined,
    averageFuelLiters: row.average_fuel_liters ?? undefined,
    tollCost: row.toll_cost ?? undefined,
    targetSellPerPallet: row.target_sell_per_pallet ?? undefined,
    targetSellPerCbm: row.target_sell_per_cbm ?? undefined,
    targetSellPerKg: row.target_sell_per_kg ?? undefined,
    targetSellPerDeckM: row.target_sell_per_deck_m ?? undefined,
    minimumSellFullLoad: row.minimum_sell_full_load ?? undefined,
    targetSellFullLoad: row.target_sell_full_load ?? undefined,
    premiumSellFullLoad: row.premium_sell_full_load ?? undefined,
    isActive: row.is_active,
    notes: row.notes ?? undefined,
});

// -- vehicle_compliance_docs → VehicleComplianceDoc --------------------------
export const mapVehicleComplianceDoc = (row: Tables['vehicle_compliance_docs']['Row']): VehicleComplianceDoc => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    type: row.type as VehicleComplianceType,
    name: row.name,
    issueDate: row.issue_date ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    status: row.status as DocStatus,
    fileName: row.file_name ?? undefined,
    fileUrl: row.file_url ?? undefined,
    notes: row.notes ?? undefined,
});
