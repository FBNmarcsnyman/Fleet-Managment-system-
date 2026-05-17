
import React from 'react';
import { Supplier } from '../../types';
import { UploadIcon } from '../icons/UploadIcon';
import { PaperClipIcon } from '../icons/PaperClipIcon';

const SupplierFleetRates: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Fleet & Rates</h2>
                    <p className="text-gray-500 mt-1">Provide up-to-date capacity and pricing information.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800/40 p-6 rounded-xl border border-gray-700/50">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Network Regions</p>
                    <p className="text-white font-bold">{supplier.regions || 'Not Specified'}</p>
                </div>
                <div className="bg-gray-800/40 p-6 rounded-xl border border-gray-700/50">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Fleet Size</p>
                    <p className="text-white font-bold">{supplier.fleetSize || 'Unknown'}</p>
                </div>
                <div className="bg-gray-800/40 p-6 rounded-xl border border-gray-700/50">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">HAZ Compliant</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${supplier.hazCompliant ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {supplier.hazCompliant ? 'CERTIFIED' : 'NO'}
                    </span>
                </div>
            </div>

            <div className="bg-gray-800/20 p-8 rounded-2xl border border-dashed border-gray-700">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                    <PaperClipIcon className="h-5 w-5 mr-3 text-blue-400" />
                    Active Rate Cards
                </h3>
                <div className="space-y-3">
                    {supplier.rateCards?.map((rc, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-900/60 p-4 rounded-xl border border-white/5">
                            <span className="text-sm font-medium text-gray-300">{rc.name}</span>
                            <button className="text-xs font-bold text-blue-400 hover:underline">Download</button>
                        </div>
                    ))}
                    <button className="w-full flex items-center justify-center border-2 border-dashed border-gray-700 p-6 rounded-xl hover:border-blue-500/50 hover:bg-blue-600/5 transition-all text-gray-500 hover:text-blue-400 group">
                        <UploadIcon className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
                        <span className="font-bold uppercase tracking-widest text-xs">Upload Latest Rate Card</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupplierFleetRates;
