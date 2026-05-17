import React from 'react';
import { LoadConfirmation } from '../../types';
import { useUIState, useOperations, useAuth } from '../../contexts/AppContexts';
import { SparklesIcon } from '../icons/SparklesIcon';

const ViewPodModal: React.FC = () => {
    const { modal, hideModal } = useUIState();
    const { handleApprovePayment } = useOperations();
    const { currentUser } = useAuth();
    const { loadCon } = (modal.payload as { loadCon: LoadConfirmation }) || {};

    if (!loadCon || !loadCon.podPhoto) {
        return <div className="p-4 text-white">Error: POD data not found.</div>;
    }

    const canApprove = (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') && currentUser.permissions.includes('access_finance');

    const handleApprove = () => {
        handleApprovePayment(loadCon.id);
        hideModal();
    }

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-4">Review Proof of Delivery</h2>
            <p className="text-gray-400 mb-4 font-mono">{loadCon.loadConNumber}</p>
            
            {loadCon.podAnalysis && (
                <div className="bg-gray-900/50 p-3 rounded-lg space-y-2 mb-4">
                    <h4 className="font-semibold text-white flex items-center"><SparklesIcon className="h-5 w-5 mr-2 text-purple-400"/> AI Analysis</h4>
                    <div className="text-sm space-y-1 text-gray-300">
                        <p><strong>Signature Present:</strong> <span className={loadCon.podAnalysis.isSignaturePresent ? 'text-green-400' : 'text-red-400'}>{loadCon.podAnalysis.isSignaturePresent ? 'Yes' : 'No'}</span></p>
                        <p><strong>Recipient Name:</strong> {loadCon.podAnalysis.recipientName && loadCon.podAnalysis.recipientName !== 'Not Found' ? loadCon.podAnalysis.recipientName : <span className="text-gray-500">Not found</span>}</p>
                        <p><strong>Document Issues:</strong> {loadCon.podAnalysis.documentIssues && loadCon.podAnalysis.documentIssues !== 'None found' ? <span className="text-yellow-400">{loadCon.podAnalysis.documentIssues}</span> : <span className="text-gray-500">None found</span>}</p>
                    </div>
                </div>
            )}
            
            <div className="bg-gray-700 p-2 rounded-lg">
                <img src={loadCon.podPhoto.data} alt={loadCon.podPhoto.name} className="w-full h-auto rounded-md" />
            </div>

            {canApprove && loadCon.paymentStatus === 'Awaiting Review' && (
                 <div className="flex justify-end space-x-4 mt-8">
                    <button type="button" onClick={hideModal} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                    <button type="button" onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Approve for Payment</button>
                </div>
            )}
        </div>
    );
};

export default ViewPodModal;