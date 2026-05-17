
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MicrophoneIcon } from './icons/MicrophoneIcon';
import { XIcon } from './icons/XIcon';

interface LiveAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

// --- Audio Encoding/Decoding Helpers ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const LiveAssistant: React.FC<LiveAssistantProps> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR'>('IDLE');
    const [error, setError] = useState<string | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextsRef = useRef<{ input: AudioContext | null, output: AudioContext | null, scriptProcessor: ScriptProcessorNode | null }>({ input: null, output: null, scriptProcessor: null });
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);

    useEffect(() => {
        if (isOpen) {
            startSession();
        } else {
            closeSession();
        }

        return () => {
            closeSession();
        };
    }, [isOpen]);

    const closeSession = () => {
        setStatus('IDLE');
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
        
        audioContextsRef.current.scriptProcessor?.disconnect();
        audioContextsRef.current.input?.close();
        audioContextsRef.current.output?.close();
        audioContextsRef.current = { input: null, output: null, scriptProcessor: null };

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    };

    const startSession = async () => {
        setStatus('CONNECTING');
        setError(null);
        if (!process.env.API_KEY) {
            setError("Live Assistant is not available. API key is missing.");
            setStatus('ERROR');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            sessionPromiseRef.current = ai.live.connect({
                // Fix: Updated model name to match allowed models in guidelines
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('LISTENING');
                        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        audioContextsRef.current.input = inputAudioContext;
                        audioContextsRef.current.output = outputAudioContext;

                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        audioContextsRef.current.scriptProcessor = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64EncodedAudioString) {
                            setStatus('SPEAKING');
                            const outputAudioContext = audioContextsRef.current.output;
                            if (!outputAudioContext) return;
                            
                            const audioData = decode(base64EncodedAudioString);
                            const audioBuffer = await decodeAudioData(audioData, outputAudioContext, 24000, 1);
                            
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);

                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                                if (audioSourcesRef.current.size === 0) {
                                    setStatus('LISTENING');
                                }
                            });
                            
                            const currentTime = outputAudioContext.currentTime;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        setError(`Session error: ${e.message}`);
                        setStatus('ERROR');
                        console.error('Live session error:', e);
                    },
                    onclose: () => {
                        // Handled by the main closeSession function
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'You are a helpful assistant for a truck driver. Keep your answers concise and clear. The driver may need to report issues with their vehicle.',
                },
            });
        } catch (err) {
            setError(`Failed to start session. Please ensure microphone access is granted. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setStatus('ERROR');
            console.error(err);
        }
    };

    const getStatusIndicator = () => {
        switch (status) {
            case 'LISTENING':
                return <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />;
            case 'SPEAKING':
                return <div className="w-4 h-4 rounded-full bg-green-500" />;
            case 'CONNECTING':
                return <div className="w-4 h-4 rounded-full bg-yellow-500" />;
            case 'ERROR':
                return <div className="w-4 h-4 rounded-full bg-red-500" />;
            default:
                return <div className="w-4 h-4 rounded-full bg-gray-500" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/90 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <div className="text-center">
                <MicrophoneIcon className="h-24 w-24 text-white mx-auto animate-pulse" />
                <h2 className="text-3xl font-bold text-white mt-4">Live Assistant Active</h2>
                <div className="flex items-center justify-center space-x-2 mt-2">
                    {getStatusIndicator()}
                    <p className="text-gray-300">{status}</p>
                </div>

                {error && <p className="mt-4 text-red-400 bg-red-900/50 p-3 rounded-lg max-w-md">{error}</p>}
                
                <p className="text-gray-400 mt-6 max-w-md">You can now speak to report issues. For example: "I have a flat tire on the front left," or "Report a minor accident at my current location."</p>
            </div>
            <button onClick={onClose} className="absolute bottom-10 flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full">
                <XIcon className="h-6 w-6 mr-2" /> End Session
            </button>
        </div>
    );
};

export default LiveAssistant;
