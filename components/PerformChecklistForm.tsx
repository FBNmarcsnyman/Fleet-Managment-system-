import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle, User, ChecklistTemplate, ChecklistItemResult, JobCard, ChecklistItemTemplate, Attachment } from '../types';
import CameraModal from './CameraModal';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { CameraIcon } from './icons/CameraIcon';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { LIGHT_DUTY_CHECKLIST, HEAVY_DUTY_RIGID_CHECKLIST, TRUCK_TRACTOR_CHECKLIST, TRAILER_CHECKLIST, FORKLIFT_CHECKLIST, SPOT_CHECK_CHECKLIST } from '../constants';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { SpeedometerIcon } from './icons/SpeedometerIcon';
import { ClockIcon } from './icons/ClockIcon';

// --- Helper Types ---
type SubmissionPayload = {
    vehicleId: string;
    templateId: string;
    templateName: string;
    odometer: number;
    hours?: number;
    allResults: ChecklistItemResult[];
    spotCheckJobCardId?: string;
}

interface PerformChecklistFormProps {
    vehicle: Vehicle;
    currentUser: User;
    templates: ChecklistTemplate[];
    onSubmit: (data: SubmissionPayload) => void;
    onCancel: () => void;
    isStandalonePage?: boolean;
    spotCheckJob?: JobCard;
    isPreview?: boolean;
}

