
import React, { useState } from 'react';
import { LoadConfirmation, User } from '../../types';
import { PaperClipIcon } from '../icons/PaperClipIcon';
import { XIcon } from '../icons/XIcon';

interface UpdateJobModalProps {
    loadCon: LoadConfirmation;
    currentUser: User;
    onUpdate: (loadConId: string, updates: Partial<LoadConfirmation>) => void;
    onCancel: () => void;
}

const UpdateJobModal: React.FC<UpdateJobModalProps> = ({ loadCon, currentUser, onUpdate, onCancel }) => {
    const [note, setNote] = useState('');
    const [photos, setPhotos] = useState<{ name: string; type: string; data: string }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setIsProcessing(true);
        const files = Array.from(e.target.files);

        const filePromises = files.map((file: File) => {
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
            const newPhotos = await Promise.all(filePromises);
            setPhotos((prev) => [...prev, ...newPhotos]);
        } catch (error) {
            console.error("Error processing files:", error);
            alert("There was an error attaching one or more files.");
        } finally {
            setIsProcessing(false);
            e.target.value = '';
        }
    };

    const removePhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updates: Partial<LoadConfirmation> = {};

        if (note.trim()) {
            const newNote = {
                timestamp: new Date().toISOString(),
                text: note.trim(),
                userId: currentUser.email,
                userName: currentUser.name,
            };
            updates.notes = [...(loadCon.notes || []), newNote];
        }

        if (photos.length > 0) {
            updates.cargoPhotos = [...(loadCon.cargoPhotos || []), ...photos];
        }

        if (Object.keys(updates).length > 0) {
            onUpdate(loadCon.id, updates);
        }
        onCancel();
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4 text-white">Add Note or Photo</h2>
            <p className="text-gray-400 mb-6">Load Con: <strong className="font-mono">{loadCon.loadConNumber}</strong></p>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Add Note</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Add a note about this job..." className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Attach Photos</label>
                    <input type="file" onChange={handleFileChange} multiple accept="image/*" className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white" />
                    {isProcessing && <p className="text-xs text-yellow-400 mt-2">Processing...</p>}
                    {photos.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {photos.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                                    <div className="flex items-center text-sm text-gray-300 truncate"><PaperClipIcon className="h-4 w-4 mr-2" />{file.name}</div>
                                    <button type="button" onClick={() => removePhoto(index)} className="text-gray-400 hover:text-red-400"><XIcon className="h-5 w-5" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                <button type="submit" className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Save Update</button>
            </div>
        </form>
    );
};

export default UpdateJobModal;
