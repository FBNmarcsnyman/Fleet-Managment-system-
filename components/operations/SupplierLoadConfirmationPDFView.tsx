import React from 'react';
import { LoadConfirmation, Client, Supplier } from '../../types';
import { format } from 'date-fns';
import { FuelIcon } from '../icons/FuelIcon';

interface SupplierLoadConfirmationPDFViewProps {
    loadCon: LoadConfirmation;
    supplier: Supplier;
    client: Client;
}

const SupplierLoadConfirmationPDFView: React.FC<SupplierLoadConfirmationPDFViewProps> = ({ loadCon, supplier, client }) => {
    return (
        <div className="bg-white text-gray-900 p-8">
            <header className="flex justify-between items-start pb-4 border-b">
                <div>
                    <FuelIcon className="h-12 w-12 text-blue-700" />
                    <h1 className="text-3xl font-bold">FBN Transport</h1>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-bold text-gray-700">LOAD CONFIRMATION</h2>
                    <p className="mt-2"><strong className="text-gray-600">LoadCon #:</strong> {loadCon.loadConNumber}</p>
                    <p><strong className="text-gray-600">Date:</strong> {format(new Date(loadCon.date), 'dd MMM yyyy')}</p>
                </div>
            </header>

            <section className="grid grid-cols-2 gap-8 my-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-600">Supplier Details:</h3>
                    <p className="font-bold text-xl">{supplier.name}</p>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-600">Collection Point:</h3>
                    <p>{loadCon.collectionPoint}</p>
                    {loadCon.collectionDate && <p>Date: {format(new Date(loadCon.collectionDate), 'dd MMM yyyy')}</p>}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-600">Delivery Point:</h3>
                    <p>{loadCon.deliveryPoint}</p>
                </div>
            </section>
            
            <section className="mt-6 border-t pt-6">
                <div className="text-center">
                    <p className="font-semibold">Agreed Rate (excl. VAT)</p>
                    <p className="font-bold text-3xl font-mono">R {loadCon.supplierRate?.toFixed(2)}</p>
                </div>
            </section>
        </div>
    );
};

export default SupplierLoadConfirmationPDFView;
