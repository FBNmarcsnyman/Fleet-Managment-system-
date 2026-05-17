
import React, { useState, useRef } from 'react';
import { CameraIcon } from './icons/CameraIcon';
import CameraModal from './CameraModal';

// Dummy SignaturePad component for demonstration
const SignaturePad: React.FC<{ onSave: (dataUrl: string) => void }> = ({ onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const clear = () => {
        const canvas = canvasRef.current;
        if(canvas){
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    const save = () => {
        const canvas = canvasRef.current;
        if(canvas){
            onSave(canvas.toDataURL());
        }
    }
    return (
        <div>
            <canvas ref={canvasRef} className="w-full h-48 bg-gray-200 rounded-lg" />
            <div className="flex justify-between mt-2">
                <button type="button" onClick={clear} className="text-sm bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Clear</button>
                <button type="button" onClick={save} className="text-sm bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Save Signature</button>
            </div>
        </div>
    );
};


const SupplierPODUploadView = () => {
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [podFile, setPodFile] = useState<File | null>(null);
    const [signature, setSignature] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setPodFile(e.target.files[0]);
        }
    };

    const handlePhotoCapture = (dataUrl: string) => {
        // Convert data URL to File object
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], "pod_capture.jpg", { type: "image/jpeg" });
                setPodFile(file);
            });
        setIsCameraOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!podFile || !signature) {
            alert("Please upload the POD document and capture the recipient's signature.");
            return;
        }
        // In a real app, you would upload the file and signature data
        console.log("Submitting POD:", { podFile, signature });
        setIsSubmitted(true);
    };

    if (isSubmitted) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <div className="text-center p-8">
                    <h1 className="text-3xl font-bold text-green-400">Thank You!</h1>
                    <p className="text-gray-300 mt-2">The Proof of Delivery has been submitted successfully.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-2xl p-8 space-y-6 bg-gray-800 rounded-lg shadow-2xl">
                <h1 className="text-3xl font-bold text-white text-center">Submit Proof of Delivery</h1>
                <p className="text-center text-gray-400">For Load Confirmation #LCN-12345</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">1. Upload Signed POD Document</label>
                        <div className="flex items-center space-x-2">
                             <input type="file" onChange={handleFileChange} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-white"/>
                             <button type="button" onClick={() => setIsCameraOpen(true)} className="p-3 bg-blue-600 rounded-md text-white"><CameraIcon className="h-5 w-5"/></button>
                        </div>
                        {podFile && <p className="text-green-400 text-sm mt-2">File selected: {podFile.name}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">2. Recipient Signature</label>
                        <SignaturePad onSave={setSignature} />
                        {signature && <p className="text-green-400 text-sm mt-2">Signature captured!</p>}
                    </div>
                    <div>
                        <button type="submit" className="w-full flex justify-center py-3 px-4 rounded-md text-white bg-brand-primary hover:bg-brand-secondary">Submit POD</button>
                    </div>
                </form>
            </div>
            {isCameraOpen && <CameraModal onCapture={handlePhotoCapture} onCancel={() => setIsCameraOpen(false)} />}
        </div>
    );
};

export default SupplierPODUploadView;
