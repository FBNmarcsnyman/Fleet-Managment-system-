import React, { useState } from 'react';
import { useAuth } from '../contexts/AppContexts';
import type { LoginResult } from '../contexts/AuthContext';
import { FuelIcon } from './icons/FuelIcon';

const SupplierLogin: React.FC = () => {
    const { handleLogin, resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);
        setSubmitting(true);
        const result: LoginResult = await handleLogin(email, password);
        if (result.ok) return;
        setError((result as Extract<LoginResult, { ok: false }>).error);
        setSubmitting(false);
    };

    const handleForgot = async (e: React.MouseEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);
        if (!email) {
            setError('Enter your email above first.');
            return;
        }
        const result: LoginResult = await resetPassword(email);
        if (result.ok) {
            setInfo('Password reset email sent. Check your inbox.');
            return;
        }
        setError((result as Extract<LoginResult, { ok: false }>).error);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <div className="w-full max-w-sm p-8 space-y-8 bg-gray-800 rounded-lg shadow-2xl">
                <div className="text-center">
                    <FuelIcon className="w-16 h-16 mx-auto text-brand-secondary" />
                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
                        Supplier Portal
                    </h1>
                    <p className="mt-2 text-gray-400">Please sign in to view your loads.</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                        />
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {info && <p className="text-sm text-green-400">{info}</p>}
                    <div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full flex justify-center py-3 px-4 rounded-md text-white bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Signing in…' : 'Sign In'}
                        </button>
                    </div>
                    <div className="text-center text-sm">
                        <a href="#" onClick={handleForgot} className="font-medium text-brand-secondary hover:text-blue-400">
                            Forgot password?
                        </a>
                    </div>
                </form>
                <div className="text-center text-sm border-t border-gray-700 pt-4">
                    <p className="text-gray-400 mb-1">New carrier?</p>
                    <a href="/?portal=become-supplier" className="font-bold text-brand-secondary hover:text-blue-400">
                        Become a Supplier — register here →
                    </a>
                </div>
                <div className="text-center text-sm">
                    <a href="/" className="font-medium text-brand-secondary hover:text-blue-400">
                        ← Back to portals
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SupplierLogin;
