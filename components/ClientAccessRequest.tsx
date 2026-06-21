import React, { useState, useRef } from 'react';
import { invokeFn } from '../lib/supabase';

// Public page where a prospective client requests portal login credentials.
// Clients are set up by FBN (not self-serve), so this just notifies the team
// (emails info@fbn-transport.co.za via the client-access-request edge function).
const FbnLogo: React.FC = () => (
    <img
        src="/fbn-logo.jpg"
        alt="FBN Transport"
        onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith('.svg')) t.src = '/fbn-logo.svg'; }}
        className="h-16 w-auto mx-auto object-contain"
    />
);

const inputCls = "w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary";

const ClientAccessRequest: React.FC = () => {
    const [company, setCompany] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [website, setWebsite] = useState(''); // honeypot
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const startedAt = useRef(Date.now());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!company.trim() || !contact.trim() || !email.trim()) { setError('Please fill in your company, name and email.'); return; }
        setSubmitting(true);
        const { data, error: err } = await invokeFn('client-access-request', {
            body: {
                company: company.trim(), contact_person: contact.trim(), email: email.trim(),
                phone: phone.trim(), message: message.trim(),
                website, elapsed_ms: Date.now() - startedAt.current,
            },
        });
        setSubmitting(false);
        if (err || (data && (data as any).error)) { setError((data as any)?.error || err?.message || 'Could not send your request. Please try again.'); return; }
        setDone(true);
    };

    if (done) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
                <div className="w-full max-w-sm p-8 space-y-5 bg-gray-800 rounded-lg shadow-2xl text-center">
                    <FbnLogo />
                    <h1 className="text-2xl font-bold text-white">Request sent ✓</h1>
                    <p className="text-gray-400 text-sm leading-relaxed">Thanks — our team will set up your portal access and email your login details shortly.</p>
                    <a href="/?portal=client" className="inline-block mt-2 bg-brand-primary hover:bg-brand-secondary btn-on-color text-white font-bold py-3 px-8 rounded-lg text-sm">Back to Client Login</a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-gray-800 rounded-lg shadow-2xl">
                <div className="text-center">
                    <FbnLogo />
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Request Portal Access</h1>
                    <p className="mt-2 text-gray-400 text-sm">Tell us a little about you and we'll set up your client login.</p>
                </div>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Company *</label>
                        <input value={company} onChange={(e) => setCompany(e.target.value)} required className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Contact name *</label>
                        <input value={contact} onChange={(e) => setContact(e.target.value)} required className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Message (optional)</label>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={inputCls} />
                    </div>
                    {/* Honeypot — hidden from real users, catches bots. */}
                    <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <button type="submit" disabled={submitting} className="btn-on-color w-full flex justify-center py-3 px-4 rounded-md text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                        {submitting ? 'Sending…' : 'Send Request'}
                    </button>
                </form>
                <div className="text-center text-sm space-y-1">
                    <a href="/?portal=client" className="block font-medium text-brand-secondary hover:text-blue-400">← Back to Client Login</a>
                </div>
            </div>
        </div>
    );
};

export default ClientAccessRequest;
