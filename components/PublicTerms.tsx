import React from 'react';

const NAVY = '#13294b';
const YELLOW = '#f5b700';

const CLAUSES: { t: string; b: string }[] = [
    { t: 'Liability', b: 'Upon loading of the cargo, the Sub-Contractor agrees to be held liable for any claim arising from any loss, damage, fines, penalties, personal injury or death arising out of the rendering of the Services in terms of the Subcontractor Standard Terms and Conditions, and thereby indemnifies and holds FBN Transport CC harmless in respect of any such claim.' },
    { t: 'Insurance', b: 'The Sub-Contractor confirms that he has adequate Comprehensive Motor Vehicle Liability Insurance for all vehicles, including third-party liability, so FBN Transport CC bears no risk for damage to third-party property; and adequate Carrier’s Liability Insurance for loss or damage to goods of a minimum of R800 000,00 per load (or more where goods in transit exceed R800 000,00 per load).' },
    { t: 'Cession', b: 'The Sub-Contractor cedes all rights in and to any insurance claim in respect of Services rendered on behalf of FBN Transport CC in favour of FBN Transport CC, and authorises that any such claim payment be made by the Sub-Contractor’s insurer directly to FBN Transport CC. This cession is irrevocable.' },
    { t: 'Loading & off-loading points', b: 'It is the Sub-Contractor’s responsibility to check that the loading and off-loading points correspond with this Transport Order.' },
    { t: 'All vehicles to be weighed / checked before departure', b: 'The Sub-Contractor accepts liability for consequential costs of loading and/or overloading. The correct quantity must be loaded at collection and off-loaded at destination. Packing material quality is checked by the driver and any discrepancies / irregularities / endorsements must be reported before departure to FBN Transport CC. Responsibility is discharged once the full consignment is delivered and signed for at the delivery address.' },
    { t: 'Fines & penalties', b: 'The Sub-Contractor is at all times liable for any fines or penalties incurred whilst rendering Services, including overloading, incorrect weight distribution, exceeding weight limits, speeding and permit violations per RTQS.' },
    { t: 'Documents', b: 'Any documents given to the driver by the client must be returned to FBN Transport CC.' },
    { t: 'Shortages or damaged goods', b: 'Any loss or damage to the cargo MUST be noted on the delivery note at the time of delivery. Any endorsements on the documents must be reported to FBN Transport CC before departure, failing which the Sub-Contractor will be held liable and deductions may be made from your account unless proven otherwise.' },
    { t: 'Delays', b: 'FBN Transport CC will not be responsible for delays at loading or off-loading.' },
    { t: 'Containers', b: 'Containers must be returned timeously, failing which all demurrage charges will be for your account and set off against your invoice.' },
    { t: 'Off-set', b: 'The Sub-Contractor agrees to allow FBN Transport CC to off-set / deduct any costs incurred for fines, penalties, losses, damages, shortages or any other liability howsoever caused from any and all monies otherwise payable by FBN Transport to the Sub-Contractor.' },
];

const PublicTerms: React.FC = () => (
    <div style={{ minHeight: '100vh', background: '#eef2f6', padding: '24px 14px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ background: '#fff', padding: '20px 28px', borderBottom: `3px solid ${NAVY}` }}>
                <img src="/fbn-logo.jpg" alt="FBN Transport" style={{ height: 46 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <div style={{ color: NAVY, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>Commercial Freight Specialists</div>
            </div>
            <div style={{ height: 4, background: YELLOW }} />
            <div style={{ padding: '28px' }}>
                <h1 style={{ color: NAVY, fontSize: 22, margin: '0 0 6px' }}>Subcontractor Terms &amp; Conditions</h1>
                <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.5 }}>All services rendered by the Sub-Contractor are subject to FBN Transport CC’s Subcontractor Standard Terms and Conditions. By agreeing to carry a load, the Sub-Contractor agrees to be bound by these terms as well as the conditions on the Transport Order.</p>
                <ol style={{ color: '#1f2937', fontSize: 13.5, lineHeight: 1.6, paddingLeft: 20, marginTop: 18 }}>
                    {CLAUSES.map((c, i) => (
                        <li key={i} style={{ marginBottom: 14 }}>
                            <strong style={{ color: NAVY }}>{c.t}:</strong> {c.b}
                        </li>
                    ))}
                </ol>
                <p style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                    FBN Transport CC &middot; Durban Head Office &middot; tracking@fbn-transport.co.za
                </p>
            </div>
        </div>
    </div>
);

export default PublicTerms;
