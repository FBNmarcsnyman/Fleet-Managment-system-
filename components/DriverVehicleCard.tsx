
import React from 'react';
import { Vehicle } from '../types';
import { CarIcon } from './icons/CarIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';

interface DriverVehicleCardProps {
    vehicle: Vehicle;
    onStartChecklist: () => void;
    onReportIncident: () => void;
    licenseExpiryWarning?: 'expiring' | 'expired' | null;
    pdpExpiryWarning?: 'expiring' | 'expired' | null;
}

const DriverVehicleCard: React.FC<DriverVehicleCardProps> = ({ vehicle, onStartChecklist, onReportIncident, licenseExpiryWarning, pdpExpiryWarning }) => {
    
    const getStatusClasses = (status: Vehicle['status']) => {
        switch (status) {
            case 'On the road':
                return 'bg-green-200 text-green-800';
            case 'In for service':
                return 'bg-yellow-200 text-yellow-800';
            case 'Off the road':
                return 'bg-red-200 text-red-800';
            case 'Sold':
                return 'bg-gray-300 text-gray-800';
            default:
                return 'bg-gray-200 text-gray-800';
        }
    };

    const getWarning = () => {
        if (pdpExpiryWarning === 'expired' || licenseExpiryWarning === 'expired') {
            return { text: 'License/PDP Expired', color: 'text-red-400' };
        }
        if (pdpExpiryWarning === 'expiring' || licenseExpiryWarning === 'expiring') {
            return { text: 'License/PDP Expiring Soon', color: 'text-yellow-400' };
        }
        return null;
    }

    const warning = getWarning();
    const isLicenseExpired = licenseExpiryWarning === 'expired' || pdpExpiryWarning === 'expired';

    return (
        <div
            className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between"
        >
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className="bg-brand-primary p-3 rounded-full mr-4">
                            <CarIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">{vehicle.name}</h3>
                            <p className="text-gray-400">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2 mb-4">
                    <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${getStatusClasses(vehicle.status)}`}>
                        {vehicle.status}
                    </span>
                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                        {vehicle.branch}
                    </span>
                </div>
                 <div className="flex justify-between items-center mt-2 border-t border-gray-700 pt-4">
                    <span className="text-gray-400">Registration:</span>
                    <span className="text-white font-mono bg-gray-700 px-2 py-1 rounded">{vehicle.registration}</span>
                </div>
                {warning && (
                    <div className={`mt-3 flex items-center text-sm font-semibold p-2 rounded-md ${warning.color === 'text-red-400' ? 'bg-red-900/50' : 'bg-yellow-900/50'}`}>
                        <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${warning.color}`} />
                        {warning.text}
                    </div>
                )}
            </div>
            <div className="mt-6 space-y-3">
                 <button
                    onClick={onStartChecklist}
                    disabled={isLicenseExpired}
                    title={isLicenseExpired ? "Cannot perform actions with expired license/PDP" : ""}
                    className="w-full flex items-center justify-center font-bold py-3 px-4 rounded-lg transition duration-300 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <ClipboardIcon className="h-5 w-5 mr-2" />
                    Start Daily Checklist
                </button>
                <button
                    onClick={onReportIncident}
                    disabled={isLicenseExpired}
                    title={isLicenseExpired ? "Cannot perform actions with expired license/PDP" : ""}
                    className="w-full flex items-center justify-center font-bold py-3 px-4 rounded-lg transition duration-300 bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    Report Incident
                </button>
                 <button
                    onClick={() => alert('Document feature coming soon!')}
                    className="w-full flex items-center justify-center font-bold py-3 px-4 rounded-lg transition duration-300 bg-gray-600 hover:bg-gray-500 text-white"
                >
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    View Documents
                </button>
            </div>
        </div>
    );
};

export default DriverVehicleCard;
