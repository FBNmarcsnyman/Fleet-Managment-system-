import React from 'react';

interface Props {
    children: any;
}

interface State {
    error: Error | null;
    errorInfo: { componentStack?: string } | null;
}

// Catches render-time exceptions anywhere in the tree. Without this, React 18
// unmounts the entire app on a thrown render, which presents to the user as a
// "post-login hang" — the page just goes blank with no visible error unless
// DevTools is already open. With this boundary, the crash surfaces on screen
// and is logged with full stack info for diagnosis.
//
// Uses `declare` for inherited Component members since the project doesn't
// install @types/react (adding it surfaces ~30 unrelated pre-existing type
// errors). The runtime behavior is unaffected.
export default class ErrorBoundary extends (React as any).Component {
    declare props: Props;
    declare state: State;
    declare setState: (newState: Partial<State>) => void;

    constructor(props: Props) {
        super(props);
        this.state = { error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
        console.error('[ErrorBoundary] render crashed:', error);
        console.error('[ErrorBoundary] component stack:', errorInfo.componentStack);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleClearState = () => {
        try {
            localStorage.clear();
        } catch {}
        window.location.reload();
    };

    render() {
        if (this.state.error) {
            const { error, errorInfo } = this.state;
            return (
                <div className="min-h-screen bg-gray-900 text-gray-100 p-8 font-mono text-sm">
                    <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg p-6 border border-red-500/50 shadow-2xl">
                        <h1 className="text-2xl font-bold text-red-400 mb-4">Application crashed during render</h1>
                        <p className="text-gray-300 mb-4">
                            A component threw an exception while rendering. The full stack is below and in the
                            browser console. This is the previously-silent &quot;post-login hang&quot; surfacing.
                        </p>
                        <div className="bg-gray-900 rounded p-4 mb-4 border border-red-500/30">
                            <div className="text-red-300 font-bold mb-1">{error.name}: {error.message}</div>
                            <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto mt-2">{error.stack}</pre>
                        </div>
                        {errorInfo && errorInfo.componentStack && (
                            <details className="mb-4">
                                <summary className="cursor-pointer text-blue-400 mb-2">React component stack</summary>
                                <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto bg-gray-900 rounded p-4 border border-gray-700">{errorInfo.componentStack}</pre>
                            </details>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold"
                            >
                                Reload page
                            </button>
                            <button
                                onClick={this.handleClearState}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white font-bold border border-gray-600"
                                title="Clears localStorage (including the Supabase auth session) and reloads"
                            >
                                Clear local state + reload
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
