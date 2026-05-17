

import React, { useState, useMemo } from 'react';
import { Manifest, LoadConfirmation } from '../types';
import { CameraIcon } from './icons/CameraIcon';

interface ReceiveManifestModalProps {
    manifest: Manifest;
    loadConfirmations: LoadConfirmation[];
    onSubmit: (manifestId: string, arrivalDamage: { loadConId: string, photos: { name: string, type: string, data: string }[] }[]) => void;
    onCancel: () => void;
}

const ReceiveManifestModal: React.FC<ReceiveManifestModalProps> = ({ manifest, loadConfirmations, onSubmit, onCancel }) => {
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [damagePhotos, setDamagePhotos] = useState<Map<string, { name: string, type: string, data: string }[]>>(new Map());

    const manifestLoads = useMemo(() => {
        return manifest.loadConfirmationIds.map(id => loadConfirmations.find(lc => lc.id === id)).filter(Boolean) as LoadConfirmation[];
    }, [manifest, loadConfirmations]);

    const handleCheckItem = (id: string) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, loadConId: string) => {
        const files = e.target.files;
        if (!files) return;

        const filePromises = Array.from(files).map((file: File) => {
            return new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
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
            const newPhotos: { name: string; type: string; data: string }[] = await Promise.all(filePromises);
            setDamagePhotos(prev => {
                const newMap = new Map(prev);
                const existingPhotos = newMap.get(loadConId);
                // FIX: Use Array.isArray to ensure TypeScript correctly infers the type as an array, resolving the iterator error.
                if (Array.isArray(existingPhotos)) {
                    newMap.set(loadConId, [...existingPhotos, ...newPhotos]);
                } else {
                    newMap.set(loadConId, newPhotos);
                }
                return newMap;
            });
        } catch (error) {
            console.error("Error processing files:", error);
            alert("There was an error attaching one or more files. Please try again.");
        }
    };

    const handleSubmit = () => {
        if (checkedItems.size !== manifestLoads.length) {
            alert('Please check off all items on the manifest before confirming receipt.');
            return;
        }
        const arrivalDamage = Array.from(damagePhotos.entries()).map(([loadConId, photos]) => ({ loadConId, photos }));
        onSubmit(manifest.id, arrivalDamage);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Receive Manifest: {manifest.manifestNumber}</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {manifestLoads.map(lc => (
                    <div key={lc.id} className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={checkedItems.has(lc.id)} onChange={() => handleCheckItem(lc.id)} className="form-checkbox h-5 w-5 text-brand-primary" />
                                <span>{lc.loadConNumber}</span>
                            </label>
                            <label className="cursor-pointer text-xs font-semibold text-yellow-400 flex items-center">
                                <CameraIcon className="h-4 w-4 mr-1"/> Report Damage
                                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, lc.id)}/>
                            </label>
                        </div>
                        <div className="pl-8 text-xs text-gray-400">
                            {damagePhotos.get(lc.id)?.map((p, i) => <span key={i} className="mr-2">{p.name}</span>)}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Confirm Receipt</button>
            </div>
        </div>
    );
};

export default ReceiveManifestModal;
