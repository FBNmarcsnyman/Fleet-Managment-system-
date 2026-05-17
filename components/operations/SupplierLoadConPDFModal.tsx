import React from 'react';
import { LoadConfirmation, Client, Supplier } from '../../types';
import SupplierLoadConfirmationPDFView from './SupplierLoadConfirmationPDFView';
import { useUIState } from '../../contexts/AppContexts';
import { PrinterIcon } from '../icons/PrinterIcon';

const SupplierLoadConPDFModal: React.FC = () => {
    const { modal } = useUIState();
    const { loadCon, supplier, client } = modal.payload || {};

    if (!loadCon || !supplier || !client) {
        return <div className="p-4 bg-gray-800 text-white">Error: Load Confirmation data missing for preview.</div>;
    }

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-gray-700">
            <div className="p-4 bg-gray-800 flex justify-between items-center no-print">
                <h3 className="text-lg font-semibold text-white">Load Confirmation Preview</h3>
                <button 
                    onClick={handlePrint} 
                    className="flex items-center font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <PrinterIcon className="h-5 w-5 mr-2" />
                    Print / Save PDF
                </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto">
                <SupplierLoadConfirmationPDFView loadCon={loadCon} supplier={supplier} client={client} />
            </div>
        </div>
    );
};

export default SupplierLoadConPDFModal;