
import React, { useRef, useEffect } from 'react';

interface CameraModalProps {
    onCapture: (dataUrl: string) => void;
    onCancel: () => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                alert("Camera functionality is not supported by your browser.");
                onCancel();
                return;
            }

            try {
                // Attempt 1: Try for the rear camera (ideal for mobile)
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            } catch (err) {
                console.warn("Rear camera not found or access denied, trying any available camera.", err);
                try {
                    // Attempt 2: Fallback to any available camera (for laptops, etc.)
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                } catch (fallbackErr) {
                    console.error("Could not access any camera.", fallbackErr);
                    let message = 'Could not access the camera. Please ensure you have a working camera and have granted permission in your browser settings.';
                    if (fallbackErr instanceof Error) {
                        message = `Error accessing camera: ${fallbackErr.name}: ${fallbackErr.message}`;
                    }
                    alert(message);
                    onCancel();
                    return; // Exit if all attempts fail
                }
            }

            if (videoRef.current && stream) {
                videoRef.current.srcObject = stream;
            } else {
                alert("Failed to initialize camera stream.");
                onCancel();
            }
        };

        startCamera();

        return () => {
            // Cleanup: stop all tracks of the stream when the component unmounts
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [onCancel]);


    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                onCapture(canvas.toDataURL('image/jpeg'));
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60]">
            <div className="bg-gray-800 p-4 rounded-lg flex flex-col items-center w-full max-w-2xl m-4">
                <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded aspect-video"></video>
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                <div className="flex space-x-4 mt-4">
                    <button onClick={handleCapture} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Capture Photo</button>
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default CameraModal;