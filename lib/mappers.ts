import type { Database } from './database.types';
import type {
    User, Permission, Vehicle, Branch, FuelEntry, ServiceEntry, OtherCost, RecurringCost,
    RevenueEntry, ServiceInterval, PlannedService, FuelPriceRecord, Bowser, BowserRefill,
    Budget, Forecast, JobCard, JobCardStatus, JobCardType, ChecklistTemplate,
    ChecklistItemTemplate, ChecklistSubmission, ChecklistItemResult, Tire, TireStatus,
    TireInspection, Part, PurchaseRequest, PurchaseOrder, HRCase, Client, ClientBranch, Supplier, Contact, Driver,
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

export const toBowserInsert = (b: Omit<Bowser, 'id'>): Tables['bowsers']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    name: b.name,
    capacity_liters: b.capacity,
    current_stock_liters: b.currentStock,
});

export const toBowserRefillInsert = (r: Omit<BowserRefill, 'id'>): Tables['bowser_refills']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    bowser_id: r.bowserId,
    date: r.date,
    liters: r.liters,
    cost_per_liter: r.costPerLiter,
    final_cost_per_liter: r.finalCostPerLiter,
    reference_number: r.referenceNumber,
    supplier: r.supplier ?? null,
    rebate_percentage: r.rebatePercentage ?? null,
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

export const toChecklistSubmissionInsert = (s: {
    templateId: string;
    templateName: string;
    vehicleId: string;
    userId: string;
    userName: string;
    odometer: number;
    hours?: number;
    results: ChecklistItemResult[];
    date?: string;
    status?: ChecklistSubmission['status'];
}): Tables['checklist_submissions']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    template_id: s.templateId,
    template_name: s.templateName,
    vehicle_id: s.vehicleId,
    user_id: s.userId,
    user_name: s.userName,
    date: s.date ?? new Date().toISOString(),
    odometer: s.odometer,
    hours: s.hours ?? null,
    results: s.results as unknown as Tables['checklist_submissions']['Insert']['results'],
    status: s.status ?? 'Submitted',
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

export const toPurchaseOrderInsert = (po: Omit<PurchaseOrder, 'id'>): Tables['purchase_orders']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    po_number: po.poNumber,
    purchase_request_id: po.purchaseRequestId || null,
    supplier_id: po.supplierId || null,
    order_date: po.orderDate,
    items: po.items as unknown as Tables['purchase_orders']['Insert']['items'],
    total_cost: po.totalCost,
    status: po.status,
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
    contacts: (row.contacts as unknown as Contact[]) ?? [],
    branches: ((row as any).branches as ClientBranch[]) ?? [],
    address: row.address ?? '',
    slaLevel: row.sla_level ?? undefined,
    isActive: (row as any).is_active ?? true,
});

// -- drivers → Driver ---------------------------------------------------------
// Typed loosely (any) so we don't have to hand-maintain the generated
// database.types.ts for this table; the supabase calls cast the table name.
export const mapDriver = (row: any): Driver => ({
    id: row.id,
    name: row.name,
    cell: row.cell ?? undefined,
    idNumber: row.id_number ?? undefined,
    licenceNo: row.licence_no ?? undefined,
    licenceCode: row.licence_code ?? undefined,
    licenceExpiry: row.licence_expiry ?? undefined,
    pdpExpiry: row.pdp_expiry ?? undefined,
    assignedVehicleId: row.assigned_vehicle_id ?? undefined,
    branch: row.branch ?? undefined,
    isActive: row.is_active ?? true,
    notes: row.notes ?? undefined,
    licenceDocUrl: row.licence_doc_url ?? undefined,
});

export const toDriverInsert = (d: Omit<Driver, 'id'>): Record<string, any> => ({
    organization_id: FBN_ORGANIZATION_ID,
    name: d.name,
    cell: d.cell || null,
    id_number: d.idNumber || null,
    licence_no: d.licenceNo || null,
    licence_code: d.licenceCode || null,
    licence_expiry: d.licenceExpiry || null,
    pdp_expiry: d.pdpExpiry || null,
    assigned_vehicle_id: d.assignedVehicleId || null,
    branch: d.branch || null,
    is_active: d.isActive ?? true,
    notes: d.notes || null,
    licence_doc_url: d.licenceDocUrl || null,
});

export const toDriverUpdate = (u: Partial<Driver>): Record<string, any> => {
    const row: Record<string, any> = {};
    if (u.name !== undefined) row.name = u.name;
    if (u.cell !== undefined) row.cell = u.cell || null;
    if (u.idNumber !== undefined) row.id_number = u.idNumber || null;
    if (u.licenceNo !== undefined) row.licence_no = u.licenceNo || null;
    if (u.licenceCode !== undefined) row.licence_code = u.licenceCode || null;
    if (u.licenceExpiry !== undefined) row.licence_expiry = u.licenceExpiry || null;
    if (u.pdpExpiry !== undefined) row.pdp_expiry = u.pdpExpiry || null;
    if (u.assignedVehicleId !== undefined) row.assigned_vehicle_id = u.assignedVehicleId || null;
    if (u.branch !== undefined) row.branch = u.branch || null;
    if (u.isActive !== undefined) row.is_active = u.isActive;
    if (u.notes !== undefined) row.notes = u.notes || null;
    if (u.licenceDocUrl !== undefined) row.licence_doc_url = u.licenceDocUrl || null;
    return row;
};

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
    contacts: (row.contacts as unknown as Contact[]) ?? [],
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
    isActive: (row as any).is_active ?? true,
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
    requestData: (row as any).request_data ?? undefined,
    requestMoreInfo: (row as any).request_more_info ?? undefined,
});

