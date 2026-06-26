// Single source of truth for the FBN Transport subcontractor SLA / Standard Terms
// & Conditions. Used by the public Terms page (components/PublicTerms.tsx) AND the
// supplier-registration agreement step (components/supplier/SupplierRegister.tsx),
// and rendered into the acceptance PDF by the supplier-register edge function.
export const SLA_COMPANY = 'FBN Transport CC';
export const SLA_REG_NO = '1989/001182/23';
export const SLA_GIT_MIN = 'R1 500 000,00';

export const SLA_INTRO =
    `All services rendered by the Sub-Contractor are subject to ${SLA_COMPANY} (Registration No ${SLA_REG_NO})'s ` +
    `Subcontractor Standard Terms and Conditions. By agreeing to carry a load, the Sub-Contractor agrees to be ` +
    `bound by these terms as well as the conditions on the Transport Order.`;

export interface SlaClause { t: string; b: string; }

export const SLA_CLAUSES: SlaClause[] = [
    { t: 'Liability', b: `Upon loading of the cargo, the Sub-Contractor agrees to be held liable for any claim arising from any loss, damage, fines, penalties, personal injury or death arising out of the rendering of the Services in terms of the Subcontractor Standard Terms and Conditions, and thereby indemnifies and holds ${SLA_COMPANY} harmless in respect of any such claim.` },
    { t: 'Insurance', b: `The Sub-Contractor confirms that he has adequate Comprehensive Motor Vehicle Liability Insurance for all vehicles, including third-party liability, so ${SLA_COMPANY} bears no risk for damage to third-party property; and adequate Goods-in-Transit / Carrier's Liability Insurance for loss or damage to goods of a minimum of ${SLA_GIT_MIN} per load (or more where goods in transit exceed ${SLA_GIT_MIN} per load).` },
    { t: 'Cession', b: `The Sub-Contractor cedes all rights in and to any insurance claim in respect of Services rendered on behalf of ${SLA_COMPANY} in favour of ${SLA_COMPANY}, and authorises that any such claim payment be made by the Sub-Contractor's insurer directly to ${SLA_COMPANY}. This cession is irrevocable.` },
    { t: 'Loading & off-loading points', b: 'It is the Sub-Contractor’s responsibility to check that the loading and off-loading points correspond with this Transport Order.' },
    { t: 'All vehicles to be weighed / checked before departure', b: `The Sub-Contractor accepts liability for consequential costs of loading and/or overloading. The correct quantity must be loaded at collection and off-loaded at destination. Packing material quality is checked by the driver and any discrepancies / irregularities / endorsements must be reported before departure to ${SLA_COMPANY}. Responsibility is discharged once the full consignment is delivered and signed for at the delivery address.` },
    { t: 'Fines & penalties', b: 'The Sub-Contractor is at all times liable for any fines or penalties incurred whilst rendering Services, including overloading, incorrect weight distribution, exceeding weight limits, speeding and permit violations per RTQS.' },
    { t: 'Documents', b: `Any documents given to the driver by the client must be returned to ${SLA_COMPANY}.` },
    { t: 'Shortages or damaged goods', b: `Any loss or damage to the cargo MUST be noted on the delivery note at the time of delivery. Any endorsements on the documents must be reported to ${SLA_COMPANY} before departure, failing which the Sub-Contractor will be held liable and deductions may be made from your account unless proven otherwise.` },
    { t: 'Delays', b: `${SLA_COMPANY} will not be responsible for delays at loading or off-loading.` },
    { t: 'Containers', b: 'Containers must be returned timeously, failing which all demurrage charges will be for your account and set off against your invoice.' },
    { t: 'Off-set', b: `The Sub-Contractor agrees to allow ${SLA_COMPANY} to off-set / deduct any costs incurred for fines, penalties, losses, damages, shortages or any other liability howsoever caused from any and all monies otherwise payable by ${SLA_COMPANY} to the Sub-Contractor.` },
    { t: 'Signature & electronic acceptance', b: `By accepting this agreement the Sub-Contractor warrants that the person accepting is duly authorised to bind the Sub-Contractor. The parties agree that electronic acceptance of this agreement via the FBN Transport supplier portal constitutes a valid signature in terms of the Electronic Communications and Transactions Act 25 of 2002.` },
];
