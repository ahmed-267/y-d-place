import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="min-h-screen bg-bakery-cream flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 text-center animate-fade-in">
            <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-black font-serif text-bakery-brown mb-4">
              Something went wrong
            </h1>
            <p className="text-bakery-brown/60 mb-8">
              An unexpected error occurred. Please try reloading the application.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-bakery-brown/90 transition-all active:scale-95"
            >
              <RefreshCw size={20} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}