// -- load_confirmations → LoadConfirmation -----------------------------------
export const mapLoadConfirmation = (row: Tables['load_confirmations']['Row'], ctx: MapperCtx): LoadConfirmation => ({
    id: row.id,
    loadConNumber: row.load_con_number,
    quoteId: row.quote_id ?? undefined,
    clientId: row.client_id ?? '',
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
    acceptedAt: (row as any).accepted_at ?? undefined,
    loadingEta: (row as any).loading_eta ?? undefined,
    deliveryEta: (row as any).delivery_eta ?? undefined,
    backDated: (row as any).back_dated ?? false,
    updatedAt: (row as any).updated_at ?? undefined,
    isCollection: (row as any).is_collection ?? false,
    unpackDepot: (row as any).unpack_depot ?? undefined,
    importStage: (row as any).import_stage ?? undefined,
    repEmail: (row as any).rep_email ?? undefined,
    collectionRef: (row as any).collection_ref ?? undefined,
    loadedPackages: (row as any).loaded_packages ?? undefined,
    loadingIssues: (row as any).loading_issues ?? undefined,
    dimensions: (row as any).dimensions ?? undefined,
    cubeM3: (row as any).cube_m3 ?? undefined,
    cargoPhotoUrls: (row as any).cargo_photo_urls ?? undefined,
    clientRequest: (row as any).client_request ?? undefined,
    clientRequestAt: (row as any).client_request_at ?? undefined,
    clientRequestStatus: (row as any).client_request_status ?? undefined,
    clientRequestReply: (row as any).client_request_reply ?? undefined,
    commodity: row.commodity ?? undefined,
    packaging: row.packaging ?? undefined,
    loadSpec: row.load_spec ?? undefined,
    arrangingBranch: row.arranging_branch ?? undefined,
    loadRefNo: row.load_ref_no ?? undefined,
    clientName: row.client_name ?? undefined,
    clientContact: row.client_contact ?? undefined,
    clientEmail: row.client_email ?? undefined,
    route: row.route ?? undefined,
    fbnRepresentative: row.fbn_representative ?? undefined,
    loadingTime: row.loading_time ?? undefined,
    offloadingTime: row.offloading_time ?? undefined,
    collectionContact: row.collection_contact ?? undefined,
    collectionTelephone: row.collection_telephone ?? undefined,
    deliveryContact: row.delivery_contact ?? undefined,
    deliveryTelephone: row.delivery_telephone ?? undefined,
    loadType: row.load_type ?? undefined,
    quantity: row.quantity ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    volume: row.volume ?? undefined,
    cargoValue: row.cargo_value ?? undefined,
    equipmentRequired: row.equipment_required ?? undefined,
    containerNo: row.container_no ?? undefined,
    containerTurnInAddress: row.container_turn_in_address ?? undefined,
    containerOperator: row.container_operator ?? undefined,
    containerSealNo: row.container_seal_no ?? undefined,
    specialInstructions: row.special_instructions ?? undefined,
    subcontractorName: row.subcontractor_name ?? undefined,
    forAttention: row.for_attention ?? undefined,
    subcontractorEmail: row.subcontractor_email ?? undefined,
    podEmail: row.pod_email ?? undefined,
    ccEmail: row.cc_email ?? undefined,
    updateCc: (row as any).cc_updates ?? undefined,
    clientCc: (row as any).client_cc ?? undefined,
    delayReason: row.delay_reason ?? undefined,
    eta: row.eta ?? undefined,
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

// =============================================================================
// Reverse mappers (domain -> DB Insert/Update). Used by write handlers in the
// domain contexts when persisting to Supabase. Schema requires `organization_id`
// on every insert (no DB default); the brief hardcodes FBN's tenant UUID until
// multi-tenancy ships.
// =============================================================================

export const FBN_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

export type BranchIdByName = Map<Branch, string>;

const resolveBranchId = (branch: Branch, branchIdByName: BranchIdByName): string => {
    const id = branchIdByName.get(branch);
    if (!id) {
        throw new Error(
            `Cannot resolve branch "${branch}" to a UUID. Branches have not hydrated yet, ` +
            `or the name does not match any row in the branches table.`,
        );
    }
    return id;
};

// -- Vehicle -> vehicles row -------------------------------------------------
export const toVehicleInsert = (
    vehicle: Omit<Vehicle, 'id'>,
    branchIdByName: BranchIdByName,
): Tables['vehicles']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    branch_id: resolveBranchId(vehicle.branch, branchIdByName),
    name: vehicle.name,
    registration: vehicle.registration,
    make: vehicle.make || null,
    model: vehicle.model || null,
    year: vehicle.year ?? null,
    vin: vehicle.vin || null,
    weight_category: vehicle.weightCategory || null,
    status: vehicle.status,
    purchase_price: vehicle.purchasePrice ?? null,
    current_value: vehicle.currentValue ?? null,
    linked_vehicle_id: vehicle.linkedVehicleId ?? null,
    current_odometer: vehicle.currentOdometer ?? null,
    current_hours: vehicle.currentHours ?? null,
    assigned_driver_id: vehicle.assignedDriverId ?? null,
    health_score: vehicle.healthScore ?? null,
    pallet_spaces: vehicle.palletSpaces ?? null,
    payload_kg: vehicle.payloadKg ?? null,
    cubic_meters: vehicle.cubicMeters ?? null,
    deck_meters: vehicle.deckMeters ?? null,
    cost_per_km_target: vehicle.costPerKmTarget ?? null,
    monthly_fixed_cost: vehicle.monthlyFixedCost ?? null,
});

