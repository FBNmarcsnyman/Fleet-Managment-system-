
import React from 'react';
import { Quote, Client } from '../../types';
import { format } from 'date-fns';
import { FuelIcon } from '../icons/FuelIcon';

interface QuotePDFViewProps {
    quote: Quote;
    client: Client;
}

const QuotePDFView: React.FC<QuotePDFViewProps> = ({ quote, client }) => {
    return (
        <div className="bg-white text-gray-900 p-10 font-sans">
            <header className="flex justify-between items-start pb-6 border-b-2 border-gray-100">
                <div>
                    <FuelIcon className="h-16 w-16 text-blue-700" />
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter mt-2">FBN Transport</h1>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Logistics & Supply Chain Solutions</p>
                </div>
                <div className="text-right">
                    <h2 className="text-5xl font-black text-gray-200">QUOTATION</h2>
                    <div className="mt-4 space-y-1">
                        <p className="text-sm"><strong className="text-gray-400 uppercase mr-2">Ref #:</strong> <span className="font-bold">{quote.quoteNumber}</span></p>
                        <p className="text-sm"><strong className="text-gray-400 uppercase mr-2">Date:</strong> {format(new Date(quote.date), 'dd MMM yyyy')}</p>
                        <p className="text-sm"><strong className="text-gray-400 uppercase mr-2">Expires:</strong> {format(new Date(quote.expiryDate), 'dd MMM yyyy')}</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-10 my-10">
                <section>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Prepared For</h3>
                    <p className="font-black text-2xl text-blue-900">{client.name}</p>
                    <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                        <p className="font-bold">{client.contactPerson}</p>
                        <p>{client.address}</p>
                    </div>
                </section>
                <section className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Shipment Specifications</h3>
                    <div className="space-y-3">
                         <div className="flex justify-between border-b border-gray-200 pb-2">
                            <span className="text-xs text-gray-500 font-bold uppercase">Commodity</span>
                            <span className="text-sm font-black">{quote.commodity || 'General Cargo'}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                            <span className="text-xs text-gray-500 font-bold uppercase">Packaging</span>
                            <span className="text-sm font-black">{quote.packaging || 'Pallets'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-gray-500 font-bold uppercase">Vehicle Spec</span>
                            <span className="text-sm font-black text-blue-600">{quote.loadSpec || 'Superlink'}</span>
                        </div>
                    </div>
                </section>
            </div>

            <section className="mb-10">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Route Plan</h3>
                <div className="space-y-4">
                    {quote.legs.map((leg, idx) => (
                        <div key={leg.id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">{idx + 1}</div>
                            <div className="flex-1">
                                <div className="grid grid-cols-2 gap-6">
                                    <div><p className="text-[10px] font-black text-gray-400 uppercase">Collection</p><p className="text-sm font-bold truncate">{leg.collectionPoint}</p></div>
                                    <div><p className="text-[10px] font-black text-gray-400 uppercase">Delivery</p><p className="text-sm font-bold truncate">{leg.deliveryPoint}</p></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Costing Breakdown</h3>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900 text-white">
                        <tr>
                            <th className="p-4 rounded-tl-xl text-xs uppercase tracking-widest">Description</th>
                            <th className="p-4 text-xs uppercase tracking-widest text-center">Qty</th>
                            <th className="p-4 text-xs uppercase tracking-widest text-right">Unit Rate</th>
                            <th className="p-4 rounded-tr-xl text-xs uppercase tracking-widest text-right">Line Total</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {quote.items.map(item => (
                            <tr key={item.id} className="border-b border-gray-100">
                                <td className="p-4 font-bold text-gray-800">{item.description}</td>
                                <td className="p-4 text-center font-bold text-gray-600">{item.quantity}</td>
                                <td className="p-4 text-right font-mono text-gray-600">R {item.rate.toFixed(2)}</td>
                                <td className="p-4 text-right font-mono font-black text-gray-900">R {item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            
            <section className="flex justify-end mt-10">
                <div className="w-1/2 bg-gray-900 text-white p-6 rounded-2xl shadow-xl">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                        <span className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Subtotal (Excl. VAT)</span>
                        <span className="text-xl font-bold font-mono">R {quote.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-black uppercase tracking-[0.2em]">Total Amount</span>
                        <span className="text-3xl font-black font-mono text-blue-400">R {(quote.totalAmount * 1.15).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </section>

            <footer className="mt-20 pt-10 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-10 text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                    <div>
                        <p className="text-gray-900 mb-2">Terms & Conditions</p>
                        <p>1. Validity is 7 days from the quote date.</p>
                        <p>2. Subject to availability of equipment at time of booking.</p>
                        <p>3. Standard STC terms apply to all movements.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-900 mb-2">Banking Details</p>
                        <p>FBN TRANSPORT SOLUTIONS</p>
                        <p>FNB CORPORATE - ACC: 6281726351</p>
                        <p>BRANCH CODE: 250655</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default QuotePDFView;
