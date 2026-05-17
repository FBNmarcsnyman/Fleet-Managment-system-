
import React from 'react';
import { LoadConfirmation, Client, Supplier } from '../../types';
import { MailIcon } from '../icons/MailIcon';
import { ChatBubbleIcon } from '../icons/ChatBubbleIcon';

interface CommunicationHubModalProps {
    load: LoadConfirmation;
    client: Client;
    supplier?: Supplier;
    onClose: () => void;
}

const CommunicationHubModal: React.FC<CommunicationHubModalProps> = ({ load, client, supplier, onClose }) => {
    
    const sendWhatsApp = (number: string, message: string) => {
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/${number.replace(/\s/g, '')}?text=${encoded}`, '_blank');
    };

    const sendEmail = (email: string, subject: string, body: string) => {
        window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    };

    const clientUpdateMsg = `Hi ${client.contactPerson}, this is an update regarding your shipment ${load.loadConNumber} (${load.collectionPoint} to ${load.deliveryPoint}). Current status: ${load.status}. Regards, FBN Fleet Team.`;
    const supplierRequestMsg = `Hi ${supplier?.contactPerson}, please can we have a progress update on Load ${load.loadConNumber}? Collection: ${load.collectionPoint}. Regards, FBN Ops.`;

    const cardClasses = "bg-gray-900/60 p-4 rounded-xl border border-gray-700/50 space-y-4";
    const btnClasses = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95";

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-white">Communication Hub</h2>
                <p className="text-gray-500 text-sm font-mono tracking-tighter uppercase">{load.loadConNumber} Coordination</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Update Section */}
                <div className={cardClasses}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">Update Client</h3>
                        <span className="text-[10px] text-gray-500 font-mono">{client.contactPhone}</span>
                    </div>
                    <p className="text-sm text-gray-300 font-medium">Notify <span className="text-white font-bold">{client.name}</span> of shipment progress.</p>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => sendWhatsApp(client.contactPhone, clientUpdateMsg)}
                            className={`${btnClasses} bg-[#25D366] text-white hover:bg-[#128C7E]`}
                        >
                            <ChatBubbleIcon className="h-4 w-4" /> WhatsApp Client
                        </button>
                        <button 
                            onClick={() => sendEmail(client.contactEmail, `Update: Shipment ${load.loadConNumber}`, clientUpdateMsg)}
                            className={`${btnClasses} bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-500`}
                        >
                            <MailIcon className="h-4 w-4" /> Email Client
                        </button>
                    </div>
                </div>

                {/* Supplier Request Section */}
                {supplier ? (
                    <div className={cardClasses}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest">Update Carrier</h3>
                            <span className="text-[10px] text-gray-500 font-mono">{supplier.contactPhone}</span>
                        </div>
                        <p className="text-sm text-gray-300 font-medium">Request progress from <span className="text-white font-bold">{supplier.name}</span>.</p>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={() => sendWhatsApp(supplier.contactPhone, supplierRequestMsg)}
                                className={`${btnClasses} bg-[#25D366] text-white hover:bg-[#128C7E]`}
                            >
                                <ChatBubbleIcon className="h-4 w-4" /> WhatsApp Carrier
                            </button>
                            <button 
                                onClick={() => sendEmail(supplier.contactEmail, `Progress Request: Load ${load.loadConNumber}`, supplierRequestMsg)}
                                className={`${btnClasses} bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-500`}
                            >
                                <MailIcon className="h-4 w-4" /> Email Carrier
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-800/20 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center p-8">
                        <p className="text-xs text-gray-600 font-bold uppercase tracking-widest text-center italic">No carrier assigned<br/>to this load yet.</p>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-gray-700 flex justify-end">
                <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-white uppercase tracking-widest">Close Hub</button>
            </div>
        </div>
    );
};

export default CommunicationHubModal;