export const toVehicleUpdate = (
    updates: Partial<Vehicle>,
    branchIdByName: BranchIdByName,
): Tables['vehicles']['Update'] => {
    const row: Tables['vehicles']['Update'] = {};
    if (updates.branch !== undefined) row.branch_id = resolveBranchId(updates.branch, branchIdByName);
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.registration !== undefined) row.registration = updates.registration;
    if (updates.make !== undefined) row.make = updates.make;
    if (updates.model !== undefined) row.model = updates.model;
    if (updates.year !== undefined) row.year = updates.year;
    if (updates.vin !== undefined) row.vin = updates.vin;
    if (updates.weightCategory !== undefined) row.weight_category = updates.weightCategory;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.purchasePrice !== undefined) row.purchase_price = updates.purchasePrice;
    if (updates.currentValue !== undefined) row.current_value = updates.currentValue;
    if (updates.linkedVehicleId !== undefined) row.linked_vehicle_id = updates.linkedVehicleId ?? null;
    if (updates.currentOdometer !== undefined) row.current_odometer = updates.currentOdometer;
    if (updates.currentHours !== undefined) row.current_hours = updates.currentHours;
    if (updates.assignedDriverId !== undefined) row.assigned_driver_id = updates.assignedDriverId ?? null;
    if (updates.healthScore !== undefined) row.health_score = updates.healthScore;
    if (updates.palletSpaces !== undefined) row.pallet_spaces = updates.palletSpaces;
    if (updates.payloadKg !== undefined) row.payload_kg = updates.payloadKg;
    if (updates.cubicMeters !== undefined) row.cubic_meters = updates.cubicMeters;
    if (updates.deckMeters !== undefined) row.deck_meters = updates.deckMeters;
    if (updates.costPerKmTarget !== undefined) row.cost_per_km_target = updates.costPerKmTarget;
    if (updates.monthlyFixedCost !== undefined) row.monthly_fixed_cost = updates.monthlyFixedCost;
    return row;
};

// -- FuelEntry -> fuel_entries row -------------------------------------------
export const toFuelEntryInsert = (
    entry: Omit<FuelEntry, 'id'>,
): Tables['fuel_entries']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: entry.vehicleId,
    date: entry.date,
    odometer: entry.odometer,
    liters: entry.liters,
    trip_distance_km: entry.tripDistance ?? null,
    source_bowser_id: entry.sourceBowserId ?? null,
    // Optional extras (who filled / time in notes, and per-fill cost).
    notes: (entry as any).notes ?? null,
    cost_per_liter: (entry as any).costPerLiter ?? null,
    total_cost: (entry as any).totalCost ?? null,
} as any);

// -- Client -> clients row ---------------------------------------------------
export const toClientInsert = (client: Omit<Client, 'id'>): Tables['clients']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    name: client.name,
    contact_person: client.contactPerson || null,
    contact_email: client.contactEmail || null,
    contact_phone: client.contactPhone || null,
    contacts: (client.contacts ?? []) as unknown as Tables['clients']['Insert']['contacts'],
    branches: (client.branches ?? []) as any,
    address: client.address || null,
    sla_level: client.slaLevel ?? null,
});

export const toClientUpdate = (u: Partial<Client>): Tables['clients']['Update'] => {
    const row: Tables['clients']['Update'] = {};
    if (u.name !== undefined) row.name = u.name;
    if (u.contactPerson !== undefined) row.contact_person = u.contactPerson || null;
    if (u.contactEmail !== undefined) row.contact_email = u.contactEmail || null;
    if (u.contactPhone !== undefined) row.contact_phone = u.contactPhone || null;
    if (u.contacts !== undefined) row.contacts = (u.contacts ?? []) as unknown as Tables['clients']['Update']['contacts'];
    if (u.branches !== undefined) (row as any).branches = u.branches ?? [];
    if (u.address !== undefined) row.address = u.address || null;
    if (u.slaLevel !== undefined) row.sla_level = u.slaLevel ?? null;
    return row;
};

// -- Supplier -> suppliers row -----------------------------------------------
export const toSupplierInsert = (supplier: Omit<Supplier, 'id'>): Tables['suppliers']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    name: supplier.name,
    type: supplier.type,
    contact_person: supplier.contactPerson || null,
    contact_email: supplier.contactEmail || null,
    contact_phone: supplier.contactPhone || null,
    contacts: (supplier.contacts ?? []) as unknown as Tables['suppliers']['Insert']['contacts'],
    address: supplier.address || null,
    average_rating: supplier.averageRating ?? null,
    compliance_status: supplier.complianceStatus,
    expiry_date: supplier.expiryDate ?? null,
    bee_status: supplier.beeStatus ?? null,
    haz_compliant: supplier.hazCompliant ?? null,
    specializations: supplier.specializations ?? null,
    regions: supplier.regions ?? null,
    fleet_size: supplier.fleetSize ?? null,
    controller_contact: supplier.controllerContact ?? null,
    accounts_contact: supplier.accountsContact ?? null,
});

