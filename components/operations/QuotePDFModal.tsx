import React from 'react';
import { Quote, Client } from '../../types';
import QuotePDFView from './QuotePDFView';
import { useUIState } from '../../contexts/AppContexts';
import { PrinterIcon } from '../icons/PrinterIcon';

const QuotePDFModal: React.FC = () => {
    const { modal } = useUIState();
    const { quote, client } = modal.payload || {};

    if (!quote || !client) {
        return <div className="p-4 bg-gray-800 text-white">Error: Quote or Client data missing for preview.</div>;
    }

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-gray-700">
            <div className="p-4 bg-gray-800 flex justify-between items-center no-print">
                <h3 className="text-lg font-semibold text-white">Quote Preview</h3>
                <button 
                    onClick={handlePrint} 
                    className="flex items-center font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <PrinterIcon className="h-5 w-5 mr-2" />
                    Print
                </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto">
                <QuotePDFView quote={quote} client={client} />
            </div>
        </div>
    );
};

export default QuotePDFModal;