import React from 'react';
import { PurchaseRequest } from '../types';

interface PurchaseApprovalViewProps {
    purchaseRequests: PurchaseRequest[];
    onCreatePo: (request: PurchaseRequest) => void;
}

const PurchaseApprovalView: React.FC<PurchaseApprovalViewProps> = ({ purchaseRequests, onCreatePo }) => {

    const requestsToDisplay = purchaseRequests.filter(
        (pr) => ['Awaiting Approval', 'Approved'].includes(pr.status)
    );

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Purchase Request Queue</h3>
            <div className="space-y-4">
                {requestsToDisplay.length > 0 ? (
                    requestsToDisplay.map((req) => (
                        <div key={req.id} className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="text-white font-semibold">Request for Part ID: {req.partId}</p>
                                <p className="text-gray-400">Quantity: {req.quantity}</p>
                                <p className="text-xs text-gray-500">Status: {req.status}</p>
                            </div>
                            <div className="flex space-x-2">
                                {req.status === 'Awaiting Approval' && (
                                    <>
                                        <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Approve</button>
                                        <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Reject</button>
                                    </>
                                )}
                                {req.status === 'Approved' && (
                                    <button onClick={() => onCreatePo(req)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Create Purchase Order</button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 py-8">No purchase requests are awaiting action.</p>
                )}
            </div>
        </div>
    );
};

export default PurchaseApprovalView;