export const toSupplierUpdate = (u: Partial<Supplier>): Tables['suppliers']['Update'] => {
    const row: Tables['suppliers']['Update'] = {};
    if (u.name !== undefined) row.name = u.name;
    if (u.type !== undefined) row.type = u.type;
    if (u.contactPerson !== undefined) row.contact_person = u.contactPerson || null;
    if (u.contactEmail !== undefined) row.contact_email = u.contactEmail || null;
    if (u.contactPhone !== undefined) row.contact_phone = u.contactPhone || null;
    if (u.contacts !== undefined) row.contacts = (u.contacts ?? []) as unknown as Tables['suppliers']['Update']['contacts'];
    if (u.address !== undefined) row.address = u.address || null;
    if (u.controllerContact !== undefined) row.controller_contact = u.controllerContact || null;
    if (u.accountsContact !== undefined) row.accounts_contact = u.accountsContact || null;
    if (u.beeStatus !== undefined) row.bee_status = u.beeStatus || null;
    if (u.regions !== undefined) row.regions = u.regions || null;
    if (u.fleetSize !== undefined) row.fleet_size = u.fleetSize || null;
    if (u.complianceStatus !== undefined) row.compliance_status = u.complianceStatus;
    return row;
};

// -- Quote -> quotes row -----------------------------------------------------
// quote_number is required by the schema (no default); handler passes one
// generated as `QU-${Date.now()}` to match the legacy reducer behavior.
export const toQuoteInsert = (
    quote: Omit<Quote, 'id' | 'quoteNumber' | 'status'>,
    quoteNumber: string,
): Tables['quotes']['Insert'] => {
    // `request_data` exists in the DB (jsonb) but isn't in the generated types
    // yet, so build via an untyped object to carry it through.
    const row: any = {
        organization_id: FBN_ORGANIZATION_ID,
        client_id: quote.clientId,
        quote_number: quoteNumber,
        date: quote.date,
        expiry_date: quote.expiryDate || null,
        items: quote.items ?? [],
        legs: quote.legs ?? [],
        total_amount: quote.totalAmount,
        status: 'Draft',
        sent_to_client: quote.sentToClient ?? false,
        customer_order_number: quote.customerOrderNumber ?? null,
        notes: quote.notes ?? null,
        special_requirements: quote.specialRequirements ?? null,
        collection_date: quote.collectionDate ?? null,
        subcontractor_quotes: quote.subcontractorQuotes ?? [],
        commodity: quote.commodity ?? null,
        packaging: quote.packaging ?? null,
        load_spec: quote.loadSpec ?? null,
        request_data: quote.requestData ?? null,
    };
    return row as Tables['quotes']['Insert'];
};

export const toQuoteUpdate = (updates: Partial<Quote>): Tables['quotes']['Update'] => {
    const row: Tables['quotes']['Update'] = {};
    if (updates.status !== undefined) row.status = updates.status as any;
    if (updates.sentToClient !== undefined) row.sent_to_client = updates.sentToClient;
    if (updates.items !== undefined) row.items = updates.items as unknown as Tables['quotes']['Update']['items'];
    if (updates.legs !== undefined) row.legs = updates.legs as unknown as Tables['quotes']['Update']['legs'];
    if (updates.totalAmount !== undefined) row.total_amount = updates.totalAmount;
    if (updates.customerOrderNumber !== undefined) row.customer_order_number = updates.customerOrderNumber ?? null;
    if (updates.notes !== undefined) row.notes = updates.notes ?? null;
    if (updates.specialRequirements !== undefined) row.special_requirements = updates.specialRequirements ?? null;
    if (updates.collectionDate !== undefined) row.collection_date = updates.collectionDate ?? null;
    if (updates.subcontractorQuotes !== undefined) row.subcontractor_quotes = updates.subcontractorQuotes as unknown as Tables['quotes']['Update']['subcontractor_quotes'];
    if (updates.commodity !== undefined) row.commodity = updates.commodity ?? null;
    if (updates.packaging !== undefined) row.packaging = updates.packaging ?? null;
    if (updates.loadSpec !== undefined) row.load_spec = updates.loadSpec ?? null;
    if (updates.requestData !== undefined) (row as any).request_data = updates.requestData ?? null;
    if (updates.date !== undefined) row.date = updates.date;
    if (updates.expiryDate !== undefined) row.expiry_date = updates.expiryDate ?? null;
    return row;
};

