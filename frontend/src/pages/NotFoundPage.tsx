import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold text-brand-honey uppercase tracking-wider block mb-1">
        Error 404
      </span>
      <h1 className="text-3xl font-extrabold text-brand-navy tracking-tight mb-2">
        Page Not Found
      </h1>
      <p className="text-xs text-brand-muted mb-6 leading-relaxed">
        The link you followed may be broken, or the page may have been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Homepage</span>
      </Link>
    </div>
  );
};

