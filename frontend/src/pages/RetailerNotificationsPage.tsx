import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
  TrendingUp,
  Package,
  Store,
  LayoutDashboard,
  CheckCheck,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationItem, StockAlertType } from '../types';
import * as notificationService from '../services/notifications';

const RetailerNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await notificationService.getRetailerNotifications({
        isRead: onlyUnread ? true : undefined,
        type: selectedFilter !== 'ALL' && selectedFilter !== 'UNREAD' ? selectedFilter : undefined,
        limit: 50,
      });
      setNotifications(res.notifications);

      const count = await notificationService.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [selectedFilter, onlyUnread]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setIsProcessing(true);
      await notificationService.markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await notificationService.acknowledgeNotificationAlert(alertId);
      setNotifications((prev) =>
        prev.map((n) => (n.alert_id === alertId ? { ...n, alert_status: 'ACKNOWLEDGED' } : n))
      );
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const renderSeverityBadge = (type?: StockAlertType) => {
    switch (type) {
      case 'OUT_OF_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            URGENT — Out of Stock
          </span>
        );
      case 'CRITICAL_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
            <Flame className="w-3.5 h-3.5 text-amber-700" />
            CRITICAL — Immediate Replenishment
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-900 border border-orange-300">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            WARNING — Low Stock
          </span>
        );
      case 'REORDER_SOON':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            INFO — Reorder Soon
          </span>
        );
      case 'BESTSELLER_REPLENISHMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-300">
            <TrendingUp className="w-3.5 h-3.5 text-purple-700" />
            DEMAND WARNING — Bestseller Velocity
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Bell className="w-3.5 h-3.5 text-slate-500" />
            Inventory Notification
          </span>
        );
    }
  };

  const filterOptions = [
    { id: 'ALL', label: 'All Notifications' },
    { id: 'OUT_OF_STOCK', label: 'Out of Stock' },
    { id: 'CRITICAL_STOCK', label: 'Critical' },
    { id: 'LOW_STOCK', label: 'Low Stock' },
    { id: 'REORDER_SOON', label: 'Reorder Soon' },
    { id: 'BESTSELLER_REPLENISHMENT', label: 'Bestseller Demand' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-brand-honey text-brand-navy text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Warehouse Notifications
            </span>
            <span className="px-3 py-1 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-brand-honey" />
              City Warehouse: {user?.assigned_city || 'Assigned City'}
            </span>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black animate-pulse">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">
            Smart Inventory Alerts & Demand Center
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Real-time threshold alerts and monthly demand-based replenishment warnings for your authorized metropolitan hub.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Mark All as Read</span>
            </button>
          )}
          <Link
            to="/retailer/pos"
            className="px-4 py-2 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Store className="w-3.5 h-3.5" />
            <span>POS Terminal</span>
          </Link>
          <Link
            to="/retailer/dashboard"
            className="px-4 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Hub Dashboard</span>
          </Link>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Filter:
          </span>
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === f.id
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'bg-white border border-brand-border text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
            className="rounded border-slate-300 text-brand-navy focus:ring-brand-honey"
          />
          <span>Show Unread Only ({unreadCount})</span>
        </label>
      </div>

      {/* 3. Notification List */}
      {loading ? (
        <div className="space-y-4 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-brand-border animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-brand-border p-8">
          <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-base font-extrabold text-brand-navy">All Clear in Warehouse</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            No stock alerts or replenishment warnings currently match your selected filter for {user?.assigned_city}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.is_read;
            const isAcknowledged = n.alert_status === 'ACKNOWLEDGED';

            return (
              <div
                key={n.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isUnread
                    ? 'bg-amber-50/40 border-amber-300 shadow-sm'
                    : 'bg-white border-brand-border hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Product Thumbnail or Fallback */}
                    {n.image_url ? (
                      <img
                        src={n.image_url}
                        alt={n.product_name || 'Product'}
                        className="w-14 h-14 rounded-xl object-contain bg-white border border-slate-200 shrink-0 p-1"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <Package className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {renderSeverityBadge(n.alert_type)}
                        {isUnread && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                            New
                          </span>
                        )}
                        {isAcknowledged && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Acknowledged
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-brand-navy truncate">
                        {n.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {n.message}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                        {n.product_name && (
                          <span>
                            <strong>Item:</strong> {n.product_name}
                          </span>
                        )}
                        {n.current_stock !== undefined && (
                          <span>
                            <strong>Current Stock:</strong>{' '}
                            <span className={n.current_stock === 0 ? 'text-rose-600 font-extrabold' : 'font-mono'}>
                              {n.current_stock} units
                            </span>
                          </span>
                        )}
                        {n.city && (
                          <span>
                            <strong>Hub:</strong> {n.city}
                          </span>
                        )}
                        <span>
                          {new Date(n.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 sm:self-center shrink-0">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n.id)}
                        className="px-3 py-1.5 rounded-xl border border-brand-border bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mark Read</span>
                      </button>
                    )}

                    {n.alert_id && n.alert_status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(n.alert_id!)}
                        className="px-3 py-1.5 rounded-xl bg-brand-navy hover:bg-slate-800 text-[11px] font-bold text-white transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-honey" />
                        <span>Acknowledge</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { RetailerNotificationsPage };
export default RetailerNotificationsPage;