// -- LoadConfirmation -> load_confirmations row ------------------------------
export const toLoadConfirmationInsert = (
    lc: Omit<LoadConfirmation, 'id' | 'loadConNumber' | 'status' | 'date'>,
    loadConNumber: string,
    branchIdByName: BranchIdByName,
): Tables['load_confirmations']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    client_id: lc.clientId || null,
    load_con_number: loadConNumber,
    quote_id: lc.quoteId ?? null,
    supplier_id: lc.supplierId ?? null,
    items: (lc.items ?? []) as unknown as Tables['load_confirmations']['Insert']['items'],
    legs: (lc.legs ?? []) as unknown as Tables['load_confirmations']['Insert']['legs'],
    total_amount: lc.totalAmount,
    supplier_rate: lc.supplierRate ?? null,
    collection_branch_id: branchIdByName.get(lc.collectionBranch) ?? null,
    destination_branch_id: branchIdByName.get(lc.destinationBranch) ?? null,
    priority: lc.priority,
    status: 'Booked',
    collection_point: lc.collectionPoint || null,
    delivery_point: lc.deliveryPoint || null,
    collection_date: lc.collectionDate ?? null,
    delivery_date: lc.deliveryDate ?? null,
    vehicle_id: lc.vehicleId ?? null,
    driver_id: lc.driverId ?? null,
    payment_status: lc.paymentStatus ?? null,
    customer_order_number: lc.customerOrderNumber ?? null,
    invoice_number: lc.invoiceNumber ?? null,
    invoice_date: lc.invoiceDate ?? null,
    damage_report: lc.damageReport ?? null,
    notes: (lc.notes ?? null) as unknown as Tables['load_confirmations']['Insert']['notes'],
    delivery_area: lc.deliveryArea ?? null,
    sent_to_supplier_date: lc.sentToSupplierDate ?? null,
    subcontractor_vehicle_reg: lc.subcontractorVehicleReg ?? null,
    subcontractor_driver_name: lc.subcontractorDriverName ?? null,
    subcontractor_driver_cell: lc.subcontractorDriverCell ?? null,
    commodity: lc.commodity ?? null,
    packaging: lc.packaging ?? null,
    load_spec: lc.loadSpec ?? null,
    arranging_branch: lc.arrangingBranch ?? null,
    load_ref_no: lc.loadRefNo ?? null,
    client_name: lc.clientName ?? null,
    client_contact: lc.clientContact ?? null,
    client_email: lc.clientEmail ?? null,
    route: lc.route ?? null,
    fbn_representative: lc.fbnRepresentative ?? null,
    loading_time: lc.loadingTime ?? null,
    offloading_time: lc.offloadingTime ?? null,
    collection_contact: lc.collectionContact ?? null,
    collection_telephone: lc.collectionTelephone ?? null,
    delivery_contact: lc.deliveryContact ?? null,
    delivery_telephone: lc.deliveryTelephone ?? null,
    load_type: lc.loadType ?? null,
    quantity: lc.quantity ?? null,
    weight_kg: lc.weightKg ?? null,
    volume: lc.volume ?? null,
    cargo_value: lc.cargoValue ?? null,
    equipment_required: lc.equipmentRequired ?? null,
    container_no: lc.containerNo ?? null,
    container_turn_in_address: lc.containerTurnInAddress ?? null,
    container_operator: lc.containerOperator ?? null,
    container_seal_no: lc.containerSealNo ?? null,
    special_instructions: lc.specialInstructions ?? null,
    subcontractor_name: lc.subcontractorName ?? null,
    for_attention: lc.forAttention ?? null,
    subcontractor_email: lc.subcontractorEmail ?? null,
    pod_email: lc.podEmail ?? null,
    cc_email: lc.ccEmail ?? null,
    delay_reason: lc.delayReason ?? null,
    eta: lc.eta ?? null,
});

// -- HRCase -> hr_cases row --------------------------------------------------
export const toHRCaseInsert = (c: Omit<HRCase, 'id'>): Tables['hr_cases']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    driver_id: c.driverId,
    damage_reason: c.damageReason,
    cost_to_recover: c.costToRecover,
    incident_id: c.incidentId ?? null,
    tire_id: c.tireId ?? null,
    vehicle_id: c.vehicleId ?? null,
    reported_date: c.reportedDate,
    status: c.status,
});

export const toHRCaseUpdate = (c: HRCase): Tables['hr_cases']['Update'] => ({
    driver_id: c.driverId,
    damage_reason: c.damageReason,
    cost_to_recover: c.costToRecover,
    incident_id: c.incidentId ?? null,
    tire_id: c.tireId ?? null,
    vehicle_id: c.vehicleId ?? null,
    status: c.status,
});

// -- IncidentReport -> incident_reports row ----------------------------------
// File uploads to Storage are deferred; attachment_urls inserted as the
// existing Attachment.data values (which currently hold base64 strings or
// URLs depending on origin). When Storage wiring lands, replace those with
// supabase.storage.upload() returned paths.
export const toIncidentInsert = (
    i: Omit<IncidentReport, 'id'>,
): Tables['incident_reports']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    user_id: i.userId || null,
    vehicle_id: i.vehicleId || null,
    date: i.date,
    incident_type: i.incidentType,
    description: i.description,
    third_party_involved: i.thirdPartyInvolved,
    attachment_urls: (i.attachments || []).map(a => a.data).filter(Boolean),
    status: i.status,
    quotes: (i.quotes ?? null) as unknown as Tables['incident_reports']['Insert']['quotes'],
    notes: i.notes ?? null,
    at_fault_party: i.atFaultParty ?? null,
    insurance_claim_number: i.insuranceClaimNumber ?? null,
    saps_case_number: i.sapsCaseNumber ?? null,
    final_repairer: i.finalRepairer ?? null,
    final_repair_cost: i.finalRepairCost ?? null,
    fine_number: i.fineNumber ?? null,
    fine_amount: i.fineAmount ?? null,
    violation_code: i.violationCode ?? null,
});

