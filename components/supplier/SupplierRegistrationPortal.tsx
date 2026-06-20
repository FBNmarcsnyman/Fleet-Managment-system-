
import React, { useState } from 'react';
import { useOperations } from '../../contexts/AppContexts';
import { Attachment } from '../../types';
import { UploadIcon } from '../icons/UploadIcon';
import { PaperClipIcon } from '../icons/PaperClipIcon';
import { FuelIcon } from '../icons/FuelIcon';
/* Fix: Added missing import CheckCircleIcon */
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

const SPECIALIZATIONS = [
    'Breakbulk', 'Courier', 'Full Loads', 'Tipper Bulk', 'Tankers', 'Abnormals', 'Hazchem'
];

const BEE_LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5+', 'Non-Compliant'];

const SupplierRegistrationPortal: React.FC<{ inviteToken?: string | null }> = ({ inviteToken }) => {
    const { handleAddSupplierApplication } = useOperations();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        companyName: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        address: '',
        specializations: [] as string[],
        routes: '',
        fleetSize: '',
        beeStatus: 'Non-Compliant',
        hazCompliant: false,
        controllerContact: '',
        accountsContact: '',
    });
    const [files, setFiles] = useState<{ fleetList: Attachment | null, rateCard: Attachment | null, insurance: Attachment | null }>({
        fleetList: null, rateCard: null, insurance: null
    });
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target as any;
        const finalValue = type === 'checkbox' ? (e.target as any).checked : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSpecializationChange = (spec: string) => {
        setFormData(prev => ({
            ...prev,
            specializations: prev.specializations.includes(spec)
                ? prev.specializations.filter(s => s !== spec)
                : [...prev.specializations, spec]
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: inputFiles } = e.target;
        if (inputFiles && inputFiles[0]) {
            const file = inputFiles[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                setFiles(prev => ({
                    ...prev,
                    [name]: { name: file.name, type: file.type, data: event.target?.result as string }
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!files.fleetList || !files.rateCard || !files.insurance) {
            alert("Please upload all required documents.");
            return;
        }
        handleAddSupplierApplication({ ...formData, ...files, inviteToken: inviteToken || undefined });
        setIsSubmitted(true);
    };

    if (isSubmitted) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0a0f1a] text-center p-4">
                 <div className="w-full max-w-lg p-10 space-y-6 bg-gray-900 rounded-3xl border border-white/5 shadow-2xl">
                    <div className="w-20 h-20 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircleIcon className="h-10 w-10 text-emerald-500" />
                    </div>
                    <h1 className="text-3xl font-black text-white">Application Received</h1>
                    <p className="text-gray-400 text-sm leading-relaxed">Thank you. Your company profile is now being reviewed by our compliance team. We will notify you via email once approved.</p>
                    <a href="/" className="inline-block mt-4 bg-brand-primary hover:bg-brand-secondary text-white font-black py-3 px-8 rounded-xl uppercase tracking-widest text-xs transition-all">Back to Login</a>
                </div>
            </div>
        );
    }
    
    const FileInput: React.FC<{ name: 'fleetList' | 'rateCard' | 'insurance', label: string }> = ({ name, label }) => (
         <div className="group">
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{label}</label>
            {files[name] ? (
                <div className="flex items-center justify-between bg-emerald-900/10 border border-emerald-500/30 p-3 rounded-xl">
                    <p className="text-sm text-emerald-400 flex items-center truncate"><PaperClipIcon className="h-4 w-4 mr-2"/> {files[name]?.name}</p>
                    <button type="button" onClick={() => setFiles(p => ({...p, [name]: null}))} className="text-xs text-red-400 font-bold hover:underline">Remove</button>
                </div>
            ) : (
                <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-800 rounded-xl border-2 border-dashed border-gray-700 cursor-pointer hover:border-brand-primary hover:bg-brand-primary/5 transition-all">
                    <UploadIcon className="h-6 w-6 text-gray-500 mr-3" />
                    <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">Upload {label}</span>
                    <input type="file" name={name} onChange={handleFileChange} className="hidden" required />
                </label>
            )}
        </div>
    );

    const inputClasses = "w-full bg-gray-800 text-white p-3.5 rounded-xl border border-gray-700 focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all placeholder-gray-600 text-sm";
    const labelClasses = "block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0f1a] p-4 sm:p-10">
            <div className="w-full max-w-2xl p-10 space-y-8 bg-gray-900 rounded-3xl border border-white/5 shadow-2xl">
                <div className="text-center">
                    <div className="bg-brand-primary w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/40">
                         <FuelIcon className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter text-white">Join Carrier Network</h1>
                    <p className="mt-2 text-gray-500 text-sm">Become a certified FBN Transport subcontractor.</p>
                    {inviteToken && (
                        <div className="mt-4 inline-flex items-center bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-4 py-2 rounded-full">
                            <CheckCircleIcon className="h-4 w-4 mr-2" /> You've been personally invited by FBN Transport
                        </div>
                    )}
                </div>

                <div className="flex justify-between mb-8 px-2 relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-800 -z-10 -translate-y-1/2"></div>
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= i ? 'bg-brand-primary text-white scale-110 shadow-lg shadow-blue-900/30' : 'bg-gray-800 text-gray-600'}`}>{i}</div>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 gap-4">
                                <div><label className={labelClasses}>Registered Company Name</label><input name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="e.g. Blue Star Logistics Ltd" required className={inputClasses} /></div>
                                <div><label className={labelClasses}>Main Business Address</label><input name="address" value={formData.address} onChange={handleInputChange} placeholder="Full physical address" required className={inputClasses} /></div>
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div><label className={labelClasses}>Contact Person</label><input name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} placeholder="Full Name" required className={inputClasses} /></div>
                                <div><label className={labelClasses}>Phone Number</label><input name="contactPhone" value={formData.contactPhone} onChange={handleInputChange} placeholder="Mobile or Office" required className={inputClasses} /></div>
                            </div>
                            <div><label className={labelClasses}>Primary Email</label><input name="contactEmail" value={formData.contactEmail} onChange={handleInputChange} placeholder="email@company.com" type="email" required className={inputClasses} /></div>
                            <div className="flex justify-end mt-8">
                                <button type="button" onClick={nextStep} className="bg-brand-primary hover:bg-brand-secondary text-white font-black py-3 px-10 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-blue-900/30 active:scale-95 transition-all">Next Step</button>
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <label className={labelClasses}>Logistics Specializations</label>
                                <div className="flex flex-wrap gap-2">
                                    {SPECIALIZATIONS.map(spec => (
                                        <button key={spec} type="button" onClick={() => handleSpecializationChange(spec)} className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${formData.specializations.includes(spec) ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-blue-900/30' : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500'}`}>
                                            {spec}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Fleet Size</label>
                                    <input name="fleetSize" value={formData.fleetSize} onChange={handleInputChange} placeholder="e.g. 15 Horses, 20 Superlinks" className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>BEE Status</label>
                                    <select name="beeStatus" value={formData.beeStatus} onChange={handleInputChange} className={inputClasses}>
                                        {BEE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 bg-gray-800/40 p-4 rounded-xl border border-gray-700">
                                <input type="checkbox" name="hazCompliant" checked={formData.hazCompliant} onChange={handleInputChange} className="w-5 h-5 rounded border-gray-700 text-brand-primary focus:ring-brand-primary bg-gray-900" />
                                <span className="text-sm font-bold text-gray-300">Our vehicles and drivers are HAZCHEM compliant.</span>
                            </div>
                            <div>
                                <label className={labelClasses}>Active Regions / Routes</label>
                                <textarea name="routes" value={formData.routes} onChange={handleInputChange} placeholder="e.g. JHB-DBN Daily, SADC Cross-border..." rows={3} required className={inputClasses} />
                            </div>
                            <div className="flex justify-between mt-8">
                                <button type="button" onClick={prevStep} className="bg-gray-800 hover:bg-gray-700 text-gray-400 font-black py-3 px-8 rounded-xl uppercase tracking-widest text-xs transition-all">Back</button>
                                <button type="button" onClick={nextStep} className="bg-brand-primary hover:bg-brand-secondary text-white font-black py-3 px-10 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-blue-900/30 active:scale-95 transition-all">Final Step</button>
                            </div>
                        </div>
                    )}
                     {step === 3 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl mb-4">
                                <p className="text-xs text-blue-400 font-bold leading-relaxed">Mandatory Uploads: Please provide valid PDF or Image files for our compliance audit.</p>
                            </div>
                            <FileInput name="fleetList" label="Fleet Manifest / Detail" />
                            <FileInput name="rateCard" label="Service Rate Card (2024)" />
                            <FileInput name="insurance" label="Goods-In-Transit (GIT) Policy" />
                            <div className="flex justify-between mt-8">
                                <button type="button" onClick={prevStep} className="bg-gray-800 hover:bg-gray-700 text-gray-400 font-black py-3 px-8 rounded-xl uppercase tracking-widest text-xs transition-all">Back</button>
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-10 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-emerald-900/30 active:scale-95 transition-all">Submit Profile</button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default SupplierRegistrationPortal;