const PerformChecklistForm: React.FC<PerformChecklistFormProps> = ({ vehicle, currentUser, templates, onSubmit, onCancel, isStandalonePage, spotCheckJob, isPreview }) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [odometer, setOdometer] = useState<string>(vehicle?.currentOdometer?.toString() || '');
    const [hours, setHours] = useState<string>(vehicle?.currentHours?.toString() || '');
    const [results, setResults] = useState<Record<string, ChecklistItemResult>>({});
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null);
    const [analyzingItems, setAnalyzingItems] = useState<Set<string>>(new Set());
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    const isSpotCheckMode = !!spotCheckJob;

    // Meter type by asset class: forklift = engine HOURS, trailer = HUBOMETER (km),
    // everything else = ODOMETER (km). Drives the right field + the trailer hubometer rule.
    const wc = (vehicle?.weightCategory || '').toLowerCase();
    const isForklift = /forklift|fork lift|reach truck/.test(wc);
    const isTrailer = /trailer|triaxle|skeleton|superlink/.test(wc);
    const meterType: 'odometer' | 'hubometer' | 'hours' = isForklift ? 'hours' : isTrailer ? 'hubometer' : 'odometer';
    const meterLabel = meterType === 'hours' ? 'Hours' : meterType === 'hubometer' ? 'Hubometer (km)' : 'Odometer (km)';
    // Trailer hubometer requirement: is one fitted? working? + a photo + the km reading.
    const [hubFitted, setHubFitted] = useState(true);
    const [hubWorking, setHubWorking] = useState(true);
    const [hubPhoto, setHubPhoto] = useState<Attachment | undefined>(undefined);

    useEffect(() => {
        if (!vehicle || templates.length === 0) return;
        
        if (isSpotCheckMode) {
            const spotCheckTemplate = templates.find(t => t.name.toLowerCase().includes("spot check"));
            if (spotCheckTemplate) {
                setSelectedTemplateId(spotCheckTemplate.id);
            }
            return;
        }

        if (isPreview && templates.length === 1) {
            setSelectedTemplateId(templates[0].id);
            return;
        }

        const category = vehicle.weightCategory;
        let suggestedTemplateId = '';
        
        if (['BAKKIE', '1 TONNER', '2 TONNER'].includes(category)) {
            suggestedTemplateId = templates.find(t => t.name.toLowerCase().includes('light duty'))?.id || '';
        } else if (['5 TONNER', '8 TONNER', '12 TONNER', '15 TONNER'].includes(category)) {
            suggestedTemplateId = templates.find(t => t.name.toLowerCase().includes('heavy duty rigid'))?.id || '';
        } else if (category === 'Horse') {
            suggestedTemplateId = templates.find(t => t.name.toLowerCase().includes('truck-tractor'))?.id || '';
        } else if (category.includes('Trailer')) {
            suggestedTemplateId = templates.find(t => t.name.toLowerCase().includes('trailer'))?.id || '';
        } else if (category === 'Forklift') {
             suggestedTemplateId = templates.find(t => t.name.toLowerCase().includes('forklift'))?.id || '';
        }

        if (suggestedTemplateId) {
            setSelectedTemplateId(suggestedTemplateId);
        } else if (templates.length > 0) {
            setSelectedTemplateId(templates[0].id);
        }

    }, [vehicle, templates, isSpotCheckMode, isPreview]);


    useEffect(() => {
        if (selectedTemplate?.items) {
            const newResults: Record<string, ChecklistItemResult> = {};
            selectedTemplate.items.forEach((item: ChecklistItemTemplate) => {
                 newResults[item.id] = {
                    itemId: item.id,
                    item: item.label,
                    status: 'Pass',
                    notes: '',
                    createJobCard: false,
                    priority: 'Medium',
                    severity: 'Low',
                };
            });
            setResults(newResults);

            const categoryMap: { [key: string]: { [key: string]: string[] } } = {
                'Light Duty Vehicle Checklist': LIGHT_DUTY_CHECKLIST,
                'Heavy Duty Rigid Checklist': HEAVY_DUTY_RIGID_CHECKLIST,
                'Heavy Duty Truck-Tractor Checklist': TRUCK_TRACTOR_CHECKLIST,
                'Trailer Checklist': TRAILER_CHECKLIST,
                'Forklift Checklist': FORKLIFT_CHECKLIST,
                "Manager's Spot Check": SPOT_CHECK_CHECKLIST,
            };
            const sourceChecklist = categoryMap[selectedTemplate.name];
            if (sourceChecklist) {
                const firstCategoryKey = Object.keys(sourceChecklist)[0];
                if (firstCategoryKey) {
                    const firstCategoryName = firstCategoryKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) + " Checks";
                    setOpenCategories(new Set([firstCategoryName]));
                } else {
                    setOpenCategories(new Set());
                }
            } else if (selectedTemplate.items.length > 0) {
                setOpenCategories(new Set(['Checklist Items']));
            } else {
                setOpenCategories(new Set());
            }

        } else {
            setResults({});
            setOpenCategories(new Set());
        }
    }, [selectedTemplate]);
    
    const categorizedItems = useMemo<{ category: string; items: ChecklistItemTemplate[] }[]>(() => {
        if (!selectedTemplate?.items) return [];
        
        const categoryMap: { [key: string]: { [key: string]: string[] } } = {
            'Light Duty Vehicle Checklist': LIGHT_DUTY_CHECKLIST,
            'Heavy Duty Rigid Checklist': HEAVY_DUTY_RIGID_CHECKLIST,
            'Heavy Duty Truck-Tractor Checklist': TRUCK_TRACTOR_CHECKLIST,
            'Trailer Checklist': TRAILER_CHECKLIST,
            'Forklift Checklist': FORKLIFT_CHECKLIST,
            "Manager's Spot Check": SPOT_CHECK_CHECKLIST,
        };
        
        const sourceChecklist = categoryMap[selectedTemplate.name];
        if (!sourceChecklist) {
            return [{ category: 'Checklist Items', items: selectedTemplate.items }];
        }

        const grouped: { category: string; items: ChecklistItemTemplate[] }[] = [];
        for (const categoryKey in sourceChecklist) {
            const categoryName = categoryKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) + " Checks";
            const categoryLabels = sourceChecklist[categoryKey as keyof typeof sourceChecklist];
            
            const matchingItems = selectedTemplate.items.filter(item => categoryLabels.includes(item.label));

            if (matchingItems.length > 0) {
                grouped.push({
                    category: categoryName,
                    items: matchingItems,
                });
            }
        }
        return grouped;

    }, [selectedTemplate]);

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    const handleResultChange = (itemId: string, newResult: Partial<ChecklistItemResult>) => {
        setResults(prev => {
            const currentResult = prev[itemId];
            if (!currentResult) return prev;

            const updatedResult = { ...currentResult, ...newResult };
    
            // Automatically apply side-effects when the status changes.
            if (newResult.status) {
                switch (newResult.status) {
                    case 'Fail':
                        updatedResult.createJobCard = true;
                        break;
                    case 'Needs Attention':
                        if (currentResult.status !== 'Needs Attention') {
                            updatedResult.createJobCard = true;
                        }
                        break;
                    case 'Pass':
                        updatedResult.createJobCard = false;
                        updatedResult.notes = '';
                        updatedResult.attachment = undefined;
                        updatedResult.severity = 'Low';
                        break;
                }
            }
    
            return { ...prev, [itemId]: updatedResult };
        });
    };
    
    const analyzeDamage = async (itemId: string, dataUrl: string) => {
        const itemResult = results[itemId];
        if (!itemResult) return;

        if (isPreview || !process.env.API_KEY) {
            handleResultChange(itemId, { notes: 'Awaiting description...' });
            return;
        }

        setAnalyzingItems(prev => new Set(prev).add(itemId));
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] } };
            const prompt = `Concisely describe the damage to the vehicle part "${itemResult.item}" shown in the image in one sentence. Example: "Large crack across the bottom left of the windscreen."`;

            // Fix: Changed model to 'gemini-3-flash-preview' for basic multimodal task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, { text: prompt }] },
            });
            const text = response.text;
            handleResultChange(itemId, { notes: text || '' });
        } catch (error) {
            console.error("AI Damage Assessment Failed:", error);
            handleResultChange(itemId, { notes: 'AI analysis failed. Please describe the issue manually.' });
        } finally {
            setAnalyzingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
            });
        }
    };

    const handlePhotoCapture = (dataUrl: string) => {
        if (activePhotoItemId === 'meta-hubometer') {
            setHubPhoto({ name: 'hubometer.jpg', type: 'image/jpeg', data: dataUrl });
            setIsCameraOpen(false); setActivePhotoItemId(null); return;
        }
        if (activePhotoItemId) {
            const itemId = activePhotoItemId;
            const result = results[itemId];
            if (result) {
                handleResultChange(itemId, {
                    attachment: {
                        name: `${result.item.replace(/\s/g, '_')}.jpg`,
                        type: 'image/jpeg',
                        data: dataUrl,
                    }
                });
                analyzeDamage(itemId, dataUrl);
            }
        }
        setIsCameraOpen(false);
        setActivePhotoItemId(null);
    };
    
    const handleOpenCamera = (itemId: string) => {
        if (isPreview) return;
        setActivePhotoItemId(itemId);
        setIsCameraOpen(true);
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isPreview) return;
        
        if (!selectedTemplate) {
            alert("Please select a checklist template.");
            return;
        }

        // Forklift = hours is the meter; trailer with no hubometer = no reading needed.
        const needsReading = meterType !== 'hours' && !(isTrailer && !hubFitted);
        let odoNum = parseFloat(odometer);
        if (needsReading) {
            if (isNaN(odoNum) || odoNum < (vehicle?.currentOdometer || 0)) {
                alert(`Invalid ${meterLabel}. Current record is ${vehicle?.currentOdometer || 0} km. You cannot log a lower value.`);
                return;
            }
        } else {
            odoNum = vehicle?.currentOdometer || 0; // keep the stored reading unchanged
        }
        if (isForklift) {
            const hrNum = parseFloat(hours);
            if (isNaN(hrNum) || hrNum < (vehicle?.currentHours || 0)) {
                alert(`Invalid Hours. Current record is ${vehicle?.currentHours || 0} hrs. You cannot log a lower value.`);
                return;
            }
        }

        // Trailer hubometer outcome → a recorded result line. Not fitted = a flagged
        // (red) item so it's chased; fitted-but-not-working = needs attention.
        const extra: ChecklistItemResult[] = [];
        if (isTrailer) {
            extra.push(!hubFitted
                ? { itemId: 'meta-hubometer', item: 'Hubometer', status: 'Fail', notes: 'No hubometer fitted on this trailer — please fit one.', severity: 'Minor', createJobCard: false }
                : { itemId: 'meta-hubometer', item: 'Hubometer', status: hubWorking ? 'Pass' : 'Needs Attention', notes: `Reading ${odoNum.toLocaleString()} km${hubWorking ? ' · working / good condition' : ' · NOT working / damaged'}`, attachment: hubPhoto });
        }

        onSubmit({
            vehicleId: vehicle.id,
            templateId: selectedTemplate.id,
            templateName: selectedTemplate.name,
            odometer: odoNum,
            hours: hours ? parseFloat(hours) : undefined,
            allResults: [...Object.values(results), ...extra],
            spotCheckJobCardId: spotCheckJob?.id,
        });
    };

    const FormWrapper: React.FC<{isStandalone?: boolean, children: React.ReactNode}> = ({ isStandalone, children }) => {
        if (isStandalone) {
            return <div className="bg-gray-800 p-4 sm:p-6 md:p-8 rounded-lg shadow-lg mx-auto max-w-5xl">{children}</div>;
        }
        return <>{children}</>;
    };

    if (!vehicle) {
        return <div className="text-red-400">Error: No vehicle selected.</div>;
    }

    const title = isPreview ? 'Preview Checklist' : isSpotCheckMode ? "Manager's Spot Check" : "Perform Vehicle Checklist";

    return (
        <FormWrapper isStandalone={isStandalonePage}>
            <form onSubmit={handleSubmit}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{title}</h2>
                        <p className="text-gray-400">Vehicle: <strong>{vehicle.name} ({vehicle.registration})</strong> | User: <strong>{currentUser.name}</strong></p>
                    </div>
                    {!isPreview && (
                         <div className="flex flex-col gap-2 bg-gray-900/40 p-3 rounded-xl border border-gray-700/50">
                            <div className="flex space-x-4">
                                {/* Forklift = hours; trailer = hubometer km; else odometer km */}
                                {meterType !== 'hours' && (
                                    <div className="w-36">
                                        <label className="flex items-center text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                                            <SpeedometerIcon className="h-3 w-3 mr-1" /> {meterLabel}
                                        </label>
                                        <input type="number" value={odometer} onChange={e => setOdometer(e.target.value)} required={!(isTrailer && !hubFitted)} disabled={isTrailer && !hubFitted}
                                            className="w-full bg-gray-800 text-white p-2 rounded-lg border border-gray-600 focus:ring-1 focus:ring-brand-secondary text-sm font-mono disabled:opacity-40" />
                                    </div>
                                )}
                                {isForklift && (
                                    <div className="w-32">
                                        <label className="flex items-center text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                                            <ClockIcon className="h-3 w-3 mr-1" /> Hours
                                        </label>
                                        <input type="number" value={hours} onChange={e => setHours(e.target.value)} required
                                            className="w-full bg-gray-800 text-white p-2 rounded-lg border border-gray-600 focus:ring-1 focus:ring-brand-secondary text-sm font-mono" />
                                    </div>
                                )}
                            </div>
                            {/* Trailer hubometer requirement */}
                            {isTrailer && (
                                <div className="border-t border-gray-700/50 pt-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Hubometer fitted?</span>
                                        <button type="button" onClick={() => setHubFitted(true)} className={`text-[11px] font-bold px-2.5 py-1 rounded ${hubFitted ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Yes</button>
                                        <button type="button" onClick={() => setHubFitted(false)} className={`text-[11px] font-bold px-2.5 py-1 rounded ${!hubFitted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>No</button>
                                    </div>
                                    {hubFitted ? (
                                        <div className="flex items-center gap-2 flex-wrap mt-2">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Condition</span>
                                            <button type="button" onClick={() => setHubWorking(true)} className={`text-[11px] font-bold px-2.5 py-1 rounded ${hubWorking ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Working / good</button>
                                            <button type="button" onClick={() => setHubWorking(false)} className={`text-[11px] font-bold px-2.5 py-1 rounded ${!hubWorking ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-300'}`}>Not working</button>
                                            <button type="button" onClick={() => handleOpenCamera('meta-hubometer')} className="text-[11px] font-bold px-2.5 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 flex items-center gap-1"><CameraIcon className="h-3 w-3" /> {hubPhoto ? 'Retake photo' : 'Take photo'}</button>
                                            {hubPhoto && <span className="text-[11px] text-emerald-400 font-bold">✓ photo</span>}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-red-400 font-bold mt-2">⚠ Flagged — no hubometer fitted. Please fit one so kms can be tracked for servicing.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="mb-6">
                    <label htmlFor="template-select" className="block text-sm font-medium text-gray-300 mb-1">Checklist Template</label>
                    <select
                        id="template-select"
                        value={selectedTemplateId}
                        onChange={e => setSelectedTemplateId(e.target.value)}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                        required
                        disabled={isSpotCheckMode || isPreview}
                    >
                        <option value="" disabled>-- Choose a checklist --</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                     {isSpotCheckMode && <p className="text-xs text-purple-400 mt-1">This is a mandatory spot check.</p>}
                </div>

                {selectedTemplate && categorizedItems.length > 0 && (
                    <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                        {categorizedItems.map(({ category, items }) => {
                             const isOpen = openCategories.has(category);
                            return (
                                <div key={category} className="bg-gray-700/30 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(category)}
                                        className="w-full flex justify-between items-center p-3 text-left"
                                        aria-expanded={isOpen}
                                    >
                                        <h3 className="text-lg font-semibold text-brand-secondary/80">{category}</h3>
                                        <ChevronDownIcon className={`h-6 w-6 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isOpen && (
                                        <div className="space-y-4 p-4 border-t border-gray-700">
                                            {items.map((item) => {
                                                const result = results[item.id];
                                                if (!result) return null;
                                                
                                                return (
                                                    <div key={item.id} className="bg-gray-700/50 p-4 rounded-md">
                                                        <div className="flex justify-between items-center">
                                                            <label className="font-medium text-white">{item.label}</label>
                                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResultChange(item.id, { status: 'Pass' })}
                                                                    className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-full transition-colors ${result.status === 'Pass' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-green-700'}`}
                                                                    disabled={isPreview}
                                                                >
                                                                    <CheckCircleIcon className="h-5 w-5" />
                                                                    <span>Pass</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResultChange(item.id, { status: 'Needs Attention' })}
                                                                    className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-full transition-colors ${result.status === 'Needs Attention' ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-yellow-700'}`}
                                                                    disabled={isPreview}
                                                                >
                                                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                                                    <span>Attention</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResultChange(item.id, { status: 'Fail' })}
                                                                    className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-full transition-colors ${result.status === 'Fail' ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-red-700'}`}
                                                                    disabled={isPreview}
                                                                >
                                                                    <XCircleIcon className="h-5 w-5" />
                                                                    <span>Fail</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {result.status !== 'Pass' && (
                                                            <div className="mt-3 space-y-3">
                                                                <div className="relative">
                                                                    <textarea
                                                                        value={result.notes}
                                                                        onChange={e => handleResultChange(item.id, { notes: e.target.value })}
                                                                        placeholder="Add notes about the issue..."
                                                                        className="w-full bg-gray-600 text-white p-2 rounded-md border border-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-secondary"
                                                                        rows={2}
                                                                        disabled={isPreview}
                                                                    />
                                                                    {analyzingItems.has(item.id) && (
                                                                        <div className="absolute inset-0 bg-gray-600/70 flex items-center justify-center rounded-md">
                                                                            <p className="text-sm text-yellow-300 animate-pulse">AI is analyzing image...</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center">
                                                                    {result.attachment ? (
                                                                        <div className="flex items-center space-x-2">
                                                                            <a href={result.attachment.data} target="_blank" rel="noopener noreferrer" title={`View full size: ${result.attachment.name}`}>
                                                                                <img src={result.attachment.data} alt="Attachment preview" className="h-12 w-12 rounded object-cover border-2 border-gray-500 hover:border-blue-400" />
                                                                            </a>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleResultChange(item.id, { attachment: undefined })}
                                                                                className="self-start p-1 text-gray-400 hover:text-red-400 disabled:opacity-50"
                                                                                title="Remove photo"
                                                                                disabled={isPreview}
                                                                            >
                                                                                <XCircleIcon className="h-5 w-5" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenCamera(item.id)}
                                                                            className="flex items-center text-sm font-semibold py-1 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:bg-gray-500"
                                                                            disabled={isPreview}
                                                                        >
                                                                            <CameraIcon className="h-4 w-4 mr-2" />
                                                                            Attach Photo
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="pt-3 border-t border-gray-600 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                                                    <div>
                                                                        <label className="flex items-center space-x-2 cursor-pointer group">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!result.createJobCard}
                                                                                onChange={(e) => handleResultChange(item.id, { createJobCard: e.target.checked })}
                                                                                className="form-checkbox h-5 w-5 text-brand-primary bg-gray-600 border-gray-500 rounded focus:ring-brand-secondary"
                                                                                disabled={isPreview || result.status === 'Fail'}
                                                                            />
                                                                            <span className="text-gray-300 font-semibold group-hover:text-white transition-colors">Report Issue (Create Job Card)</span>
                                                                        </label>
                                                                        <p className="text-xs text-gray-400 pl-7">{result.status === 'Fail' ? 'Mandatory for failed items.' : 'Uncheck if this does not require workshop attention.'}</p>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        {result.status === 'Needs Attention' && (
                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-300 mb-1">Set Severity</label>
                                                                                <select
                                                                                    value={result.severity || 'Low'}
                                                                                    onChange={e => handleResultChange(item.id, { severity: e.target.value as 'Low' | 'Medium' | 'High' })}
                                                                                    className="w-full bg-gray-600 text-white p-2 rounded-md border border-gray-500"
                                                                                    disabled={isPreview}
                                                                                >
                                                                                    <option value="Low">Low</option>
                                                                                    <option value="Medium">Medium</option>
                                                                                    <option value="High">High</option>
                                                                                </select>
                                                                            </div>
                                                                        )}
                                                                        {result.createJobCard && (
                                                                            <div>
                                                                                <label className="block text-sm font-medium text-gray-300 mb-1">Set Priority</label>
                                                                                <select
                                                                                    value={result.priority || 'Medium'}
                                                                                    onChange={e => handleResultChange(item.id, { priority: e.target.value as JobCard['priority'] })}
                                                                                    className="w-full bg-gray-600 text-white p-2 rounded-md border border-gray-500"
                                                                                    disabled={isPreview}
                                                                                >
                                                                                    <option value="Low">Low</option>
                                                                                    <option value="Medium">Medium</option>
                                                                                    <option value="High">High</option>
                                                                                    <option value="Critical">Critical</option>
                                                                                </select>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
                
                <div className="flex justify-end space-x-4 mt-8">
                    <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
                         {isPreview ? 'Close' : 'Cancel'}
                    </button>
                     {!isPreview && (
                        <button type="submit" disabled={!selectedTemplate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">
                            Submit Checklist
                        </button>
                    )}
                </div>
            </form>
            {isCameraOpen && <CameraModal onCapture={handlePhotoCapture} onCancel={() => setIsCameraOpen(false)} />}
        </FormWrapper>
    );
};

export default PerformChecklistForm;