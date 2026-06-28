
import React from 'react';
import { Supplier } from '../../types';
import { UploadIcon } from '../icons/UploadIcon';
import { PaperClipIcon } from '../icons/PaperClipIcon';

const SupplierFleetRates: React.FC<{ supplier: Supplier }> = ({ supplier }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Fleet & Rates</h2>
                    <p className="text-slate-400 mt-1">Provide up-to-date capacity and pricing information.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Network Regions</p>
                    <p className="text-slate-900 font-bold">{supplier.regions || 'Not Specified'}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fleet Size</p>
                    <p className="text-slate-900 font-bold">{supplier.fleetSize || 'Unknown'}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">HAZ Compliant</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${supplier.hazCompliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {supplier.hazCompliant ? 'CERTIFIED' : 'NO'}
                    </span>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                    <PaperClipIcon className="h-5 w-5 mr-3 text-blue-700" />
                    Active Rate Cards
                </h3>
                <div className="space-y-3">
                    {supplier.rateCards?.map((rc, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <span className="text-sm font-medium text-slate-600">{rc.name}</span>
                            <button className="text-xs font-bold text-blue-700 hover:underline">Download</button>
                        </div>
                    ))}
                    <button className="w-full flex items-center justify-center border-2 border-dashed border-slate-200 p-6 rounded-xl hover:border-blue-500/50 hover:bg-blue-50 transition-all text-slate-400 hover:text-blue-700 group">
                        <UploadIcon className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
                        <span className="font-bold uppercase tracking-widest text-xs">Upload Latest Rate Card</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupplierFleetRates;
