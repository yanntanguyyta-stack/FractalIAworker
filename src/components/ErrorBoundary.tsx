import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 rounded-2xl glass border border-rose-200/60 text-center animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-rose-100/80 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Un problème est survenu dans cet affichage</h3>
          <p className="text-xs text-slate-600 max-w-md mb-4 leading-relaxed">
            {this.state.error?.message || 'Une erreur inattendue est survenue dans le composant.'}
          </p>
          <button
            onClick={this.handleReset}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