export const toIncidentUpdate = (i: IncidentReport): Tables['incident_reports']['Update'] => ({
    date: i.date,
    incident_type: i.incidentType,
    description: i.description,
    third_party_involved: i.thirdPartyInvolved,
    attachment_urls: (i.attachments || []).map(a => a.data).filter(Boolean),
    status: i.status,
    quotes: (i.quotes ?? null) as unknown as Tables['incident_reports']['Update']['quotes'],
    notes: i.notes ?? null,
    at_fault_party: i.atFaultParty ?? null,
    insurance_claim_number: i.insuranceClaimNumber ?? null,
    saps_case_number: i.sapsCaseNumber ?? null,
    final_repairer: i.finalRepairer ?? null,
    final_repair_cost: i.finalRepairCost ?? null,
    fine_number: i.fineNumber ?? null,
    fine_amount: i.fineAmount ?? null,
    violation_code: i.violationCode ?? null,
});

// -- Budget -> budgets row ---------------------------------------------------
// target_type required by schema; default 'vehicle' until the Budget domain
// gets an explicit target type field.
export const toBudgetInsert = (b: Omit<Budget, 'id'>): Tables['budgets']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    target_id: b.targetId,
    target_type: 'vehicle',
    amount: b.amount,
    start_date: b.startDate,
    period: b.period,
});

// -- Forecast -> forecasts row -----------------------------------------------
export const toForecastInsert = (f: Omit<Forecast, 'id'>): Tables['forecasts']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    target_id: f.targetId,
    target_type: 'vehicle',
    generated_date: f.generatedDate,
    forecasted_costs: f.forecastedCosts as unknown as Tables['forecasts']['Insert']['forecasted_costs'],
    insights: f.insights || null,
});

// -- ServiceEntry -> service_entries row -------------------------------------
export const toServiceEntryInsert = (s: Omit<ServiceEntry, 'id'>): Tables['service_entries']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: s.vehicleId,
    date: s.date,
    start_odometer: s.startOdometer ?? null,
    end_odometer: s.endOdometer ?? null,
    start_hours: s.startHours ?? null,
    end_hours: s.endHours ?? null,
    description: s.description,
    cost: s.cost,
    attachment_url: s.attachment?.data ?? null,
    attachment_name: s.attachment?.name ?? null,
});

// -- OtherCost -> other_costs row --------------------------------------------
export const toOtherCostInsert = (c: Omit<OtherCost, 'id'>): Tables['other_costs']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: c.vehicleId || null,
    date: c.date,
    category: c.category,
    amount: c.amount,
});

// -- RecurringCost -> recurring_costs row ------------------------------------
export const toRecurringCostInsert = (c: Omit<RecurringCost, 'id'>): Tables['recurring_costs']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: c.vehicleId || null,
    category: c.category,
    amount: c.amount,
    frequency: c.frequency,
    start_date: c.startDate,
    end_date: c.endDate ?? null,
});

// -- RevenueEntry -> revenue_entries row -------------------------------------
export const toRevenueEntryInsert = (r: Omit<RevenueEntry, 'id'>): Tables['revenue_entries']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: r.vehicleId || null,
    date: r.date,
    description: r.description,
    amount: r.amount,
});

// -- FuelPriceRecord -> fuel_prices row --------------------------------------
export const toFuelPriceInsert = (f: Omit<FuelPriceRecord, 'id'>): Tables['fuel_prices']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    start_date: f.startDate,
    price_per_liter: f.pricePerLiter,
});

// -- JobCard -> job_cards row ------------------------------------------------
export const toJobCardInsert = (jc: Omit<JobCard, 'id'>): Tables['job_cards']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: jc.vehicleId,
    item_description: jc.itemDescription,
    type: jc.type,
    status: jc.status,
    priority: jc.priority,
    severity: jc.severity,
    submission_id: jc.submissionId ?? null,
    checklist_item_id: jc.checklistItemId ?? null,
    service_interval_id: jc.serviceIntervalId ?? null,
    reporter_notes: jc.reporterNotes ?? null,
    reporter_attachment_url: jc.reporterAttachment?.data ?? null,
    assigned_to_user_id: jc.assignedToUserId ?? null,
    reported_date: jc.reportedDate,
    completion_date: jc.completionDate ?? null,
    labor_hours: jc.laborHours ?? null,
    notes: (jc.notes ?? null) as unknown as Tables['job_cards']['Insert']['notes'],
    parts_used: (jc.partsUsed ?? null) as unknown as Tables['job_cards']['Insert']['parts_used'],
    proposed_start_date: jc.proposedStartDate ?? null,
    proposed_end_date: jc.proposedEndDate ?? null,
});

