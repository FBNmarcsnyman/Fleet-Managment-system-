
import React, { useState } from 'react';
import { LoadConfirmation } from '../types';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { XIcon } from './icons/XIcon';

interface DriverJobUpdateModalProps {
    loadCon: LoadConfirmation;
    onSubmit: (loadConId: string, updates: { photos: { name: string, type: string, data: string }[], damageReport: string }) => void;
    onCancel: () => void;
}

const DriverJobUpdateModal: React.FC<DriverJobUpdateModalProps> = ({ loadCon, onSubmit, onCancel }) => {
    const [photos, setPhotos] = useState<{ name: string, type: string, data: string }[]>(loadCon.cargoPhotos || []);
    const [damageReport, setDamageReport] = useState(loadCon.damageReport || '');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setIsProcessing(true);
        const files = Array.from(e.target.files);
        
        const filePromises = files.map((file: File) => {
            return new Promise<{ name: string, type: string, data: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        resolve({ name: file.name, type: file.type, data: event.target.result as string });
                    } else {
                        reject(new Error(`Failed to read file: ${file.name}`));
                    }
                };
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
        });

        try {
            const newPhotos = await Promise.all(filePromises);
            setPhotos(prev => [...prev, ...newPhotos]);
        } catch (error) {
            console.error("Error processing files:", error);
            alert("There was an error attaching one or more files.");
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(loadCon.id, { photos, damageReport });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Update Job Details</h2>
            <p className="text-gray-400 mb-6">Load Con: <strong className="font-mono">{loadCon.loadConNumber}</strong></p>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Cargo Photos</label>
                    <input type="file" onChange={handleFileChange} multiple accept="image/*" className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white"/>
                    {isProcessing && <p className="text-xs text-yellow-400 mt-2">Processing...</p>}
                    {photos.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {photos.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                                    <div className="flex items-center text-sm text-gray-300 truncate"><PaperClipIcon className="h-4 w-4 mr-2"/>{file.name}</div>
                                    <button type="button" onClick={() => removePhoto(index)} className="text-gray-400 hover:text-red-400"><XIcon className="h-5 w-5" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Damage Report (if any)</label>
                    <textarea value={damageReport} onChange={e => setDamageReport(e.target.value)} rows={4} placeholder="Describe any damage to the cargo or issues with the load." className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600"/>
                </div>
            </div>
             <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Save Details</button>
            </div>
        </form>
    );
};

export default DriverJobUpdateModal;
