

import React, { useState } from 'react';
import { LoadConfirmation, LoadConfirmationStatus } from '../types';
import Modal from './Modal';

interface ClientJobCardProps {
    loadConfirmation: LoadConfirmation;
}

const STATUS_STEPS: LoadConfirmationStatus[] = [
    'Booked', 
    'Collected', 
    'In Transit',
    'Out for Delivery', 
    'Delivered',
    'POD Submitted'
];

const ClientJobCard: React.FC<ClientJobCardProps> = ({ loadConfirmation: lc }) => {
    const [isPodModalOpen, setIsPodModalOpen] = useState(false);
    
    // Simplify status for client view
    const simpleStatus = (status: LoadConfirmationStatus): LoadConfirmationStatus => {
        if (['Driver Assigned', 'At Collection Point'].includes(status)) return 'Booked';
        if (['At Collection Depot', 'At Destination Depot'].includes(status)) return 'In Transit';
        if (status === 'Invoiced') return 'POD Submitted';
        return status;
    };

    const currentStatus = simpleStatus(lc.status);
    const currentStatusIndex = STATUS_STEPS.indexOf(currentStatus);

    return (
        <>
            <div className="bg-gray-800 p-4 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div>
                        <p className="font-bold text-white text-lg">{lc.collectionPoint} to {lc.deliveryPoint}</p>
                        <p className="text-sm text-gray-400 font-mono">LoadCon: {lc.loadConNumber} | Your Ref: {lc.customerOrderNumber || 'N/A'}</p>
                    </div>
                    {(lc.podPhoto || lc.podSignature) && (
                        <button 
                            onClick={() => setIsPodModalOpen(true)}
                            className="mt-2 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                        >
                            View POD
                        </button>
                    )}
                </div>
                <div className="mt-4">
                    <div className="flex items-center space-x-1">
                        {STATUS_STEPS.map((step, index) => (
                            <div key={step} className={`flex-1 h-1.5 rounded-full ${index <= currentStatusIndex ? 'bg-brand-primary' : 'bg-gray-600'}`} title={step}></div>
                        ))}
                    </div>
                    <p className="text-xs text-center text-gray-300 mt-1">{currentStatus}</p>
                </div>
            </div>
            {isPodModalOpen && (
                <Modal isOpen={isPodModalOpen} onClose={() => setIsPodModalOpen(false)} size="2xl">
                    <h3 className="text-xl font-bold text-white mb-4">Proof of Delivery for {lc.loadConNumber}</h3>
                    <div className="space-y-4">
                        {lc.podPhoto && (
                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2">POD Document</h4>
                                <img src={lc.podPhoto.data} alt={`POD for ${lc.loadConNumber}`} className="w-full h-auto rounded-lg border-2 border-gray-600" />
                            </div>
                        )}
                         {lc.podSignature && (
                            <div>
                                <h4 className="font-semibold text-gray-300 mb-2">Recipient Signature</h4>
                                <div className="bg-gray-100 p-2 rounded-lg">
                                    <img src={lc.podSignature} alt={`Signature for ${lc.loadConNumber}`} className="w-full h-auto" />
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </>
    );
};

export default ClientJobCard;