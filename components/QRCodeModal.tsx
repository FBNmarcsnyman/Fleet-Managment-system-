import React from 'react';
import { Vehicle } from '../types';
import { PrinterIcon } from './icons/PrinterIcon';

interface QRCodeModalProps {
    vehicle: Vehicle;
    onCancel: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ vehicle, onCancel }) => {
    const qrData = `${window.location.origin}${window.location.pathname}?checklist=${vehicle.id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print QR Code</title>
                        <style>
                            body { font-family: sans-serif; text-align: center; margin-top: 50px; }
                            img { width: 200px; height: 200px; }
                            h1 { font-size: 24px; margin: 10px 0; }
                            h2 { font-size: 18px; color: #555; }
                        </style>
                    </head>
                    <body>
                        <img src="${qrCodeUrl}" alt="QR Code for ${vehicle.registration}" />
                        <h1>${vehicle.name}</h1>
                        <h2>${vehicle.registration}</h2>
                        <p>Scan to begin vehicle checklist.</p>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    };

    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-white">Vehicle QR Code</h2>
            <p className="text-gray-400 mb-1">Asset: <strong className="text-white">{vehicle.name}</strong></p>
            <p className="font-mono bg-gray-700 inline-block px-2 py-1 rounded-md text-lg mb-6">{vehicle.registration}</p>
            
            <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCodeUrl} alt={`QR Code for ${vehicle.registration}`} />
            </div>
            
            <p className="text-xs text-gray-500 mt-4">Scan this code to start the daily checklist for this vehicle.</p>

            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Close</button>
                <button type="button" onClick={handlePrint} className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                    <PrinterIcon className="h-5 w-5 mr-2" /> Print
                </button>
            </div>
        </div>
    );
};

export default QRCodeModal;