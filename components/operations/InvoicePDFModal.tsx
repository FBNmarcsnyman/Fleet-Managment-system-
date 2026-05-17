import React from 'react';
import { LoadConfirmation, Client } from '../../types';
import InvoicePDFView from './InvoicePDFView';
import { useUIState, useOperations, useVehicles } from '../../contexts/AppContexts';
import { PrinterIcon } from '../icons/PrinterIcon';
import { MailIcon } from '../icons/MailIcon';

const InvoicePDFModal: React.FC = () => {
    const { modal, hideModal, showToast } = useUIState();
    const { handleUpdateLoadConfirmation } = useOperations();
    const { handleAddRevenue } = useVehicles();
    
    const { loadCon, client } = (modal.payload || {}) as { loadCon: LoadConfirmation; client: Client };

    if (!loadCon || !client) {
        return <div className="p-4 bg-gray-800 text-white">Error: Data missing for invoice.</div>;
    }

    const handlePrint = () => {
        window.print();
    };
    
    const handleMarkAsInvoiced = () => {
        if (!loadCon.vehicleId) {
            showToast("Cannot create revenue entry: No vehicle assigned to this load.");
            return;
        }

        const invoiceNumber = `INV-${loadCon.loadConNumber.split('-')[1]}`;
        
        // 1. Update the load confirmation status
        handleUpdateLoadConfirmation(loadCon.id, {
            status: 'Invoiced',
            invoiceNumber: invoiceNumber,
            invoiceDate: new Date().toISOString(),
        });
        
        // 2. Automatically create the revenue entry
        handleAddRevenue(loadCon.vehicleId, {
            date: new Date().toISOString(),
            description: `Revenue for ${loadCon.loadConNumber}`,
            amount: loadCon.totalAmount,
        });
        
        showToast(`Invoice ${invoiceNumber} created and revenue logged.`);
        hideModal();
    };

    return (
        <div className="bg-gray-700">
            <div className="p-4 bg-gray-800 flex justify-between items-center no-print">
                <h3 className="text-lg font-semibold text-white">Invoice Preview</h3>
                <div className="flex items-center space-x-2">
                    <button onClick={handlePrint} className="flex items-center font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                        <PrinterIcon className="h-5 w-5 mr-2" /> Print
                    </button>
                    <button onClick={handleMarkAsInvoiced} className="flex items-center font-bold py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white">
                        <MailIcon className="h-5 w-5 mr-2" /> Mark as Invoiced
                    </button>
                </div>
            </div>
            <div className="max-h-[75vh] overflow-y-auto">
                <InvoicePDFView loadCon={loadCon} client={client} />
            </div>
        </div>
    );
};

export default InvoicePDFModal;