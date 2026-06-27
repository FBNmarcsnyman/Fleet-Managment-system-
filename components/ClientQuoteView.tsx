

import React from 'react';
import { Quote, Client } from '../types';
import { format } from 'date-fns';
import { FuelIcon } from './icons/FuelIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface ClientQuoteViewProps {
    quote: Quote;
    client: Client;
    onAccept: (quote: Quote) => void;
    onReject: (quote: Quote) => void;
}

const ClientQuoteView: React.FC<ClientQuoteViewProps> = ({ quote, client, onAccept, onReject }) => {

    const handleAccept = () => {
        if (window.confirm("Are you sure you want to accept this quote? This will create a binding order.")) {
            onAccept(quote);
        }
    }

    const handleReject = () => {
        if (window.confirm("Are you sure you want to reject this quote?")) {
            onReject(quote);
        }
    }

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-8">
            <div className="bg-white text-gray-900 p-8 rounded-lg max-w-4xl mx-auto shadow-2xl">
                <header className="flex justify-between items-start pb-4 border-b">
                    <div>
                        <FuelIcon className="h-12 w-12 text-blue-700" />
                        <h1 className="text-3xl font-bold">FBN Transport</h1>
                        <p>Your Trusted Logistics Partner</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-bold text-gray-700">QUOTE</h2>
                        <p className="mt-2"><strong className="text-gray-600">Quote #:</strong> {quote.quoteNumber}</p>
                        <p><strong className="text-gray-600">Date:</strong> {format(new Date(quote.date), 'dd MMM yyyy')}</p>
                        <p><strong className="text-gray-600">Expires:</strong> {format(new Date(quote.expiryDate), 'dd MMM yyyy')}</p>
                    </div>
                </header>

                <section className="my-6">
                    <h3 className="text-lg font-semibold text-gray-600">Prepared For:</h3>
                    <p className="font-bold text-xl">{client.name}</p>
                    <p>{client.address}</p>
                </section>
                
                <section className="my-6">
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Route Details:</h3>
                    {quote.legs.map((leg, index) => (
                        <div key={leg.id} className="mb-1">
                            <span className="font-bold">Leg {index + 1}:</span> {leg.collectionPoint} to {leg.deliveryPoint}
                        </div>
                    ))}
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">Cargo Details:</h3>
                    <table className="w-full text-left">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-3">Description</th>
                                <th className="p-3 text-center">Vehicle</th>
                                <th className="p-3 text-center">Packaging</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3 text-right">Weight (kg)</th>
                                <th className="p-3 text-right">Volume (m³)</th>
                                <th className="p-3 text-right">Rate</th>
                                <th className="p-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quote.items.map(item => (
                                <tr key={item.id} className="border-b">
                                    <td className="p-3 align-top">{item.description}</td>
                                    <td className="p-3 text-center align-top">{(item as any).truckType || '-'}</td>
                                    <td className="p-3 text-center align-top">{item.packagingType}</td>
                                    <td className="p-3 text-center align-top">{item.quantity}</td>
                                    <td className="p-3 text-right font-mono align-top">{item.weight ? item.weight.toLocaleString() : '-'}</td>
                                    <td className="p-3 text-right font-mono align-top">{item.volume ? item.volume.toFixed(2) : '-'}</td>
                                    <td className="p-3 text-right font-mono align-top">R {item.rate.toFixed(2)}</td>
                                    <td className="p-3 text-right font-mono font-semibold align-top">R {item.total.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
                
                 <section className="flex justify-end mt-6">
                    <div className="w-full md:w-1/2">
                        <div className="flex justify-between items-center bg-gray-200 p-3 rounded-t-lg">
                            <span className="font-bold text-lg">Total</span>
                            <span className="font-bold text-lg font-mono">R {quote.totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </section>

                <section className="mt-8 border-t pt-6">
                    {quote.status === 'Sent' ? (
                        <div className="text-center space-y-4">
                            <p className="font-semibold">Please review the quote above and choose an option below.</p>
                            <div className="flex justify-center space-x-4">
                                <button onClick={handleAccept} className="flex items-center font-bold py-3 px-6 rounded-lg bg-green-600 hover:bg-green-700 text-white"><CheckCircleIcon className="h-5 w-5 mr-2"/> Accept Quote</button>
                                <button onClick={handleReject} className="flex items-center font-bold py-3 px-6 rounded-lg bg-red-600 hover:bg-red-700 text-white"><XCircleIcon className="h-5 w-5 mr-2"/> Reject Quote</button>
                            </div>
                        </div>
                    ) : (
                         <div className="text-center p-4 rounded-lg bg-blue-100 border border-blue-300">
                             <p className="font-bold text-blue-800">This quote has been {quote.status}.</p>
                             <p className="text-sm text-blue-700">If you have any questions, please contact us.</p>
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
};

export default ClientQuoteView;