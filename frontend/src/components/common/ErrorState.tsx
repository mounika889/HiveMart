import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Data',
  message = 'We encountered an issue connecting to the HiveMart service. Please ensure the backend is running.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center max-w-lg mx-auto my-8 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-brand-text mb-2">{title}</h3>
      <p className="text-sm text-brand-muted mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      )}
    </div>
  );
};

