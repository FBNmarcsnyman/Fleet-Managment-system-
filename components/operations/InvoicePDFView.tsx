import React from 'react';
import { LoadConfirmation, Client } from '../../types';
import { format } from 'date-fns';
import { FuelIcon } from '../icons/FuelIcon';

interface InvoicePDFViewProps {
    loadCon: LoadConfirmation;
    client: Client;
}

const InvoicePDFView: React.FC<InvoicePDFViewProps> = ({ loadCon, client }) => {
    const invoiceNumber = loadCon.invoiceNumber || `INV-${loadCon.loadConNumber.split('-')[1]}`;
    const invoiceDate = loadCon.invoiceDate ? new Date(loadCon.invoiceDate) : new Date();

    return (
        <div className="bg-white text-gray-900 p-8">
            <header className="flex justify-between items-start pb-4 border-b">
                <div>
                    <FuelIcon className="h-12 w-12 text-blue-700" />
                    <h1 className="text-3xl font-bold">FBN Transport</h1>
                    <p>Your Trusted Logistics Partner</p>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-bold text-gray-700">INVOICE</h2>
                    <p className="mt-2"><strong className="text-gray-600">Invoice #:</strong> {invoiceNumber}</p>
                    <p><strong className="text-gray-600">Date:</strong> {format(invoiceDate, 'dd MMM yyyy')}</p>
                    <p><strong className="text-gray-600">LoadCon #:</strong> {loadCon.loadConNumber}</p>
                </div>
            </header>

            <section className="my-6 grid grid-cols-2 gap-4">
                 <div>
                    <h3 className="text-lg font-semibold text-gray-600">Bill To:</h3>
                    <p className="font-bold text-xl">{client.name}</p>
                    <p>{client.address}</p>
                </div>
                 <div className="text-right">
                     <h3 className="text-lg font-semibold text-gray-600">Customer Ref / PO:</h3>
                     <p>{loadCon.customerOrderNumber || 'N/A'}</p>
                 </div>
            </section>

            <section>
                <table className="w-full text-left">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-right">Quantity</th>
                            <th className="p-3 text-right">Rate</th>
                            <th className="p-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadCon.items.map(item => (
                            <tr key={item.id} className="border-b">
                                <td className="p-3 align-top">
                                    <p>{item.description}</p>
                                    <p className="text-xs text-gray-500">Route: {loadCon.collectionPoint} to {loadCon.deliveryPoint}</p>
                                </td>
                                <td className="p-3 text-right align-top">{item.quantity}</td>
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
                        <span className="font-bold text-lg">Total Due</span>
                        <span className="font-bold text-lg font-mono">R {loadCon.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </section>

            <footer className="mt-12 text-center text-xs text-gray-500 border-t pt-4">
                <p>Thank you for your business!</p>
                <p>Please make payments to: FBN Transport, Bank Name, Account # 123456789, Branch Code 123456</p>
            </footer>
        </div>
    );
};

export default InvoicePDFView;