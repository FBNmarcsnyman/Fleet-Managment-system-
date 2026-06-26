
import React from 'react';
import { SupplierApplication } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { PaperClipIcon } from '../icons/PaperClipIcon';
import { invokeFn } from '../../lib/supabase';

interface SupplierApplicationDetailModalProps {
    application: SupplierApplication;
}

const fmtDate = (d?: string | null) => { if (!d) return ''; const t = new Date(d); return isNaN(t.getTime()) ? String(d) : t.toLocaleDateString('en-ZA'); };
const fmtDateTime = (d?: string | null) => { if (!d) return ''; const t = new Date(d); return isNaN(t.getTime()) ? String(d) : t.toLocaleString('en-ZA'); };

const SupplierApplicationDetailModal: React.FC<SupplierApplicationDetailModalProps> = ({ application }) => {
    const { handleUpdateSupplierApplicationStatus, handleCreateCarrierLogin } = useOperations();
    const { hideModal, showToast } = useUIState();
    const [busy, setBusy] = React.useState(false);
    const [opening, setOpening] = React.useState<string | null>(null);

    const handleAction = async (status: 'Approved' | 'Rejected') => {
        setBusy(true);
        const res = await handleUpdateSupplierApplicationStatus(application.id, status);
        if (status === 'Approved' && res?.ok && res.value) {
            const loginRes = await handleCreateCarrierLogin(res.value);
            if (loginRes?.ok) showToast(`${application.companyName} accepted — login emailed to ${res.value.contactEmail}${loginRes.value?.tempPassword ? ` (temp password: ${loginRes.value.tempPassword})` : ''}.`);
            else showToast(`${application.companyName} accepted. Login not created: ${loginRes?.error || 'they may already have one.'}`);
        } else if (status === 'Rejected') {
            showToast(`${application.companyName} application rejected.`);
        }
        setBusy(false);
        hideModal();
    };

    // Documents live in the PRIVATE supplier-applications bucket; mint a short-lived
    // signed URL via the role-gated edge fn, then open it. Open the tab up-front so
    // the async fetch doesn't trip the popup blocker.
    const openDoc = async (key: string, path?: string) => {
        if (!path) return;
        setOpening(key);
        const tab = window.open('', '_blank');
        const { data, error } = await invokeFn('supplier-doc-url', { body: { path } });
        setOpening(null);
        if (error || !data?.url) { tab?.close(); showToast(`Could not open document: ${error?.message || 'no URL'}`); return; }
        if (tab) tab.location.href = data.url; else window.open(data.url, '_blank');
    };

    const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
        value ? <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</p><p className="font-semibold text-slate-800 text-sm">{value}</p></div> : null
    );
    const Chips: React.FC<{ label: string; values?: string[] }> = ({ label, values }) => (
        values && values.length ? <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
            <div className="flex flex-wrap gap-1.5">{values.map(v => <span key={v} className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-full">{v}</span>)}</div></div> : null
    );
    const cardCls = 'bg-slate-50 border border-slate-200 rounded-xl p-4';

    const a = application;
    const hasFleet = !!a.vehicles?.length;
    const hasRoutes = !!a.routesDetail?.length;
    const hasNewDocs = !!a.documents?.length;
    const signed = !!a.agreementAcceptedAt || !!a.agreementFullName;

    return (
        <div>
            <div className="flex items-start justify-between mb-1">
                <h2 className="text-2xl font-black text-slate-900">Review Application</h2>
                {signed && <span className="text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">✓ Agreement signed</span>}
            </div>
            <p className="text-slate-500 mb-5 font-semibold">{a.companyName}</p>

            <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-2">
                {/* Company */}
                <div className={cardCls}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <Field label="Contact Person" value={a.contactPerson} />
                        <Field label="Contact Phone" value={a.contactPhone} />
                        <Field label="Contact Email" value={a.contactEmail} />
                        <Field label="Reg Number" value={a.registrationNumber} />
                        <Field label="VAT Number" value={a.vatNumber} />
                        <Field label="BEE Level" value={a.beeStatus} />
                        <Field label="Years Operating" value={a.yearsOperating} />
                        <Field label="Fleet Size" value={a.fleetSize} />
                        <Field label="Hazmat Compliant" value={a.hazCompliant ? 'Yes' : undefined} />
                    </div>
                    {a.address && <div className="mt-3"><Field label="Address" value={a.address} /></div>}
                </div>

                {/* Fleet */}
                {hasFleet ? (
                    <div className={cardCls}>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Fleet ({a.vehicles!.length})</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead><tr className="text-slate-400 text-left">
                                    <th className="py-1 pr-3 font-bold">Reg</th><th className="py-1 pr-3 font-bold">Type</th><th className="py-1 pr-3 font-bold">Payload</th><th className="py-1 pr-3 font-bold">Length</th><th className="py-1 pr-3 font-bold">Flags</th><th className="py-1 pr-3 font-bold">Tracker</th><th className="py-1 font-bold">MVL exp</th>
                                </tr></thead>
                                <tbody>{a.vehicles!.map((v, i) => (
                                    <tr key={i} className="border-t border-slate-200 text-slate-700">
                                        <td className="py-1.5 pr-3 font-bold text-slate-900">{v.registration || '-'}</td>
                                        <td className="py-1.5 pr-3">{v.vehicleType || '-'}</td>
                                        <td className="py-1.5 pr-3">{v.payloadTonnes ? `${v.payloadTonnes}t` : '-'}</td>
                                        <td className="py-1.5 pr-3">{v.bodyLengthM ? `${v.bodyLengthM}m` : '-'}</td>
                                        <td className="py-1.5 pr-3">{[v.hazmat && 'HAZ', v.abnormal && 'ABN'].filter(Boolean).join(', ') || '-'}</td>
                                        <td className="py-1.5 pr-3">{v.trackerFitted ? (v.trackerProvider || 'Yes') : 'No'}</td>
                                        <td className="py-1.5">{fmtDate(v.mvlExpiry) || '-'}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    (!!a.vehicleTypes?.length || !!a.trailerTypes?.length) && (
                        <div className={cardCls + ' space-y-3'}>
                            <Chips label="Vehicle / Horse Types" values={a.vehicleTypes} />
                            <Chips label="Trailer Types" values={a.trailerTypes} />
                        </div>
                    )
                )}

                {/* Routes & services */}
                {(hasRoutes || !!a.crossBorderCountries?.length || a.routes || !!a.specializations?.length) && (
                    <div className={cardCls + ' space-y-3'}>
                        {hasRoutes ? (
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Routes & load types</p>
                                <div className="space-y-1.5">{a.routesDetail!.map((r, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                                        <span className="px-2 py-0.5 text-xs font-bold bg-[#13294b] text-white rounded">{r.route}</span>
                                        {(r.loadTypes || []).map(lt => <span key={lt} className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-full">{lt}</span>)}
                                    </div>
                                ))}</div>
                            </div>
                        ) : <Field label="Primary Routes" value={a.routes} />}
                        <Chips label="Cross-border countries" values={a.crossBorderCountries} />
                        <Chips label="Specializations" values={a.specializations} />
                    </div>
                )}

                {/* Documents */}
                <div className={cardCls}>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Submitted documents</p>
                    {hasNewDocs ? (
                        <div className="space-y-1.5">
                            {a.documents!.map((d, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="font-semibold text-slate-700">{d.type}{d.expiry ? <span className="text-slate-400 font-normal"> · expires {fmtDate(d.expiry)}</span> : ''}</span>
                                    <button onClick={() => openDoc(`doc-${i}`, d.path)} disabled={opening === `doc-${i}`} className="flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50">
                                        <PaperClipIcon className="h-4 w-4 mr-1" />{opening === `doc-${i}` ? 'Opening…' : 'View'}
                                    </button>
                                </div>
                            ))}
                            {a.agreementPdfUrl && (
                                <div className="flex items-center justify-between text-sm border-t border-slate-200 pt-1.5 mt-1.5">
                                    <span className="font-semibold text-slate-700">Signed agreement (PDF)</span>
                                    <button onClick={() => openDoc('pdf', a.agreementPdfUrl)} disabled={opening === 'pdf'} className="flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50">
                                        <PaperClipIcon className="h-4 w-4 mr-1" />{opening === 'pdf' ? 'Opening…' : 'View'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {a.fleetList?.data && <a href={a.fleetList.data} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:text-blue-800"><PaperClipIcon className="h-4 w-4 mr-2" /> Fleet List ({a.fleetList.name})</a>}
                            {a.rateCard?.data && <a href={a.rateCard.data} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:text-blue-800"><PaperClipIcon className="h-4 w-4 mr-2" /> Rate Card ({a.rateCard.name})</a>}
                            {a.insurance?.data && <a href={a.insurance.data} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:text-blue-800"><PaperClipIcon className="h-4 w-4 mr-2" /> Insurance ({a.insurance.name})</a>}
                            {!a.fleetList?.data && !a.rateCard?.data && !a.insurance?.data && <p className="text-sm text-slate-400">No documents on file.</p>}
                        </div>
                    )}
                </div>

                {/* Electronic acceptance */}
                {signed && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-2">Electronic acceptance (ECT Act 25 of 2002)</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <Field label="Accepted by" value={a.agreementFullName} />
                            <Field label="ID Number" value={a.agreementIdNumber} />
                            <Field label="Position" value={a.agreementPosition} />
                            <Field label="Accepted at (server)" value={fmtDateTime(a.agreementAcceptedAt)} />
                            <Field label="IP address" value={a.agreementIp} />
                        </div>
                    </div>
                )}
            </div>

            {a.status === 'Pending' && (
                <div className="flex justify-end space-x-3 mt-6">
                    <button disabled={busy} onClick={() => handleAction('Rejected')} className="bg-slate-200 hover:bg-red-100 text-slate-700 disabled:opacity-50 font-bold py-2.5 px-5 rounded-lg">Reject</button>
                    <button disabled={busy} onClick={() => handleAction('Approved')} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-lg">{busy ? 'Accepting…' : 'Approve & Create Login'}</button>
                </div>
            )}
        </div>
    );
};

export default SupplierApplicationDetailModal;
