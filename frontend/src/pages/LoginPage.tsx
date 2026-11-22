import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, Mail, Eye, EyeOff, ArrowLeft, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, isAuthenticated, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect immediately based on role
  useEffect(() => {
    if (isAuthenticated) {
      const userRole = (user?.role || '').toLowerCase();
      let destination = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      if (!destination || destination === '/login') {
        destination =
          userRole === 'admin'
            ? '/admin/dashboard'
            : userRole === 'retailer'
            ? '/retailer/dashboard'
            : '/account';
      }
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  // Clear errors when unmounting or switching
  useEffect(() => {
    clearError();
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    clearError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setClientError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setClientError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setClientError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login({ email: trimmedEmail, password });
      const userRole = (loggedInUser?.role || '').toLowerCase();
      let destination = (location.state as { from?: { pathname?: string } })?.from?.pathname;
      if (!destination || destination === '/login') {
        destination =
          userRole === 'admin'
            ? '/admin/dashboard'
            : userRole === 'retailer'
            ? '/retailer/dashboard'
            : '/account';
      }
      navigate(destination, { replace: true });
    } catch {
      // Error handled by AuthContext state
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = clientError || authError;

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <div className="bg-white rounded-3xl border border-brand-border p-6 sm:p-8 shadow-card text-left">
        {/* Header Icon & Title */}
        <div className="w-14 h-14 rounded-2xl bg-brand-soft-honey flex items-center justify-center mx-auto mb-4 text-brand-navy shadow-sm">
          <User className="w-7 h-7 text-brand-navy" />
        </div>

        <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight text-center mb-1">
          Welcome Back
        </h1>
        <p className="text-xs text-brand-muted text-center mb-6">
          Sign in to access your HiveMart account and cart.
        </p>

        {/* Error Notification Banner */}
        {displayError && (
          <div
            data-testid="auth-error-banner"
            className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1 font-medium">{displayError}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-navy mb-1.5" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (clientError) setClientError(null);
                }}
                disabled={submitting}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey focus:border-transparent text-brand-text placeholder-slate-400 transition-all disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-navy mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (clientError) setClientError(null);
                }}
                disabled={submitting}
                className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey focus:border-transparent text-brand-text placeholder-slate-400 transition-all disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 text-slate-400 hover:text-brand-navy transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-brand-honey" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Navigation to Register */}
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-center">
          <p className="text-xs text-brand-muted">
            Don't have an account yet?{' '}
            <Link
              to="/register"
              className="font-bold text-brand-navy hover:text-amber-600 transition-colors"
            >
              Create Account
            </Link>
          </p>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-1.5 text-xs text-brand-muted hover:text-brand-navy font-semibold py-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Homepage</span>
          </Link>
        </div>

        {/* Security Trust Badge */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Secured with JWT and 256-bit Encryption</span>
        </div>
      </div>
    </div>
  );
};
