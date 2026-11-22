import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  ShieldCheck,
  Calendar,
  Package,
  ShoppingBag,
  MapPin,
  LogOut,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useCity } from '../context/CityContext.tsx';
import { Badge } from '../components/common/Badge.tsx';

export const AccountPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Active Member';

  const userInitials = (user?.name || 'Customer')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
            My Account
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Manage your personal profile, credentials, and shopping preferences.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors w-fit border border-red-200"
          title="Sign out of your session"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Details Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-brand-border p-6 sm:p-8 shadow-card space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
            {/* Initials Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-brand-navy text-brand-honey font-black text-xl flex items-center justify-center shadow-md">
              {userInitials || 'HM'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-brand-navy">{user?.name}</h2>
                <Badge variant="warning">{user?.role || 'customer'}</Badge>
              </div>
              <p className="text-xs text-brand-muted mt-0.5">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-brand-border flex items-start gap-3">
              <Mail className="w-4 h-4 text-brand-honey shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block">
                  Email Address
                </span>
                <span className="font-bold text-brand-navy break-all">{user?.email}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-brand-border flex items-start gap-3">
              <User className="w-4 h-4 text-brand-honey shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block">
                  Customer ID
                </span>
                <span className="font-mono text-[11px] text-brand-navy truncate block max-w-[180px]">
                  {user?.id}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-brand-border flex items-start gap-3">
              <Calendar className="w-4 h-4 text-brand-honey shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block">
                  Member Since
                </span>
                <span className="font-bold text-brand-navy">{formattedDate}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-brand-border flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block">
                  Security Status
                </span>
                <span className="font-bold text-emerald-700">JWT Verified & Active</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-brand-soft-honey/50 border border-amber-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="w-4 h-4 text-brand-navy shrink-0" />
              <span className="text-brand-text">
                Current Delivery City: <strong className="text-brand-navy">{selectedCity}</strong>
              </span>
            </div>
            <Link
              to="/products"
              className="text-xs font-bold text-brand-navy hover:text-amber-700 flex items-center gap-1 transition-colors"
            >
              <span>Browse Catalog</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Quick Links & Shortcuts */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-card">
            <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-4">
              Shopping Quick Links
            </h3>

            <div className="space-y-2">
              <Link
                to="/orders"
                className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-brand-border transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-navy group-hover:text-blue-600 transition-colors block">
                      My Orders
                    </span>
                    <span className="text-[11px] text-brand-muted">View past shipments & tracking</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-navy transition-colors" />
              </Link>

              <Link
                to="/cart"
                className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-brand-border transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-navy group-hover:text-amber-600 transition-colors block">
                      Shopping Cart
                    </span>
                    <span className="text-[11px] text-brand-muted">Review items and checkout</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-navy transition-colors" />
              </Link>

              {(!user?.role || user.role === 'customer') && (
                <Link
                  to="/monthly-essentials"
                  data-testid="account-monthly-essentials-link"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/60 hover:bg-brand-soft-honey border border-brand-honey/30 hover:border-brand-honey transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-honey text-brand-navy flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-brand-navy group-hover:text-amber-900 transition-colors block flex items-center gap-1.5">
                        <span>My Monthly Essentials</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-brand-navy text-brand-honey">
                          Auto-Remind
                        </span>
                      </span>
                      <span className="text-[11px] text-brand-muted">
                        Recurring items & smart calendar alerts
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand-honey group-hover:text-brand-navy transition-colors" />
                </Link>
              )}

              <Link
                to="/products"
                className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-brand-border transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-navy group-hover:text-emerald-600 transition-colors block">
                      Explore Products
                    </span>
                    <span className="text-[11px] text-brand-muted">36 items in {selectedCity}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-navy transition-colors" />
              </Link>
            </div>
          </div>

          <div className="bg-gradient-to-br from-brand-navy to-brand-deep-navy rounded-3xl p-6 text-white shadow-card">
            <div className="flex items-center gap-2 mb-2 text-brand-honey">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Secure Account</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your customer session is protected by cryptographic tokens signed with standard 24h expiration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

