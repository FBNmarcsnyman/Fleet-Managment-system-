
import React, { useState } from 'react';
import { useAuth } from '../contexts/AppContexts';
import type { LoginResult } from '../contexts/AuthContext';

// Brand logo — falls back from the JPG to the SVG if the JPG ever fails to load.
const FbnLogo: React.FC = () => (
    <img
        src="/fbn-logo.jpg"
        alt="FBN Transport"
        onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith('.svg')) t.src = '/fbn-logo.svg'; }}
        className="h-16 w-auto mx-auto object-contain"
    />
);

const Login: React.FC = () => {
    const { handleLogin, signInWithGoogle, resetPassword } = useAuth();
    // Landing picker: choose a portal first. 'fbn' reveals the staff sign-in form;
    // Client/Supplier navigate to their own login pages.
    const [mode, setMode] = useState<'select' | 'fbn'>('select');
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
        if (result.ok) {
            // AuthContext updates currentUser; App.tsx re-renders and unmounts Login.
            return;
        }
        // Project tsconfig lacks `"strict": true`, so TS doesn't narrow the
        // discriminated union after `if (result.ok)`. Cast explicitly.
        setError((result as Extract<LoginResult, { ok: false }>).error);
        setSubmitting(false);
    };

    const handleGoogle = async () => {
        setError(null);
        setInfo(null);
        setSubmitting(true);
        const result = await signInWithGoogle();
        // On success the browser redirects to Google; if it returns an error we
        // re-enable the form.
        if (!result.ok) {
            setError((result as Extract<LoginResult, { ok: false }>).error);
            setSubmitting(false);
        }
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

    if (mode === 'select') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
                <div className="w-full max-w-sm p-8 space-y-8 bg-gray-800 rounded-lg shadow-2xl">
                    <div className="text-center">
                        <FbnLogo />
                        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
                            Control Centre
                        </h1>
                        <p className="mt-2 text-gray-400">Choose your portal to continue</p>
                    </div>
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => { setError(null); setInfo(null); setMode('fbn'); }}
                            className="btn-on-color w-full py-3.5 px-4 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-sm transition hover:brightness-110 active:scale-[0.98] bg-[#13294b]"
                        >
                            FBN Login
                        </button>
                        <a
                            href="/?portal=client"
                            className="btn-on-color block w-full py-3.5 px-4 rounded-lg text-white font-bold text-sm uppercase tracking-wide text-center shadow-sm transition hover:brightness-110 active:scale-[0.98] bg-blue-600"
                        >
                            Client Login
                        </a>
                        <a
                            href="/?portal=supplier"
                            className="btn-on-color block w-full py-3.5 px-4 rounded-lg text-white font-bold text-sm uppercase tracking-wide text-center shadow-sm transition hover:brightness-110 active:scale-[0.98] bg-emerald-600"
                        >
                            Supplier Login
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
            <div className="w-full max-w-sm p-8 space-y-8 bg-gray-800 rounded-lg shadow-2xl">
                <div className="text-center">
                    <FbnLogo />
                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
                        Control Centre
                    </h1>
                    <p className="mt-2 text-gray-400">FBN staff sign-in</p>
                </div>
                <div className="mt-8">
                    <button
                        type="button"
                        onClick={handleGoogle}
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-md bg-white text-gray-700 font-medium shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001 6.19 5.238 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                        </svg>
                        Sign in with Google
                    </button>
                    <p className="mt-2 text-center text-xs text-gray-500">Use your @fbn-transport.co.za account</p>
                    <div className="flex items-center gap-3 my-5">
                        <span className="h-px flex-1 bg-gray-600" />
                        <span className="text-xs text-gray-400">or</span>
                        <span className="h-px flex-1 bg-gray-600" />
                    </div>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                            Email
                        </label>
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
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                            Password
                        </label>
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
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="text-center text-sm">
                    <button type="button" onClick={() => { setError(null); setInfo(null); setMode('select'); }} className="font-medium text-brand-secondary hover:text-blue-400">
                        ← Back to portals
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
