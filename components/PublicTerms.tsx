import React from 'react';
import { SLA_CLAUSES as CLAUSES, SLA_INTRO } from '../lib/subcontractorSla';

const NAVY = '#13294b';
const YELLOW = '#f5b700';

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
                <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.5 }}>{SLA_INTRO}</p>
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
