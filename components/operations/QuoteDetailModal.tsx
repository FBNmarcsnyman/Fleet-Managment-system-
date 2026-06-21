import React, { useState } from 'react';
import { Quote, Client } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { supabase } from '../../lib/supabase';

const NAVY = '#13294b';
const YELLOW = '#f5b700';
const GREEN = '#16a34a';

const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
    if (!value) return null;
    return (
        <div className="py-2 border-b border-gray-700/30">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
            <div className="text-sm text-white">{value}</div>
        </div>
    );
};

const QuoteDetailModal: React.FC<{
    quote: Quote;
    client?: Client;
    onClose: () => void;
    onQuoteIt: (quote: Quote) => void;
    onSendQuote?: (quote: Quote) => Promise<void>;
}> = ({ quote, client, onClose, onQuoteIt, onSendQuote }) => {
    const { showToast } = useUIState();
    const [requesting, setRequesting] = useState(false);
    const [sending, setSending] = useState(false);
    const rd = quote.requestData || {};
    const mi = quote.requestMoreInfo || {};

    const handleRequestMoreInfo = async () => {
        setRequesting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const resp = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-request-info`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ quote_id: quote.id }),
                }
            );
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            showToast(`"More Info" email sent to ${data.sent_to}`);
            onClose();
        } catch (e: any) {
            showToast(`Failed: ${e.message}`);
        } finally {
            setRequesting(false);
        }
    };

    const equipLabels: Record<string, string> = {
        crane_truck: '🏗️ Crane truck',
        forklift: '🏭 Forklift',
        driver_hire: '👷 Driver hire',
        taillift_collection: '⬆️ Tail-lift (collection)',
        taillift_delivery: '⬇️ Tail-lift (delivery)',
        labour: '💪 Labour',
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="rounded-t-lg -m-6 mb-6 p-6 pb-4" style={{ background: NAVY }}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: YELLOW }}>
                            Quote Request
                        </div>
                        <h2 className="text-2xl font-bold text-white mt-1">{quote.quoteNumber}</h2>
                        {client && <p className="text-gray-400 text-sm mt-1">{client.name}</p>}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        quote.status === 'Requested' ? 'bg-amber-900/50 text-amber-300' :
                        quote.status === 'More Info Requested' ? 'bg-purple-900/50 text-purple-300' :
                        quote.status === 'Draft' ? 'bg-gray-700 text-gray-300' :
                        'bg-blue-900/50 text-blue-300'
                    }`}>{quote.status}</span>
                </div>
                <div className="h-1 rounded mt-4" style={{ background: YELLOW }} />
            </div>

            {/* Contact Details */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide mb-3">👤 Contact Details</h3>
                <div className="grid grid-cols-2 gap-x-6">
                    <Field label="Company" value={rd.company_name || client?.name} />
                    <Field label="Contact Person" value={rd.contact_person || client?.contactPerson} />
                    <Field label="Email" value={rd.email || client?.contactEmail} />
                    <Field label="Phone" value={rd.phone || client?.contactPhone} />
                </div>
            </div>

            {/* Route */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide mb-3">🚚 Route</h3>
                <div className="grid grid-cols-2 gap-x-6">
                    <Field label="Collect From" value={rd.collect_from} />
                    <Field label="Deliver To" value={rd.deliver_to} />
                    <Field label="Collection Area" value={rd.collection_area} />
                    <Field label="Delivery Area" value={rd.delivery_area} />
                </div>
            </div>

            {/* Cargo Details */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide mb-3">📋 Cargo Details</h3>
                <div className="grid grid-cols-2 gap-x-6">
                    <Field label="Commodity" value={rd.commodity || quote.commodity} />
                    <Field label="Packages" value={rd.packages || quote.packaging} />
                    <Field label="Load Type" value={rd.load_type || quote.loadSpec} />
                    <Field label="Total Weight" value={rd.total_weight ? `${rd.total_weight} kg` : undefined} />
                    <Field label="Loading Date" value={rd.loading_date || quote.collectionDate} />
                    <Field label="Hazardous (DG)" value={rd.hazardous ? 'YES' : undefined} />
                    <Field label="Cross-border" value={rd.cross_border ? 'YES' : undefined} />
                </div>
                {rd.notes && <Field label="Notes" value={rd.notes} />}
            </div>

            {/* Additional Info (if submitted) */}
            {mi.submitted_at && (
                <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-green-800/50">
                    <h3 className="text-sm font-bold text-green-400 uppercase tracking-wide mb-3">📐 Additional Details Received</h3>
                    {mi.commodity_details && <Field label="Detailed Commodity" value={mi.commodity_details} />}
                    {mi.dimensions?.length > 0 && (
                        <div className="py-2 border-b border-gray-700/30">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Dimensions</div>
                            <table className="w-full text-sm">
                                <thead><tr className="text-gray-400 text-xs">
                                    <th className="text-left pb-1">L (cm)</th><th className="text-left pb-1">W (cm)</th><th className="text-left pb-1">H (cm)</th><th className="text-left pb-1">Qty</th><th className="text-left pb-1">CBM</th>
                                </tr></thead>
                                <tbody>
                                    {mi.dimensions.map((d: any, i: number) => (
                                        <tr key={i} className="text-white">
                                            <td>{d.length_cm}</td><td>{d.width_cm}</td><td>{d.height_cm}</td><td>{d.qty}</td>
                                            <td>{((d.length_cm * d.width_cm * d.height_cm * d.qty) / 1000000).toFixed(3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {mi.total_cube && <Field label="Total Cube" value={`${mi.total_cube} m³`} />}
                    {mi.special_instructions && <Field label="Special Instructions" value={mi.special_instructions} />}
                    {mi.equipment && Object.entries(mi.equipment).some(([, v]) => v) && (
                        <div className="py-2">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Equipment Required</div>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(mi.equipment).filter(([, v]) => v).map(([k]) => (
                                    <span key={k} className="bg-green-900/30 text-green-300 text-xs font-bold px-2 py-1 rounded">
                                        {equipLabels[k] || k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            {(quote.status === 'Requested' || quote.status === 'More Info Requested') && (
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => onQuoteIt(quote)}
                        className="btn-on-color flex-1 py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:brightness-110"
                        style={{ background: GREEN }}
                    >
                        Quote It →
                    </button>
                    <button
                        onClick={handleRequestMoreInfo}
                        disabled={requesting}
                        className="btn-on-color flex-1 py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:brightness-110"
                        style={{ background: NAVY }}
                    >
                        {requesting ? 'Sending...' : 'Request More Info'}
                    </button>
                </div>
            )}

            {quote.status === 'Draft' && onSendQuote && (
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={async () => {
                            setSending(true);
                            try { await onSendQuote(quote); onClose(); } catch {} finally { setSending(false); }
                        }}
                        disabled={sending}
                        className="btn-on-color flex-1 py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:brightness-110"
                        style={{ background: GREEN }}
                    >
                        {sending ? 'Sending...' : 'Send Quote to Client →'}
                    </button>
                </div>
            )}

            {quote.status === 'Sent' && (
                <div className="mt-6 text-center py-3 rounded-lg bg-blue-900/30 text-blue-300 text-sm font-bold uppercase tracking-wide">
                    Quote sent — awaiting client response
                </div>
            )}

            {quote.status === 'Accepted' && (
                <div className="mt-6 text-center py-3 rounded-lg bg-green-900/30 text-green-300 text-sm font-bold uppercase tracking-wide">
                    Client accepted this quote
                </div>
            )}

            {quote.status === 'Rejected' && (
                <div className="mt-6 text-center py-3 rounded-lg bg-red-900/30 text-red-300 text-sm font-bold uppercase tracking-wide">
                    Client declined this quote
                </div>
            )}

            <button onClick={onClose} className="w-full mt-3 py-2 text-gray-400 hover:text-white text-sm font-bold uppercase tracking-wide">
                Close
            </button>
        </div>
    );
};

export default QuoteDetailModal;
