import React, { useState, useRef, useEffect } from 'react';
import { LoadConfirmation, PodAnalysisResult, Attachment } from '../types';
import CameraModal from './CameraModal';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { SparklesIcon } from './icons/SparklesIcon';
import { UploadIcon } from './icons/UploadIcon';
import { invokeFn } from '../lib/supabase';
import { useOperations } from '../contexts/AppContexts';
import { compressImage } from '../lib/imageCompress';

// SignaturePad component embedded for simplicity
const SignaturePad: React.FC<{ onSave: (dataUrl: string) => void }> = ({ onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const resizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            ctx.scale(ratio, ratio);
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        return () => window.removeEventListener('resize', resizeCanvas);

    }, []);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e.nativeEvent) {
            return { x: e.nativeEvent.touches[0].clientX - rect.left, y: e.nativeEvent.touches[0].clientY - rect.top };
        }
        return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    }

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.closePath();
        setIsDrawing(false);
    };
    
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    
    const handleSave = () => {
        const canvas = canvasRef.current;
        if (canvas) onSave(canvas.toDataURL('image/png'));
    }

    return (
        <div className="w-full">
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-48 bg-gray-700 rounded-lg cursor-crosshair"
            />
            <div className="flex justify-between mt-2">
                <button type="button" onClick={clearCanvas} className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Clear</button>
                <button type="button" onClick={handleSave} className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save Signature</button>
            </div>
        </div>
    );
};


interface DriverPODModalProps {
    loadCon: LoadConfirmation;
    isManualUpload?: boolean;
    // Optional — persistence now happens inside the modal via submit-pod. Kept so existing
    // callers don't break; called (if provided) after a successful upload for any extra refresh.
    onSubmit?: (loadConId: string, podData: {
        photo: Attachment,
        signature: string,
        analysisResult?: PodAnalysisResult
    }) => void;
    onCancel: () => void;
}

