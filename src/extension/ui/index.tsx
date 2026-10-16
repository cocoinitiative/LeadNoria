import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { ExtensionApp } from './App.tsx';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ExtensionErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LeadNoria UI] Uncaught React render error caught by boundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove(['activeResearchRun', 'meta_scraper_active_run', 'leadnoria_checkpoint'], () => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-w-[360px] w-full h-full min-h-[500px] flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans select-none text-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-lg mb-4">
            LN
          </div>
          <h2 className="text-base font-bold text-slate-100 mb-1">LeadNoria Workspace Recovery</h2>
          <p className="text-xs text-slate-400 max-w-[320px] mb-4">
            The user interface encountered an unexpected state error. Your settings and research parameters remain protected.
          </p>
          {this.state.error && (
            <div className="w-full max-w-[340px] p-2.5 mb-4 text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-lg text-left overflow-auto max-h-24">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={this.handleReload}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
            >
              Reload Interface
            </button>
            <button
              onClick={this.handleResetState}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function mountApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[LeadNoria UI] Fatal: #root element not found in DOM.');
    return;
  }

  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ExtensionErrorBoundary>
          <ExtensionApp />
        </ExtensionErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    console.error('[LeadNoria UI] Fatal mounting exception:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