export const toJobCardUpdate = (updates: Partial<JobCard>): Tables['job_cards']['Update'] => {
    const row: Tables['job_cards']['Update'] = {};
    if (updates.itemDescription !== undefined) row.item_description = updates.itemDescription;
    if (updates.type !== undefined) row.type = updates.type;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.priority !== undefined) row.priority = updates.priority;
    if (updates.severity !== undefined) row.severity = updates.severity;
    if (updates.reporterNotes !== undefined) row.reporter_notes = updates.reporterNotes ?? null;
    if (updates.assignedToUserId !== undefined) row.assigned_to_user_id = updates.assignedToUserId ?? null;
    if (updates.completionDate !== undefined) row.completion_date = updates.completionDate ?? null;
    if (updates.laborHours !== undefined) row.labor_hours = updates.laborHours ?? null;
    if (updates.notes !== undefined) row.notes = updates.notes as unknown as Tables['job_cards']['Update']['notes'];
    if (updates.partsUsed !== undefined) row.parts_used = updates.partsUsed as unknown as Tables['job_cards']['Update']['parts_used'];
    if (updates.proposedStartDate !== undefined) row.proposed_start_date = updates.proposedStartDate ?? null;
    if (updates.proposedEndDate !== undefined) row.proposed_end_date = updates.proposedEndDate ?? null;
    return row;
};

// -- Part -> parts row -------------------------------------------------------
export const toPartInsert = (part: Omit<Part, 'id'>): Tables['parts']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    name: part.name,
    part_number: part.partNumber ?? null,
    supplier_id: part.supplierId ?? null,
    quantity_in_stock: part.quantityInStock,
    min_stock_level: part.minStockLevel,
    cost: part.cost,
    branch_id: part.branchId ?? null,
});

// -- PurchaseRequest -> purchase_requests row --------------------------------
export const toPurchaseRequestInsert = (
    req: Omit<PurchaseRequest, 'id' | 'requestedDate' | 'status'>,
): Tables['purchase_requests']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    part_id: req.partId || null,
    job_card_id: req.jobCardId ?? null,
    quantity: req.quantity,
    requested_by_user_id: req.requestedByUserId || null,
    is_urgent: req.isUrgent,
    status: 'Pending',
    quotes: (req.quotes ?? null) as unknown as Tables['purchase_requests']['Insert']['quotes'],
});

// -- Tire -> tires row -------------------------------------------------------
export const toTireUpdate = (tire: Tire): Tables['tires']['Update'] => ({
    serial_number: tire.serialNumber,
    brand: tire.brand || null,
    size: tire.size || null,
    type: tire.type,
    purchase_date: tire.purchaseDate || null,
    purchase_price: tire.purchasePrice ?? null,
    status: tire.status,
    assigned_vehicle_id: tire.assignedVehicleId ?? null,
    assigned_position: tire.assignedPosition ?? null,
    retread_details: (tire.retreadDetails ?? null) as unknown as Tables['tires']['Update']['retread_details'],
});

// -- PlannedService -> planned_services row ----------------------------------
export const toPlannedServiceInsert = (ps: Omit<PlannedService, 'id'>): Tables['planned_services']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: ps.vehicleId,
    description: ps.description,
    start_date: ps.startDate,
    end_date: ps.endDate,
});

// -- ServiceInterval -> service_intervals row --------------------------------
export const toServiceIntervalInsert = (
    si: Omit<ServiceInterval, 'id'>,
): Tables['service_intervals']['Insert'] => ({
    organization_id: FBN_ORGANIZATION_ID,
    vehicle_id: si.vehicleId,
    description: si.description,
    distance_interval: si.distanceInterval,
    time_interval_days: si.timeIntervalDays,
    hours_interval: si.hoursInterval,
});

