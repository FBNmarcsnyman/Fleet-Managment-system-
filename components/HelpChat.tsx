import React, { useState, useRef, useEffect } from 'react';
import { askHelp, HelpMessage } from '../lib/helpFaq';
import { BRAND, FONTS } from '../lib/brand';
import { XIcon } from './icons/XIcon';

// Suggested questions grouped by topic, shown until the first message.
const TOPICS: { label: string; questions: string[] }[] = [
    { label: 'Quotes', questions: ['How do I price an inbound quote?', 'How do I send a COD client a proforma?'] },
    { label: 'Loads', questions: ['How does a quote become a collection?', 'How do I raise an RFQ to carriers?'] },
    { label: 'Email & setup', questions: ['Why didn’t my email arrive?', 'How do I onboard a new subcontractor?'] },
];

// Floating "Help" assistant — a text chatbot grounded on the FBN FAQ. Available
// app-wide for the team. Uses Gemini (same key as document scanning).
const HelpChat: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<HelpMessage[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, busy, open]);

    const send = async (q?: string) => {
        const question = (q ?? input).trim();
        if (!question || busy) return;
        setInput('');
        const history = messages;
        setMessages(prev => [...prev, { role: 'user', text: question }]);
        setBusy(true);
        try {
            const answer = await askHelp(question, history);
            setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'assistant', text: e?.message || 'Sorry, something went wrong. Please try again.' }]);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {/* Launcher */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed right-4 bottom-36 md:bottom-24 z-30 flex items-center gap-2 bg-white border border-slate-300 text-[#13294b] hover:bg-slate-50 font-bold py-2.5 px-4 rounded-full shadow-lg transition active:scale-95"
                    title="Ask the help assistant"
                >
                    <span className="text-lg leading-none">💬</span>
                    <span className="hidden sm:inline text-sm">Help</span>
                </button>
            )}

            {/* Panel */}
            {open && (
                <div className="fixed bottom-5 right-5 z-[90] w-[min(94vw,400px)] h-[min(80vh,580px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
                    <div className="px-4 py-3 flex items-start justify-between" style={{ background: BRAND.navy }}>
                        <div>
                            <div className="text-lg font-black tracking-wide" style={{ fontFamily: FONTS.heading }}>
                                <span className="text-white">FAQ</span> <span style={{ color: BRAND.gold }}>CENTRE</span>
                            </div>
                            <div className="text-[11px] text-slate-300 -mt-0.5">FBN Control Centre · ask how anything works</div>
                        </div>
                        <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white mt-0.5"><XIcon className="h-5 w-5" /></button>
                    </div>
                    <div style={{ height: 3, background: BRAND.gold }} />

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                        {messages.length === 0 && (
                            <div className="text-sm text-slate-500">
                                <p className="mb-3">Hi 👋 Pick a topic below, or type your own question about anything in the Control Centre.</p>
                                <div className="space-y-3">
                                    {TOPICS.map(t => (
                                        <div key={t.label}>
                                            <div className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: BRAND.navy }}>{t.label}</div>
                                            <div className="flex flex-col gap-1.5">
                                                {t.questions.map(s => (
                                                    <button key={s} onClick={() => send(s)} className="text-left text-[13px] bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-blue-300 hover:bg-blue-50 text-slate-700 transition">
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {busy && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 text-[13px] text-slate-400">Thinking…</div>
                            </div>
                        )}
                    </div>

                    <div className="p-2.5 border-t border-slate-200 bg-white">
                        <div className="flex items-end gap-2">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                                rows={1}
                                placeholder="Type your question…"
                                className="flex-1 resize-none border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-28"
                            />
                            <button onClick={() => send()} disabled={busy || !input.trim()} className="bg-[#13294b] hover:bg-[#1d3a66] disabled:opacity-40 text-white font-bold rounded-xl px-4 py-2 text-sm">Send</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default HelpChat;
