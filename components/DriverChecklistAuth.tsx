import React, { useMemo, useState } from 'react';
import { Vehicle, User } from '../types';
import CameraModal from './CameraModal';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { FuelIcon } from './icons/FuelIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface DriverChecklistAuthProps {
    vehicle: Vehicle;
    users: User[];
    drivers?: any[];
    onAuthenticated: (user: User) => void;
}

// Identify the driver before a checklist: pick their name from the list, or
// scan their licence. Covers both login users and licence-free driver records.
const DriverChecklistAuth: React.FC<DriverChecklistAuthProps> = ({ vehicle, users, drivers = [], onAuthenticated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [selectedKey, setSelectedKey] = useState('');

    // Everyone who can drive: licence-free driver records + staff/driver logins.
    const identities = useMemo(() => {
        const out: { key: string; name: string; lic: string; user: User }[] = [];
        (drivers || []).filter((d: any) => d.isActive !== false).forEach((d: any) => out.push({
            key: `d:${d.id}`, name: d.name, lic: (d.licenceNo || '').replace(/\s+/g, '').toUpperCase(),
            user: { name: d.name, email: `driver:${d.id}`, role: 'Staff', permissions: [], assignedBranches: [] } as unknown as User,
        }));
        (users || []).filter((u: any) => u.role === 'Staff' || u.role === 'Driver').forEach((u: any) => {
            if (!out.some(o => o.name.toLowerCase() === (u.name || '').toLowerCase())) {
                out.push({ key: `u:${u.email}`, name: u.name, lic: (u.licenseNumber || '').replace(/\s+/g, '').toUpperCase(), user: u });
            }
        });
        return out.sort((a, b) => a.name.localeCompare(b.name));
    }, [drivers, users]);

    const beginWithSelected = () => {
        const id = identities.find(i => i.key === selectedKey);
        if (!id) { setError('Please choose your name from the list.'); return; }
        onAuthenticated(id.user);
    };

    const handleVerifyLicense = async (imageDataUrl: string) => {
        setIsCameraOpen(false);
        setIsLoading(true);
        setError(null);
        if (!process.env.API_KEY) { setError('Licence scanning is not available — please pick your name from the list instead.'); setIsLoading(false); return; }
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imageDataUrl.split(',')[1] } };
            const prompt = "From the provided image of a South African driver's licence, extract the licence number. Respond with a single JSON object with one key: 'licenseNumber'.";
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [imagePart, { text: prompt }] },
                config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { licenseNumber: { type: Type.STRING } }, required: ['licenseNumber'] } },
            });
            const result = JSON.parse((response.text || '{}').trim());
            const lic = result.licenseNumber?.replace(/\s+/g, '').toUpperCase();
            if (!lic) throw new Error('Could not read the licence number. Try a clearer photo or pick your name.');
            const match = identities.find(i => i.lic && i.lic === lic);
            if (match) onAuthenticated(match.user);
            else setError(`Licence ${lic} isn't recognised. Pick your name from the list, or ask the office to add your licence.`);
        } catch (err) {
            setError(`Couldn't read the licence: ${err instanceof Error ? err.message : 'unknown error'}. Pick your name instead.`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
            <div className="w-full max-w-md p-8 space-y-5 bg-gray-800 rounded-lg shadow-2xl text-center">
                <FuelIcon className="w-14 h-14 mx-auto text-brand-secondary" />
                <h1 className="text-2xl font-bold text-white">Daily Vehicle Checklist</h1>
                <div className="text-left bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400">Vehicle: <span className="font-bold text-white">{vehicle.name}</span></p>
                    <p className="text-gray-400">Registration: <span className="font-bold text-white font-mono">{vehicle.registration}</span></p>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-4">
                        <svg className="animate-spin h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <p className="text-white font-semibold">Reading licence…</p>
                    </div>
                ) : (
                    <>
                        <div className="text-left">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Who are you?</label>
                            <div className="flex gap-2">
                                <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)} className="flex-1 bg-gray-700 text-white p-3 rounded-md border border-gray-600">
                                    <option value="">-- Choose your name --</option>
                                    {identities.map(i => <option key={i.key} value={i.key}>{i.name}</option>)}
                                </select>
                                <button onClick={beginWithSelected} disabled={!selectedKey} className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 text-white font-bold px-5 rounded-md">Start</button>
                            </div>
                            {identities.length === 0 && <p className="text-xs text-amber-400 mt-1">No drivers loaded yet — add them under Fleet → Drivers.</p>}
                        </div>
                        <div className="flex items-center gap-3 text-gray-500 text-xs"><div className="flex-1 h-px bg-gray-700" /> OR <div className="flex-1 h-px bg-gray-700" /></div>
                        <button onClick={() => setIsCameraOpen(true)} className="w-full flex justify-center items-center py-3 px-4 rounded-md text-sm font-medium text-white bg-gray-700 hover:bg-gray-600">
                            <SparklesIcon className="h-5 w-5 mr-2" /> Scan my licence instead
                        </button>
                    </>
                )}
                {error && <p className="mt-2 text-sm text-red-400 bg-red-900/30 p-3 rounded-md">{error}</p>}
            </div>
            {isCameraOpen && <CameraModal onCapture={handleVerifyLicense} onCancel={() => setIsCameraOpen(false)} />}
        </div>
    );
};

export default DriverChecklistAuth;