export const toLoadConfirmationUpdate = (
    updates: Partial<LoadConfirmation>,
    branchIdByName: BranchIdByName,
): Tables['load_confirmations']['Update'] => {
    const row: Tables['load_confirmations']['Update'] = {};
    if (updates.clientId !== undefined) row.client_id = updates.clientId;
    if (updates.quoteId !== undefined) row.quote_id = updates.quoteId ?? null;
    if (updates.supplierId !== undefined) row.supplier_id = updates.supplierId ?? null;
    if (updates.items !== undefined) row.items = updates.items as unknown as Tables['load_confirmations']['Update']['items'];
    if (updates.legs !== undefined) row.legs = updates.legs as unknown as Tables['load_confirmations']['Update']['legs'];
    if (updates.totalAmount !== undefined) row.total_amount = updates.totalAmount;
    if (updates.supplierRate !== undefined) row.supplier_rate = updates.supplierRate ?? null;
    if (updates.collectionBranch !== undefined) row.collection_branch_id = branchIdByName.get(updates.collectionBranch) ?? null;
    if (updates.destinationBranch !== undefined) row.destination_branch_id = branchIdByName.get(updates.destinationBranch) ?? null;
    if (updates.priority !== undefined) row.priority = updates.priority;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.collectionPoint !== undefined) row.collection_point = updates.collectionPoint || null;
    if (updates.deliveryPoint !== undefined) row.delivery_point = updates.deliveryPoint || null;
    if (updates.collectionDate !== undefined) row.collection_date = updates.collectionDate ?? null;
    if (updates.deliveryDate !== undefined) row.delivery_date = updates.deliveryDate ?? null;
    if (updates.vehicleId !== undefined) row.vehicle_id = updates.vehicleId ?? null;
    if (updates.driverId !== undefined) row.driver_id = updates.driverId ?? null;
    if (updates.paymentStatus !== undefined) row.payment_status = updates.paymentStatus ?? null;
    if (updates.customerOrderNumber !== undefined) row.customer_order_number = updates.customerOrderNumber ?? null;
    if (updates.invoiceNumber !== undefined) row.invoice_number = updates.invoiceNumber ?? null;
    if (updates.invoiceDate !== undefined) row.invoice_date = updates.invoiceDate ?? null;
    if (updates.damageReport !== undefined) row.damage_report = updates.damageReport ?? null;
    if (updates.notes !== undefined) row.notes = updates.notes as unknown as Tables['load_confirmations']['Update']['notes'];
    if (updates.deliveryArea !== undefined) row.delivery_area = updates.deliveryArea ?? null;
    if (updates.sentToSupplierDate !== undefined) row.sent_to_supplier_date = updates.sentToSupplierDate ?? null;
    if (updates.subcontractorVehicleReg !== undefined) row.subcontractor_vehicle_reg = updates.subcontractorVehicleReg ?? null;
    if (updates.subcontractorDriverName !== undefined) row.subcontractor_driver_name = updates.subcontractorDriverName ?? null;
    if ((updates as any).clientRequestStatus !== undefined) (row as any).client_request_status = (updates as any).clientRequestStatus ?? null;
    if ((updates as any).clientRequestReply !== undefined) (row as any).client_request_reply = (updates as any).clientRequestReply ?? null;
    if ((updates as any).unpackDepot !== undefined) (row as any).unpack_depot = (updates as any).unpackDepot ?? null;
    if ((updates as any).importStage !== undefined) (row as any).import_stage = (updates as any).importStage ?? null;
    if ((updates as any).collectionRef !== undefined) (row as any).collection_ref = (updates as any).collectionRef ?? null;
    if (updates.subcontractorDriverCell !== undefined) row.subcontractor_driver_cell = updates.subcontractorDriverCell ?? null;
    // Transport Order document fields — needed so assigning a subbie (and later
    // edits) persist the details that print on the LoadCon / Client Order.
    if (updates.subcontractorName !== undefined) row.subcontractor_name = updates.subcontractorName ?? null;
    if (updates.subcontractorEmail !== undefined) row.subcontractor_email = updates.subcontractorEmail ?? null;
    if (updates.forAttention !== undefined) row.for_attention = updates.forAttention ?? null;
    if (updates.podEmail !== undefined) row.pod_email = updates.podEmail ?? null;
    if (updates.ccEmail !== undefined) row.cc_email = updates.ccEmail ?? null;
    if ((updates as any).updateCc !== undefined) (row as any).cc_updates = (updates as any).updateCc ?? null;
    if (updates.clientName !== undefined) row.client_name = updates.clientName ?? null;
    if (updates.clientContact !== undefined) row.client_contact = updates.clientContact ?? null;
    if (updates.clientEmail !== undefined) row.client_email = updates.clientEmail ?? null;
    if (updates.commodity !== undefined) row.commodity = updates.commodity ?? null;
    if (updates.packaging !== undefined) row.packaging = updates.packaging ?? null;
    if (updates.loadSpec !== undefined) row.load_spec = updates.loadSpec ?? null;
    // Remaining Transport Order fields, so a full edit persists everything.
    if (updates.arrangingBranch !== undefined) row.arranging_branch = updates.arrangingBranch ?? null;
    if (updates.loadRefNo !== undefined) row.load_ref_no = updates.loadRefNo ?? null;
    if (updates.route !== undefined) row.route = updates.route ?? null;
    if (updates.fbnRepresentative !== undefined) row.fbn_representative = updates.fbnRepresentative ?? null;
    if (updates.loadingTime !== undefined) row.loading_time = updates.loadingTime ?? null;
    if (updates.offloadingTime !== undefined) row.offloading_time = updates.offloadingTime ?? null;
    if (updates.collectionContact !== undefined) row.collection_contact = updates.collectionContact ?? null;
    if (updates.collectionTelephone !== undefined) row.collection_telephone = updates.collectionTelephone ?? null;
    if (updates.deliveryContact !== undefined) row.delivery_contact = updates.deliveryContact ?? null;
    if (updates.deliveryTelephone !== undefined) row.delivery_telephone = updates.deliveryTelephone ?? null;
    if (updates.loadType !== undefined) row.load_type = updates.loadType ?? null;
    if (updates.quantity !== undefined) row.quantity = updates.quantity ?? null;
    if (updates.weightKg !== undefined) row.weight_kg = updates.weightKg ?? null;
    if (updates.volume !== undefined) row.volume = updates.volume ?? null;
    if (updates.cargoValue !== undefined) row.cargo_value = updates.cargoValue ?? null;
    if (updates.equipmentRequired !== undefined) row.equipment_required = updates.equipmentRequired ?? null;
    if (updates.containerNo !== undefined) row.container_no = updates.containerNo ?? null;
    if (updates.containerTurnInAddress !== undefined) row.container_turn_in_address = updates.containerTurnInAddress ?? null;
    if (updates.containerOperator !== undefined) row.container_operator = updates.containerOperator ?? null;
    if (updates.containerSealNo !== undefined) row.container_seal_no = updates.containerSealNo ?? null;
    if (updates.specialInstructions !== undefined) row.special_instructions = updates.specialInstructions ?? null;
    if (updates.podPhoto?.data) row.pod_photo_url = updates.podPhoto.data;
    if (updates.podSignature !== undefined) row.pod_signature_url = updates.podSignature ?? null;
    return row;
};
