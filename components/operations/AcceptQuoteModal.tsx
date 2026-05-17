
import React, { useState, useMemo } from 'react';
import { Quote, Client, Supplier, SubcontractorQuote } from '../../types';
import { useOperations, useUIState } from '../../contexts/AppContexts';
import { format } from 'date-fns';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { TruckIcon } from '../icons/TruckIcon';

interface AcceptQuoteModalProps {
    quote: Quote;
    client: Client;
    suppliers: Supplier[];
    onSuccess: () => void;
    onCancel: () => void;
}

const AcceptQuoteModal: React.FC<AcceptQuoteModalProps> = ({ quote, client, suppliers, onSuccess, onCancel }) => {
    const { handleCreateLoadConfirmation, handleUpdateQuote } = useOperations();
    const [selectedSubQuoteId, setSelectedSubQuoteId] = useState<string>('');
    const [isInternalFleet, setIsInternalFleet] = useState(false);

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

    const handleConfirm = () => {
        const subQuote = quote.subcontractorQuotes.find(sq => sq.id === selectedSubQuoteId);
        
        if (!isInternalFleet && !subQuote) {
            alert("Please select a subcontractor quote or choose Internal Fleet.");
            return;
        }

        // 1. Mark Quote as Accepted
        handleUpdateQuote({ ...quote, status: 'Accepted' });

        // 2. Create Load Confirmation
        const newLoadData = {
            quoteId: quote.id,
            clientId: quote.clientId,
            date: new Date().toISOString(),
            items: quote.items,
            legs: quote.legs,
            totalAmount: quote.totalAmount, // Sell Rate
            supplierId: isInternalFleet ? undefined : subQuote?.supplierId,
            supplierRate: isInternalFleet ? undefined : subQuote?.rate, // Buy Rate
            collectionBranch: 'FBN JHB', // Defaulting for now
            destinationBranch: 'FBN DBN', // Defaulting for now
            priority: 'Medium',
            status: 'Booked',
            collectionPoint: quote.legs[0]?.collectionPoint || 'TBA',
            deliveryPoint: quote.legs[quote.legs.length - 1]?.deliveryPoint || 'TBA',
            commodity: quote.commodity,
            packaging: quote.packaging,
            loadSpec: quote.loadSpec,
        };

        handleCreateLoadConfirmation(newLoadData);
        onSuccess();
    };

    const labelClasses = "block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2";

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-white flex items-center">
                    <CheckCircleIcon className="h-7 w-7 text-green-500 mr-3" />
                    Accept Quote {quote.quoteNumber}
                </h2>
                <p className="text-gray-400 text-sm mt-1">Convert this quotation into an active operational load for <span className="text-white font-bold">{client.name}</span>.</p>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                <p className={labelClasses}>Select Logistics Fulfillment</p>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => { setIsInternalFleet(true); setSelectedSubQuoteId(''); }}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${isInternalFleet ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-800 border-transparent text-gray-400 hover:bg-gray-700'}`}
                    >
                        <TruckIcon className="h-6 w-6 mb-2" />
                        <span className="font-bold">Internal Fleet</span>
                    </button>
                    <button 
                        onClick={() => setIsInternalFleet(false)}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${!isInternalFleet ? 'bg-orange-600/20 border-orange-500' : 'bg-gray-800 border-transparent text-gray-400 hover:bg-gray-700'}`}
                    >
                        <CheckCircleIcon className="h-6 w-6 mb-2" />
                        <span className="font-bold">Subcontractor</span>
                    </button>
                </div>
            </div>

            {!isInternalFleet && (
                <div className="space-y-3">
                    <p className={labelClasses}>Logged Subcontractor Rates</p>
                    {quote.subcontractorQuotes.length > 0 ? (
                        quote.subcontractorQuotes.map((sq) => (
                            <div 
                                key={sq.id} 
                                onClick={() => setSelectedSubQuoteId(sq.id)}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${selectedSubQuoteId === sq.id ? 'bg-orange-600/20 border-orange-500' : 'bg-gray-800 border-transparent hover:bg-gray-700'}`}
                            >
                                <div>
                                    <p className="font-bold text-white">{supplierMap.get(sq.supplierId)?.name || 'Unknown Carrier'}</p>
                                    <p className="text-xs text-gray-500">Logged {format(new Date(sq.timestamp), 'dd MMM HH:mm')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-lg text-orange-400 font-black">R {sq.rate.toLocaleString()}</p>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Margin: R {(quote.totalAmount - sq.rate).toLocaleString()}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 bg-red-900/10 border border-dashed border-red-500/20 rounded-xl">
                            <p className="text-xs text-red-400 font-bold uppercase tracking-widest">No subcontractor quotes found.</p>
                            <p className="text-[10px] text-red-300/60 mt-1">Please edit the quote to add sub-rates before accepting.</p>
                        </div>
                    )}
                </div>
            )}

            {isInternalFleet && (
                <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl text-center">
                    <p className="text-sm text-blue-400 font-medium italic">Fulfilling with internal assets. Profit will be maximized but operational availability must be confirmed.</p>
                </div>
            )}

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700">
                <button onClick={onCancel} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-white transition-colors">Cancel</button>
                <button 
                    onClick={handleConfirm}
                    disabled={!isInternalFleet && !selectedSubQuoteId}
                    className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-black py-2.5 px-8 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-wider"
                >
                    Accept & Convert to Load
                </button>
            </div>
        </div>
    );
};

export default AcceptQuoteModal;
