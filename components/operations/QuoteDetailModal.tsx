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
        <div className="py-2 border-b border-gray-700/30 min-w-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
            <div className="text-sm text-white break-words">{value}</div>
        </div>
    );
};

const QuoteDetailModal: React.FC<{
    quote: Quote;
    client?: Client;
    onClose: () => void;
    onQuoteIt: (quote: Quote) => void;
    onSendQuote?: (quote: Quote) => Promise<void>;
    onSendProforma?: (quote: Quote) => Promise<void>;
    onRequestRates?: (quote: Quote) => void;
}> = ({ quote, client, onClose, onQuoteIt, onSendQuote, onSendProforma, onRequestRates }) => {
    const { showToast } = useUIState();
    const [requesting, setRequesting] = useState(false);
    const [sending, setSending] = useState(false);
    const [proforma, setProforma] = useState(false);
    const [moreInfoNote, setMoreInfoNote] = useState('');
    const rd = quote.requestData || {};
    const mi = quote.requestMoreInfo || {};

    const handleRequestMoreInfo = async () => {
        // Don't re-request too soon if we're still waiting on a reply.
        const last = mi.last_requested_at ? new Date(mi.last_requested_at) : null;
        if (last && !isNaN(last.getTime())) {
            const days = Math.floor((Date.now() - last.getTime()) / 86400000);
            if (days < 2 && !window.confirm(`More info was already requested ${days === 0 ? 'today' : days + ' day(s) ago'}. The client may not have replied yet — send another reminder now?`)) return;
        }
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
                    body: JSON.stringify({ quote_id: quote.id, note: moreInfoNote.trim() }),
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
                <div className="bg-white rounded-lg inline-block px-2.5 py-1.5 mb-3">
                    <img src="/fbn-logo.jpg" alt="FBN Transport" className="h-7 block" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: YELLOW }}>
                            Quote Request
                        </div>
                        <h2 className="text-2xl font-bold text-white btn-on-color mt-1">{quote.quoteNumber}</h2>
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
                    {/* The intake form copies collect_from→collection_area and deliver_to→delivery_area,
                        so only show the "Area" rows when they actually add new information. */}
                    <Field label="Collection Area" value={rd.collection_area !== rd.collect_from ? rd.collection_area : undefined} />
                    <Field label="Delivery Area" value={rd.delivery_area !== rd.deliver_to ? rd.delivery_area : undefined} />
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
            {mi.last_requested_at && (
                <p className="text-xs text-amber-600 font-semibold mt-5 mb-1">📨 More info last requested: <strong>{new Date(mi.last_requested_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>{Number(mi.count) > 1 ? ` · ${mi.count} times` : ''} — waiting on the client's reply.</p>
            )}
            {(quote.status === 'Requested' || quote.status === 'More Info Requested') && (
                <div className="mb-3">
                    <label className="block text-xs font-bold uppercase tracking-wide text-amber-400 mb-1">📝 Extra questions for the client <span className="text-gray-400 font-normal normal-case">(optional — added to the "Request More Info" email)</span></label>
                    {/* One-click question presets — append a standard question to the note. */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {[
                            { k: 'Vehicle size', q: 'What size vehicle do you require? Superlink (34t) / Tri-axle (28t) / 15t / 12t / 8t / 5t / 2t — and Taut-liner or Flat deck?' },
                            { k: 'Full or part load', q: 'Is this a full load or a part load?' },
                            { k: 'Pallets / cartons', q: 'How many pallets or cartons, and the weight & dimensions (L x W x H) of each?' },
                            { k: 'Weights & dims', q: 'Please confirm total weight (kg) and overall dimensions (L x W x H).' },
                            { k: 'Equipment', q: 'Any equipment needed for loading/offloading? Crane truck / forklift / tail-lift / labour.' },
                        ].map(p => (
                            <button key={p.k} type="button"
                                onClick={() => setMoreInfoNote(prev => prev.includes(p.q) ? prev : (prev.trim() ? prev.trim() + '\n' : '') + p.q)}
                                className="text-[11px] font-semibold bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600 rounded-full px-2.5 py-1">+ {p.k}</button>
                        ))}
                    </div>
                    <textarea
                        value={moreInfoNote}
                        onChange={e => setMoreInfoNote(e.target.value)}
                        rows={3}
                        placeholder="e.g. Is the site forklift-accessible? Any after-hours collection? Confirm exact delivery suburb…"
                        className="normal-case w-full bg-gray-800 text-gray-100 text-sm rounded-lg border border-gray-600 p-2.5 placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                        style={{ textTransform: 'none' }}
                    />
                    {!String(quote.commodity || rd.commodity || '').trim() && (
                        <p className="text-[11px] text-gray-400 mt-1">ℹ The email will also automatically ask for the <strong>commodity</strong> (none on file yet).</p>
                    )}
                </div>
            )}
            {(quote.status === 'Requested' || quote.status === 'More Info Requested') && (
                <div className="flex gap-3 mt-2">
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
            {(quote.status === 'Requested' || quote.status === 'Draft') && onRequestRates && (
                <button
                    onClick={() => onRequestRates(quote)}
                    title="Send this load's shipping details to transporters for their best rate (RFQ). Client details are NOT sent to subbies."
                    className="btn-on-color w-full mt-3 py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:brightness-110"
                    style={{ background: '#0e7490' }}
                >
                    📨 Request Transporter Rates →
                </button>
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

            {onSendProforma && (quote.status === 'Draft' || quote.status === 'Sent' || quote.status === 'Accepted') && (
                <button
                    onClick={async () => { setProforma(true); try { await onSendProforma(quote); } catch {} finally { setProforma(false); } }}
                    disabled={proforma}
                    className="btn-on-color w-full mt-4 py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:brightness-110"
                    style={{ background: '#475569' }}
                >
                    {proforma ? 'Sending…' : '🧾 Email COD Proforma (cc debtors)'}
                </button>
            )}

            {(quote.status === 'Draft' || quote.status === 'Sent' || quote.status === 'Accepted') && (() => {
                const link = `${window.location.origin}/quote-view.html?id=${quote.id}`;
                const incl = `R ${(Number(quote.totalAmount || 0) * 1.15).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const msg = `Hi ${client?.contactPerson || client?.name || 'there'}, here is your FBN Transport quote ${quote.quoteNumber} (${incl} incl VAT). View, download the PDF and accept or decline here:\n${link}`;
                const phone = (client?.contactPhone || '').replace(/\D/g, '');
                const wa = phone ? `https://wa.me/${phone.startsWith('0') ? '27' + phone.slice(1) : phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                const copyLink = async () => { try { await navigator.clipboard.writeText(link); } catch { window.prompt('Copy the quote link:', link); } };
                return (
                    <div className="flex gap-2 mt-4">
                        <a href={wa} target="_blank" rel="noreferrer" className="btn-on-color flex-1 text-center py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:brightness-110" style={{ background: '#25D366' }}>📱 Share on WhatsApp</a>
                        <button onClick={copyLink} className="btn-on-color px-4 py-3 rounded-lg text-white font-bold text-sm uppercase tracking-wide transition-all hover:brightness-110" style={{ background: NAVY }} title="Copy the client view/accept link">🔗 Copy link</button>
                    </div>
                );
            })()}

            <button onClick={onClose} className="w-full mt-3 py-2 text-gray-400 hover:text-white text-sm font-bold uppercase tracking-wide">
                Close
            </button>
        </div>
    );
};

export default QuoteDetailModal;
