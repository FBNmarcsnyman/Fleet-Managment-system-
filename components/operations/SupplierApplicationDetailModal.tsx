
import React from 'react';
import { SupplierApplication } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { PaperClipIcon } from '../icons/PaperClipIcon';

interface SupplierApplicationDetailModalProps {
    application: SupplierApplication;
}

const SupplierApplicationDetailModal: React.FC<SupplierApplicationDetailModalProps> = ({ application }) => {
    const { handleUpdateSupplierApplicationStatus, handleCreateCarrierLogin } = useOperations();
    const { hideModal, showToast } = useUIState();
    const [busy, setBusy] = React.useState(false);

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

    const DetailItem: React.FC<{ label: string, value?: string | string[] }> = ({ label, value }) => {
        if (!value) return null;
        return (
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                {Array.isArray(value) ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                        {value.map(v => <span key={v} className="px-2 py-1 text-xs font-semibold bg-gray-600 text-gray-200 rounded-full">{v}</span>)}
                    </div>
                ) : (
                    <p className="font-semibold text-white">{value}</p>
                )}
            </div>
        )
    };
    
    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-4">Review Application</h2>
            <p className="text-gray-400 mb-6">{application.companyName}</p>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4 bg-gray-900/50 p-3 rounded-lg">
                    <DetailItem label="Contact Person" value={application.contactPerson} />
                    <DetailItem label="Contact Phone" value={application.contactPhone} />
                    <DetailItem label="Contact Email" value={application.contactEmail} />
                    <DetailItem label="Address" value={application.address} />
                </div>
                 <div className="bg-gray-900/50 p-3 rounded-lg">
                     <DetailItem label="Specializations" value={application.specializations} />
                 </div>
                 {!!application.vehicleTypes?.length && (
                     <div className="bg-gray-900/50 p-3 rounded-lg">
                         <DetailItem label="Vehicle / Horse Types" value={application.vehicleTypes} />
                     </div>
                 )}
                 {!!application.trailerTypes?.length && (
                     <div className="bg-gray-900/50 p-3 rounded-lg">
                         <DetailItem label="Trailer Types" value={application.trailerTypes} />
                     </div>
                 )}
                 <div className="bg-gray-900/50 p-3 rounded-lg">
                    <DetailItem label="Fleet Size" value={application.fleetSize} />
                 </div>
                 <div className="bg-gray-900/50 p-3 rounded-lg">
                    <DetailItem label="Primary Routes" value={application.routes} />
                 </div>
                 <div className="bg-gray-900/50 p-3 rounded-lg">
                     <h4 className="text-sm text-gray-400 mb-2">Submitted Documents</h4>
                     <div className="space-y-2">
                         <a href={application.fleetList.data} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-400 hover:text-white"><PaperClipIcon className="h-4 w-4 mr-2"/> Fleet List ({application.fleetList.name})</a>
                         <a href={application.rateCard.data} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-400 hover:text-white"><PaperClipIcon className="h-4 w-4 mr-2"/> Rate Card ({application.rateCard.name})</a>
                         <a href={application.insurance.data} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-400 hover:text-white"><PaperClipIcon className="h-4 w-4 mr-2"/> Insurance ({application.insurance.name})</a>
                     </div>
                 </div>
            </div>

            {application.status === 'Pending' && (
                <div className="flex justify-end space-x-4 mt-8">
                    <button disabled={busy} onClick={() => handleAction('Rejected')} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg">Reject</button>
                    <button disabled={busy} onClick={() => handleAction('Approved')} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg">{busy ? 'Accepting…' : 'Approve & Create Login'}</button>
                </div>
            )}
        </div>
    );
};

export default SupplierApplicationDetailModal;