const DriverPODModal: React.FC<DriverPODModalProps> = ({ loadCon, isManualUpload = false, onCancel }) => {
    const [step, setStep] = useState<'photo' | 'signature' | 'analyzing' | 'confirm'>('photo');
    const [photo, setPhoto] = useState<Attachment | null>(null);
    const [signature, setSignature] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<PodAnalysisResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const { handleUpdateLoadConfirmation } = useOperations() as any;

    const handlePhotoCapture = async (dataUrl: string) => {
        const isPdf = dataUrl.startsWith('data:application/pdf');
        // Downsize images before upload (camera photos are huge); leave PDFs as-is.
        let finalUrl = dataUrl, type = 'image/jpeg', ext = 'jpg';
        if (isPdf) { type = 'application/pdf'; ext = 'pdf'; }
        else { const c = await compressImage(dataUrl); finalUrl = c.dataUrl; type = c.type || 'image/jpeg'; }
        const captured: Attachment = { name: `POD_${loadCon.loadConNumber}.${ext}`, type, data: finalUrl };
        setPhoto(captured);
        setIsCameraOpen(false);
        // A MANUAL upload is an already-signed POD document — don't force a fresh signature.
        // A PDF can't be AI-analysed as an image, so go straight to confirm.
        if (isManualUpload) { if (isPdf) setStep('confirm'); else handleAnalyzePOD(captured, ''); }
        else setStep('signature');
    };
    
    const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                handlePhotoCapture(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyzePOD = async (podPhoto: {data: string}, podSignature: string) => {
        setStep('analyzing');
        setAnalysisError(null);

        if (!process.env.API_KEY) {
            console.warn("AI analysis skipped: API key not configured.");
            setStep('confirm');
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const podPhotoPart = { inlineData: { mimeType: 'image/jpeg', data: podPhoto.data.split(',')[1] } };
            // Signature is optional (manual uploads have no separate signature capture).
            const signaturePart = podSignature ? { inlineData: { mimeType: 'image/png', data: podSignature.split(',')[1] } } : null;
            const prompt = `You are an expert logistics document analyst. Your task is to analyze two images: a Proof of Delivery (POD) document and a captured signature.

Image 1: Proof of Delivery (POD) Document
Image 2: Captured Signature

Please perform the following analysis and return the results in a strict JSON format:

1.  **Recipient Name Extraction (from Image 1):**
    *   Carefully scan the POD document for a field labeled "Received by", "Recipient Name", "Print Name", or similar.
    *   Extract the printed name from this field.
    *   If no printed name is found, attempt to legibly read any handwritten name near the signature block. Prioritize printed text.
    *   If no name can be confidently identified, return "Not Found".

2.  **Document Issue Detection (from Image 1):**
    *   Thoroughly inspect the entire document for any anomalies or signs of a non-standard delivery.
    *   Specifically look for:
        *   Handwritten keywords indicating problems: "damaged", "short", "missing", "leaking", "crushed", "broken", "rejected", "tampered".
        *   Unfilled or empty critical fields such as "Date", "Time", or "Quantity Received".
        *   Any other notes that suggest the delivery was not perfect.
    *   Summarize any findings concisely. If no issues are found, return "None found".

3.  **Signature Verification (from Image 2):**
    *   Analyze the signature image to confirm the presence of a valid signature.
    *   A valid signature is a deliberate, non-trivial mark. A simple line, dot, or accidental smudge does not count.
    *   Determine if a signature is present.

Return a JSON object with the following structure:
- "recipientName": The extracted name or "Not Found".
- "documentIssues": A summary of issues or "None found".
- "isSignaturePresent": A boolean (true/false).`;

            // Fix: Changed model to 'gemini-3-pro-preview' for complex multimodal analysis
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ text: prompt }, podPhotoPart, ...(signaturePart ? [signaturePart] : [])] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            recipientName: { type: Type.STRING },
                            documentIssues: { type: Type.STRING },
                            isSignaturePresent: { type: Type.BOOLEAN },
                        },
                        required: ['recipientName', 'documentIssues', 'isSignaturePresent']
                    }
                }
            });

            const text = response.text;
            const result = JSON.parse(text ? text.trim() : '{}');
            setAnalysisResult(result);
        } catch (err) {
            console.error("AI POD analysis failed:", err);
            setAnalysisError("AI analysis failed. Please review the POD manually.");
        } finally {
            setStep('confirm');
        }
    };

    const handleSignatureSave = (dataUrl: string) => {
        setSignature(dataUrl);
        if (photo) {
            handleAnalyzePOD(photo, dataUrl);
        } else {
            setStep('confirm'); // Fallback
        }
    };

    // Submit through the submit-pod edge function — the SAME path as the public upload
    // link: it stores the file to Storage + files it into the load's Drive folder, sets
    // pod_photo_url/pod_drive_url + status 'POD Submitted', and holds it for authorisation
    // (loadcons@ emailed). We no longer write the giant base64 image into the DB (that was
    // the hang). Signature is OPTIONAL. See pod-authorisation-workflow.
    const handleSubmit = async () => {
        if (!photo || submitting) return;
        setSubmitting(true); setSubmitError(null);
        try {
            const fileBase64 = (photo.data || '').split(',')[1] || '';
            const signatureBase64 = signature ? (signature.split(',')[1] || '') : '';
            const { data, error } = await invokeFn('submit-pod', {
                body: { loadId: loadCon.id, fileBase64, fileName: photo.name, contentType: photo.type || 'image/jpeg', signatureBase64 },
            });
            if (error || (data as any)?.error) { setSubmitError(`Upload failed: ${(data as any)?.error || error?.message || 'unknown error'}`); return; }
            // Reflect it locally (status only — no base64) so the board updates immediately.
            // NB: we deliberately do NOT call the caller's onSubmit — the legacy callers
            // wrote the whole base64 image into the DB, which is exactly what hung. submit-pod
            // owns persistence now. onSubmit is kept optional only for backward compatibility.
            try { await handleUpdateLoadConfirmation?.(loadCon.id, { status: 'POD Submitted', paymentStatus: 'Awaiting POD' }); } catch { /* non-blocking */ }
            onCancel(); // close the modal
        } catch (e) {
            setSubmitError(`Upload failed: ${e instanceof Error ? e.message : 'error'}`);
        } finally {
            setSubmitting(false);
        }
    };
    
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white">Proof of Delivery</h2>
            <p className="text-gray-400 mb-6">Load Con: <strong className="font-mono">{loadCon.loadConNumber}</strong></p>
            
            {step === 'photo' && (
                <div className="text-center">
                    <p className="mb-4">{isManualUpload ? 'Please upload the signed POD document.' : 'Please take a clear photo of the signed POD document.'}</p>
                    {isManualUpload ? (
                         <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-700 rounded-md border-2 border-dashed border-gray-500 cursor-pointer hover:border-brand-secondary">
                            <UploadIcon className="h-6 w-6 text-gray-400 mr-2" />
                            <span className="text-gray-400">Click to upload file</span>
                            <input type="file" onChange={handleManualUpload} className="hidden" accept="image/*,.pdf" />
                        </label>
                    ) : (
                        <button onClick={() => setIsCameraOpen(true)} className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-lg">Take Photo</button>
                    )}
                </div>
            )}

            {step === 'signature' && (
                <div>
                     <p className="mb-2">Please ask the recipient to sign below — or skip if the uploaded POD is already signed.</p>
                     <SignaturePad onSave={handleSignatureSave} />
                     <button type="button" onClick={() => photo ? handleAnalyzePOD(photo, '') : setStep('confirm')} className="mt-2 text-sm text-gray-400 hover:text-white underline">Skip — POD already signed</button>
                </div>
            )}

            {step === 'analyzing' && (
                <div className="text-center py-10">
                    <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 font-semibold text-purple-300">Analyzing POD with AI...</p>
                    <p className="text-sm text-gray-400">Please wait a moment.</p>
                </div>
            )}

            {step === 'confirm' && (
                <div className="space-y-4">
                    <p className="font-semibold">Please confirm the details below before submitting.</p>
                    {photo && (
                        <div className="flex items-center text-green-400"><PaperClipIcon className="h-4 w-4 mr-2"/> POD Photo captured.</div>
                    )}
                    {signature && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-300">Signature:</h4>
                            <div className="bg-gray-100 p-2 rounded-lg mt-1">
                                <img src={signature} alt="Signature" className="w-full h-auto" />
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-900/50 p-3 rounded-lg space-y-2">
                        <h4 className="font-semibold text-white flex items-center"><SparklesIcon className="h-5 w-5 mr-2 text-purple-400"/> AI Analysis</h4>
                        {analysisError && <p className="text-red-400 text-sm">{analysisError}</p>}
                        {analysisResult ? (
                            <div className="text-sm space-y-1 text-gray-300">
                                <p><strong>Signature Present:</strong> <span className={analysisResult.isSignaturePresent ? 'text-green-400' : 'text-red-400'}>{analysisResult.isSignaturePresent ? 'Yes' : 'No'}</span></p>
                                <p><strong>Recipient Name:</strong> {analysisResult.recipientName && analysisResult.recipientName !== 'Not Found' ? analysisResult.recipientName : <span className="text-gray-500">Not found</span>}</p>
                                <p><strong>Document Issues:</strong> {analysisResult.documentIssues && analysisResult.documentIssues !== 'None found' ? <span className="text-yellow-400">{analysisResult.documentIssues}</span> : <span className="text-gray-500">None found</span>}</p>
                            </div>
                        ) : !analysisError && <p className="text-sm text-gray-500">AI analysis was not performed.</p>}
                    </div>

                    {submitError && <p className="text-red-400 text-sm font-semibold">{submitError}</p>}
                    <button onClick={handleSubmit} disabled={submitting || !photo} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg">{submitting ? 'Uploading POD…' : 'Confirm & Submit POD'}</button>
                    <p className="text-[11px] text-gray-500 text-center">Stored to the load's Drive folder and held for authorisation before it reaches the client.</p>
                </div>
            )}
            
            <div className="mt-6 text-right">
                 <button onClick={onCancel} className="text-sm text-gray-400 hover:text-white">Cancel</button>
            </div>

            {isCameraOpen && <CameraModal onCapture={handlePhotoCapture} onCancel={() => setIsCameraOpen(false)} />}
        </div>
    );
};

export default DriverPODModal;