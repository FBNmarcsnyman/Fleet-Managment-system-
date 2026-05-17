import React, { useState, useRef, useEffect } from 'react';
import { Message, User } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ChatBubbleIcon } from './icons/ChatBubbleIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import Modal from './Modal';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

interface VehicleChatProps {
    messages: Message[];
    currentUser: User;
    onSendMessage: (text: string) => void;
}

const VehicleChat: React.FC<VehicleChatProps> = ({ messages, currentUser, onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ isIssue: boolean; title: string; notes: string; } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzedMessage, setAnalyzedMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage);
            setNewMessage('');
        }
    };
    
    const handleAnalyzeMessage = async (messageText: string) => {
        setAnalyzedMessage(messageText);
        setIsAnalysisModalOpen(true);
        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            if (!process.env.API_KEY) throw new Error("API key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const prompt = `
                Analyze the following driver message to determine if it describes a vehicle maintenance issue.
                Message: "${messageText}"

                If it is a maintenance issue, respond with a JSON object containing:
                - "isIssue": true
                - "title": A concise job card title (e.g., "Grinding noise from front left wheel").
                - "notes": The original driver message.

                If it is NOT a maintenance issue, respond with a JSON object containing:
                - "isIssue": false
                - "title": ""
                - "notes": ""
            `;

            // Fix: Changed model to 'gemini-3-flash-preview' for basic text classification task
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            isIssue: { type: Type.BOOLEAN },
                            title: { type: Type.STRING },
                            notes: { type: Type.STRING },
                        }
                    }
                }
            });

            const text = response.text;
            const result = JSON.parse(typeof text === 'string' ? text.trim() : '{}');
            setAnalysisResult(result);
        } catch (error) {
            console.error(error);
            setAnalysisResult({ isIssue: false, title: "Analysis Failed", notes: "Could not analyze the message." });
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <>
            <div className="flex flex-col h-full">
                <div className="flex items-center mb-4">
                    <ChatBubbleIcon className="h-6 w-6 mr-3 text-blue-400" />
                    <h3 className="text-xl font-semibold text-white">Communication Log</h3>
                </div>
                <div className="flex-grow bg-gray-900/50 rounded-lg p-4 overflow-y-auto space-y-4">
                    {messages.length > 0 ? (
                        messages.map(msg => {
                            const isCurrentUser = msg.userId === currentUser.email;
                            return (
                                <div key={msg.id} className={`flex items-end space-x-2 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                                     {!isCurrentUser && (
                                        <button 
                                            onClick={() => handleAnalyzeMessage(msg.text)} 
                                            className="p-1 text-gray-400 hover:text-purple-400" 
                                            title="Analyze for issues"
                                        >
                                            <SparklesIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                    <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${isCurrentUser ? 'bg-brand-primary text-white' : 'bg-gray-700 text-gray-200'}`}>
                                            <p className="text-sm">{msg.text}</p>
                                        </div>
                                        <div className={`text-xs text-gray-500 mt-1 px-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                                            <strong>{isCurrentUser ? 'You' : msg.userName}</strong> - {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">No messages yet. Start the conversation!</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="mt-4 flex items-center space-x-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-grow bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                    />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg transition duration-300">
                        Send
                    </button>
                </form>
            </div>
            
            <Modal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)}>
                <div>
                    <h2 className="text-2xl font-bold mb-4 text-white">AI Message Analysis</h2>
                    <p className="text-sm text-gray-400 mb-2">Original Message:</p>
                    <p className="italic bg-gray-900/50 p-3 rounded-md text-gray-300 mb-4">"{analyzedMessage}"</p>
                    
                    {isAnalyzing ? (
                        <p className="text-yellow-400 animate-pulse">Analyzing...</p>
                    ) : analysisResult ? (
                        analysisResult.isIssue ? (
                            <div className="space-y-3">
                                <p className="text-green-400 font-semibold">Maintenance issue detected!</p>
                                <h3 className="text-lg text-white">Suggested Job Card:</h3>
                                <p><strong className="text-gray-400">Title:</strong> {analysisResult.title}</p>
                                <p><strong className="text-gray-400">Notes:</strong> {analysisResult.notes}</p>
                                <button className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg mt-2" onClick={() => alert("Creating job card...")}>Create Job Card</button>
                            </div>
                        ) : (
                            <p className="text-gray-300">{analysisResult.title || "No maintenance issue detected in this message."}</p>
                        )
                    ) : null}
                </div>
            </Modal>
        </>
    );
};

export default VehicleChat;