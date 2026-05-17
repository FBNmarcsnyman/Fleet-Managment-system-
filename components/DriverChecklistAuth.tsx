import React, { useState } from 'react';
import { Vehicle, User } from '../types';
import CameraModal from './CameraModal';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { FuelIcon } from './icons/FuelIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface DriverChecklistAuthProps {
    vehicle: Vehicle;
    users: User[];
    onAuthenticated: (user: User) => void;
}

const DriverChecklistAuth: React.FC<DriverChecklistAuthProps> = ({ vehicle, users, onAuthenticated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    
    const handleVerifyLicense = async (imageDataUrl: string) => {
        setIsCameraOpen(false);
        setIsLoading(true);
        setError(null);
        
        if (!process.env.API_KEY) {
            setError("API key is not configured. This feature is unavailable.");
            setIsLoading(false);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageDataUrl.split(',')[1],
                },
            };

            const prompt = "From the provided image of a driver's license, extract the license number. Respond with a single JSON object with one key: 'licenseNumber'.";

            // Fix: Changed model to 'gemini-3-flash-preview' for multimodal extraction task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            licenseNumber: { 
                                type: Type.STRING,
                                description: "The driver's license number, including all letters and numbers."
                            },
                        },
                        required: ['licenseNumber']
                    }
                }
            });

            const text = response.text;
            const jsonString = text ? text.trim() : '{}';
            const result = JSON.parse(jsonString);
            const extractedLicenseNumber = result.licenseNumber?.replace(/\s+/g, '').toUpperCase();

            if (!extractedLicenseNumber) {
                throw new Error("Could not read license number from the image. Please try again with a clearer picture.");
            }

            const foundUser = users.find(u => u.licenseNumber?.replace(/\s+/g, '').toUpperCase() === extractedLicenseNumber);
            
            if (foundUser) {
                onAuthenticated(foundUser);
            } else {
                setError(`Driver with license number ${extractedLicenseNumber} is not recognized. Please contact administration.`);
            }

        } catch (err) {
            console.error(err);
            setError(`Verification failed. Please try again. Error: ${err instanceof Error ? err.message : 'An unknown error occurred'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-2xl text-center">
                <FuelIcon className="w-16 h-16 mx-auto text-brand-secondary" />
                <h1 className="text-3xl font-bold text-white">Daily Vehicle Checklist</h1>
                
                <div className="text-left bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400">Vehicle: <span className="font-bold text-white">{vehicle.name}</span></p>
                    <p className="text-gray-400">Registration: <span className="font-bold text-white font-mono">{vehicle.registration}</span></p>
                </div>
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-4">
                        <svg className="animate-spin h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-white font-semibold">Verifying License...</p>
                        <p className="text-gray-400 text-sm">This may take a moment.</p>
                    </div>
                ) : (
                    <div>
                        <p className="text-gray-300 mb-6">To begin your pre-trip inspection, please scan your driver's license.</p>
                        <button
                            onClick={() => setIsCameraOpen(true)}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary focus:ring-offset-gray-800"
                        >
                            <SparklesIcon className="h-5 w-5 mr-2" />
                            Scan Driver's License to Begin
                        </button>
                    </div>
                )}

                {error && <p className="mt-4 text-sm text-red-400 bg-red-900/30 p-3 rounded-md">{error}</p>}
            </div>
            {isCameraOpen && <CameraModal onCapture={handleVerifyLicense} onCancel={() => setIsCameraOpen(false)} />}
        </div>
    );
};

export default DriverChecklistAuth;