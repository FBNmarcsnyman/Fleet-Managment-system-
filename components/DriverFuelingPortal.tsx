import React, { useState } from 'react';
import { Bowser, User, Vehicle } from '../types';
import CameraModal from './CameraModal';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { SparklesIcon } from './icons/SparklesIcon';
import { CameraIcon } from './icons/CameraIcon';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { FuelIcon } from './icons/FuelIcon';

interface DriverFuelingPortalProps {
    bowserId: string;
    bowsers: Bowser[];
    users: User[];
    vehicles: Vehicle[];
    onSubmit: (data: {
        bowserId: string;
        vehicleId: string;
        driver: User;
        odometer: number;
        odometerPhoto: { name: string, type: string, data: string };
        liters: number;
        fuelerName: string;
    }) => void;
    onCancel: () => void;
}

type Step = 'driverScan' | 'vehicleScan' | 'details' | 'loading';
type CameraPurpose = 'driver' | 'vehicle' | 'odometer';

const DriverFuelingPortal: React.FC<DriverFuelingPortalProps> = ({ bowserId, bowsers, users, vehicles, onSubmit, onCancel }) => {
    const [step, setStep] = useState<Step>('driverScan');
    const [error, setError] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraPurpose, setCameraPurpose] = useState<CameraPurpose | null>(null);

    const [driver, setDriver] = useState<User | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    
    // Details form state
    const [liters, setLiters] = useState('');
    const [odometer, setOdometer] = useState('');
    const [fuelerName, setFuelerName] = useState('');
    const [odometerPhoto, setOdometerPhoto] = useState<{ name: string, type: string, data: string } | null>(null);

    const bowser = bowsers.find(b => b.id === bowserId);

    const handlePhotoCapture = async (dataUrl: string) => {
        setIsCameraOpen(false);
        setStep('loading');
        setError(null);

        if (!process.env.API_KEY) {
            setError("AI Verification is not available. Please contact an administrator.");
            setStep('driverScan');
            return;
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        try {
            if (cameraPurpose === 'driver') {
                // Fix: Changed model to 'gemini-3-flash-preview' for multimodal extraction task
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] } }, { text: "Extract the license number from this driver's license image. Respond as JSON with a 'licenseNumber' key." }] },
                    config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { licenseNumber: { type: Type.STRING } } } }
                });
                const text = response.text;
                const result = JSON.parse(text ? text.trim() : '{}');
                const licenseNumber = result.licenseNumber?.replace(/\s+/g, '').toUpperCase();
                if (!licenseNumber) throw new Error("Could not read license number.");
                
                const foundUser = users.find(u => u.licenseNumber?.replace(/\s+/g, '').toUpperCase() === licenseNumber);
                if (foundUser) {
                    setDriver(foundUser);
                    setStep('vehicleScan');
                } else {
                    throw new Error(`Driver with license number ${licenseNumber} not found.`);
                }
            } else if (cameraPurpose === 'vehicle') {
                // Fix: Changed model to 'gemini-3-flash-preview' for multimodal extraction task
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] } }, { text: "Extract the vehicle registration number from this license disk image. Respond as JSON with a 'registration' key." }] },
                    config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { registration: { type: Type.STRING } } } }
                });
                const text = response.text;
                const result = JSON.parse(text ? text.trim() : '{}');
                const registration = result.registration?.replace(/\s+/g, '').toUpperCase();
                if (!registration) throw new Error("Could not read registration number.");
                
                const foundVehicle = vehicles.find(v => v.registration.replace(/\s+/g, '').toUpperCase() === registration);
                if (foundVehicle) {
                    setVehicle(foundVehicle);
                    setStep('details');
                } else {
                    throw new Error(`Vehicle with registration ${registration} not found.`);
                }
            } else if (cameraPurpose === 'odometer') {
                setOdometerPhoto({ name: 'odometer.jpg', type: 'image/jpeg', data: dataUrl });
                setStep('details');
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An AI verification error occurred. Please try again with a clear photo.');
            setStep(cameraPurpose === 'driver' ? 'driverScan' : 'vehicleScan');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!driver || !vehicle || !liters || !odometer || !odometerPhoto || !fuelerName) {
            setError("Please fill out all fields, including the odometer photo.");
            return;
        }
        onSubmit({
            bowserId,
            vehicleId: vehicle.id,
            driver,
            odometer: parseFloat(odometer),
            odometerPhoto,
            liters: parseFloat(liters),
            fuelerName,
        });
    };

    const openCamera = (purpose: CameraPurpose) => {
        setCameraPurpose(purpose);
        setIsCameraOpen(true);
    };

    const renderStep = () => {
        switch (step) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center justify-center p-4">
                        <svg className="animate-spin h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-white font-semibold">Verifying with AI...</p>
                    </div>
                );
            case 'driverScan':
                return (
                    <>
                        <p className="text-gray-300 mb-6">To begin, please verify your identity by scanning your driver's license.</p>
                        <button onClick={() => openCamera('driver')} className="w-full flex justify-center items-center py-3 px-4 rounded-md text-white bg-brand-primary hover:bg-brand-secondary">
                            <SparklesIcon className="h-5 w-5 mr-2" /> Scan Driver's License
                        </button>
                    </>
                );
            case 'vehicleScan':
                return (
                    <>
                        <p className="text-gray-300 mb-6">Welcome, {driver?.name}. Now, please scan the vehicle's license disk.</p>
                        <button onClick={() => openCamera('vehicle')} className="w-full flex justify-center items-center py-3 px-4 rounded-md text-white bg-brand-primary hover:bg-brand-secondary">
                            <SparklesIcon className="h-5 w-5 mr-2" /> Scan License Disk
                        </button>
                    </>
                );
            case 'details':
                return (
                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        <div className="bg-gray-700/50 p-3 rounded-lg text-sm">
                            <p><strong className="text-gray-400">Driver:</strong> {driver?.name}</p>
                            <p><strong className="text-gray-400">Vehicle:</strong> {vehicle?.registration} ({vehicle?.name})</p>
                        </div>
                        <input type="number" value={liters} onChange={e => setLiters(e.target.value)} placeholder="Liters Filled" required className="w-full bg-gray-700 p-3 rounded-md" />
                        <input type="number" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="Odometer Reading" required className="w-full bg-gray-700 p-3 rounded-md" />
                        <input type="text" value={fuelerName} onChange={e => setFuelerName(e.target.value)} placeholder="Fueler's Name" required className="w-full bg-gray-700 p-3 rounded-md" />
                        <button type="button" onClick={() => openCamera('odometer')} className="w-full flex justify-center items-center py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                            <CameraIcon className="h-5 w-5 mr-2" /> Take Odometer Photo
                        </button>
                        {odometerPhoto && <p className="text-green-400 text-sm flex items-center"><PaperClipIcon className="h-4 w-4 mr-1"/> Photo Attached</p>}
                        <button type="submit" className="w-full flex justify-center items-center py-3 px-4 rounded-md text-white bg-green-600 hover:bg-green-700">Submit Fueling</button>
                    </form>
                );
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
            <div className="w-full max-w-sm p-8 space-y-6 bg-gray-800 rounded-lg shadow-2xl text-center">
                <FuelIcon className="w-16 h-16 mx-auto text-brand-secondary" />
                <h1 className="text-3xl font-bold text-white">Bowser Fueling</h1>
                <p className="text-gray-400">{bowser?.name || 'Loading...'}</p>

                {renderStep()}
                
                {error && <p className="mt-4 text-sm text-red-400 bg-red-900/30 p-3 rounded-md">{error}</p>}
                
                <button onClick={onCancel} className="text-sm text-gray-400 hover:text-white mt-4">Cancel</button>
            </div>
            {isCameraOpen && <CameraModal onCapture={handlePhotoCapture} onCancel={() => setIsCameraOpen(false)} />}
        </div>
    );
};

export default DriverFuelingPortal;