import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';
import { LoadingSpinner } from '../common/LoadingSpinner.tsx';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center py-16">
        <LoadingSpinner size="lg" message="Verifying authentication..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user?.role || '').toLowerCase();
    const isAllowed = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);

    if (!isAllowed) {
      const fallbackDashboard =
        userRole === 'admin'
          ? '/admin/dashboard'
          : userRole === 'retailer'
          ? '/retailer/dashboard'
          : '/account';

      return (
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-3xl border border-red-200 p-8 shadow-card">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-extrabold text-brand-navy mb-2">Access Denied</h1>
            <p className="text-xs text-brand-muted mb-6 leading-relaxed">
              Your account ({user?.email}) has the <strong className="uppercase">{userRole}</strong> role and does
              not have permission to access this page.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                to={fallbackDashboard}
                className="px-4 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Go to Your Dashboard</span>
              </Link>
              <Link
                to="/"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
