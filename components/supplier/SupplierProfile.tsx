
import React from 'react';
import { Supplier } from '../../types';

const SupplierProfile: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    const itemClasses = "bg-gray-800/40 p-4 rounded-xl border border-gray-700/50";
    const labelClasses = "text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1";
    const valueClasses = "text-white font-bold";

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight">Company Profile</h2>
                <p className="text-gray-500 mt-1">Manage your administrative and contact details.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={itemClasses}>
                    <p className={labelClasses}>Company Name</p>
                    <p className={valueClasses}>{supplier.name}</p>
                </div>
                <div className={itemClasses}>
                    <p className={labelClasses}>Physical Address</p>
                    <p className={valueClasses}>{supplier.address}</p>
                </div>
                <div className={itemClasses}>
                    <p className={labelClasses}>Operations / Controller Contact</p>
                    {/* Fix: changed 's.contactPerson' to 'supplier.contactPerson' */}
                    <p className={valueClasses}>{supplier.controllerContact || supplier.contactPerson}</p>
                    <p className="text-xs text-gray-500 mt-1">{supplier.contactEmail}</p>
                </div>
                <div className={itemClasses}>
                    <p className={labelClasses}>Accounts Contact</p>
                    <p className={valueClasses}>{supplier.accountsContact || 'Not Set'}</p>
                </div>
            </div>

            <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-2xl flex items-center justify-between">
                <div>
                    <p className="font-bold text-blue-300">Need to update official details?</p>
                    <p className="text-sm text-blue-400/80">Changes to registration or banking require manual verification.</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2 px-6 rounded-lg text-xs uppercase tracking-wider">
                    Contact FBN Admin
                </button>
            </div>
        </div>
    );
};

export default SupplierProfile;
