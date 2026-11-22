import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Users,
  Store,
  Package,
  Building2,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  MapPin,
  Check,
  X,
  History,
  Sliders,
  Flame,
  ShieldAlert,
  AlertTriangle,
  Edit2,
} from 'lucide-react';
import {
  AdminOverviewData,
  AdminRetailerItem,
  CreateRetailerPayload,
  RetailerApprovalStatus,
  SupportedCity,
  SUPPORTED_CITIES,
  AdminOfflineOverviewData,
  InventoryMovement,
  StockAlert,
  StockAlertSetting,
  BestsellerReport,
} from '../types/index.ts';
import {
  getAdminOverview,
  getAdminRetailers,
  createRetailer,
  updateRetailerStatus,
  updateRetailerCity,
  updateRetailerActive,
} from '../services/admin.ts';
import {
  getAdminOfflineOverview,
  getAdminInventoryMovements,
} from '../services/pos.ts';
import {
  getAdminStockAlerts,
  getAdminBestsellers,
  getAdminStockThresholds,
  updateAdminStockThreshold,
  refreshAnalytics,
} from '../services/notifications.ts';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';

export const AdminDashboardPage: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [retailers, setRetailers] = useState<AdminRetailerItem[]>([]);
  const [offlineOverview, setOfflineOverview] = useState<AdminOfflineOverviewData | null>(null);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New retailer modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingRetailer, setSubmittingRetailer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newRetailer, setNewRetailer] = useState<CreateRetailerPayload>({
    name: '',
    email: '',
    password: '',
    assignedCity: 'Bengaluru',
    approvalStatus: 'APPROVED',
  });

  // Sprint 9H: Smart Alerts & Analytics
  const [stockAlertsData, setStockAlertsData] = useState<{
    alerts: StockAlert[];
    overview: {
      bySeverity: { severity: string; count: number }[];
      byCity: {
        city: string;
        total_active: number;
        out_of_stock: number;
        critical_stock: number;
        low_stock: number;
        reorder_soon: number;
      }[];
    };
  }>({ alerts: [], overview: { bySeverity: [], byCity: [] } });

  const [bestsellerReport, setBestsellerReport] = useState<BestsellerReport | null>(null);
  const [bestsellerCity, setBestsellerCity] = useState<SupportedCity>('Bengaluru');
  const [thresholds, setThresholds] = useState<StockAlertSetting[]>([]);
  const [editingThreshold, setEditingThreshold] = useState<StockAlertSetting | null>(null);
  const [editForm, setEditForm] = useState<{
    early_warning_threshold: number;
    minimum_stock_threshold: number;
    critical_stock_threshold: number;
  }>({ early_warning_threshold: 10, minimum_stock_threshold: 5, critical_stock_threshold: 2 });
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [alertFilterCity, setAlertFilterCity] = useState<string>('ALL');
  const [alertFilterSeverity, setAlertFilterSeverity] = useState<string>('ALL');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [
        overviewData,
        retailersData,
        offlineData,
        movementsData,
        alertsData,
        bestsellersData,
        thresholdsData,
      ] = await Promise.all([
        getAdminOverview(),
        getAdminRetailers(),
        getAdminOfflineOverview().catch(() => null),
        getAdminInventoryMovements({ limit: 20 }).catch(() => ({ movements: [] })),
        getAdminStockAlerts({ limit: 50 }).catch(() => ({
          alerts: [],
          overview: { bySeverity: [], byCity: [] },
          pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
        })),
        getAdminBestsellers({ city: bestsellerCity, limit: 10 }).catch(() => null),
        getAdminStockThresholds({ limit: 20 }).catch(() => ({
          settings: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
        })),
      ]);
      setOverview(overviewData);
      setRetailers(retailersData);
      setOfflineOverview(offlineData);
      setInventoryMovements(movementsData.movements || []);
      setStockAlertsData({
        alerts: alertsData.alerts || [],
        overview: alertsData.overview || { bySeverity: [], byCity: [] },
      });
      if (bestsellersData && 'bestsellers' in bestsellersData) {
        setBestsellerReport(bestsellersData as BestsellerReport);
      }
      setThresholds(thresholdsData.settings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administrator data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bestsellerCity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newRetailer.name.trim() || !newRetailer.email.trim() || !newRetailer.password) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (newRetailer.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setSubmittingRetailer(true);
    try {
      await createRetailer(newRetailer);
      setShowAddModal(false);
      setNewRetailer({
        name: '',
        email: '',
        password: '',
        assignedCity: 'Bengaluru',
        approvalStatus: 'APPROVED',
      });
      setActionSuccess('New retailer created successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
      await loadData(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create retailer.');
    } finally {
      setSubmittingRetailer(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: RetailerApprovalStatus) => {
    try {
      await updateRetailerStatus(userId, newStatus);
      setActionSuccess(`Retailer status updated to ${newStatus}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update retailer status.');
    }
  };

  const handleCityChange = async (userId: string, newCity: SupportedCity) => {
    try {
      await updateRetailerCity(userId, newCity);
      setActionSuccess(`Retailer city assignment updated to ${newCity}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update retailer city.');
    }
  };

  const handleActiveToggle = async (userId: string, currentActive: boolean) => {
    try {
      await updateRetailerActive(userId, !currentActive);
      setActionSuccess(`Retailer account ${!currentActive ? 'activated' : 'deactivated'}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update retailer active status.');
    }
  };

  const handleRefreshAnalytics = async () => {
    setRefreshingAnalytics(true);
    setError(null);
    try {
      await refreshAnalytics();
      setActionSuccess('Analytics updated: Daily sales aggregation refreshed successfully.');
      setTimeout(() => setActionSuccess(null), 5000);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh analytics.');
    } finally {
      setRefreshingAnalytics(false);
    }
  };

  const handleBestsellerCityChange = async (city: SupportedCity) => {
    setBestsellerCity(city);
    try {
      const res = await getAdminBestsellers({ city, limit: 10 });
      if (res && 'bestsellers' in res) {
        setBestsellerReport(res as BestsellerReport);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bestsellers for ' + city);
    }
  };

  const handleOpenEditThreshold = (setting: StockAlertSetting) => {
    setEditingThreshold(setting);
    setEditForm({
      early_warning_threshold: setting.early_warning_threshold,
      minimum_stock_threshold: setting.minimum_stock_threshold,
      critical_stock_threshold: setting.critical_stock_threshold,
    });
    setThresholdError(null);
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThreshold) return;
    setThresholdError(null);

    const early = Number(editForm.early_warning_threshold);
    const min = Number(editForm.minimum_stock_threshold);
    const crit = Number(editForm.critical_stock_threshold);

    if (isNaN(early) || isNaN(min) || isNaN(crit)) {
      setThresholdError('All thresholds must be valid numbers.');
      return;
    }

    if (early < min || min < crit || crit < 0) {
      setThresholdError('Hierarchy violated: Early Warning >= Min Stock >= Critical Stock >= 0 required.');
      return;
    }

    setSavingThreshold(true);
    try {
      await updateAdminStockThreshold({
        productId: editingThreshold.product_id,
        city: editingThreshold.city,
        earlyWarningThreshold: early,
        minimumStockThreshold: min,
        criticalStockThreshold: crit,
      });
      setActionSuccess(`Stock thresholds for "${editingThreshold.product_name}" updated and evaluated.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setEditingThreshold(null);
      await loadData(true);
    } catch (err) {
      setThresholdError(err instanceof Error ? err.message : 'Failed to update stock thresholds.');
    } finally {
      setSavingThreshold(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-20">
        <LoadingSpinner size="lg" message="Loading administrator dashboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-left">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-honey text-brand-navy text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Administrator Control Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
            Platform Management & Operations
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Real-time warehouse synchronization, multi-city inventory oversight, and retailer network governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-brand-honey" />
            <span>Add Retailer</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* 2. Platform Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-6">
        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">Total Customers</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy">
            {overview?.total_customers ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Registered customer accounts</p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">Retailer Hubs</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-brand-navy">
              {overview?.total_retailers ?? 0}
            </p>
            {overview && overview.pending_retailers > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                {overview.pending_retailers} Pending
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Authorized store partners</p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">Active Catalog</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy">
            {overview?.total_products ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Unified verified products</p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">City Warehouses</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy">5 Cities</p>
          <p className="text-[11px] text-slate-400 mt-1">100% network synchronization</p>
        </div>
      </div>

      {/* 3. City Warehouse Inventory Overview */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              City Warehouse Inventory Status
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Aggregated live stock levels across all 5 regional fulfillment hubs.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
            PostgreSQL Live
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-6">City Hub</th>
                <th className="py-3.5 px-6">Catalog SKUs</th>
                <th className="py-3.5 px-6">Total Warehouse Units</th>
                <th className="py-3.5 px-6">Low Stock Items (&lt; 10)</th>
                <th className="py-3.5 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(overview?.city_inventory || []).map((city) => (
                <tr key={city.city} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6 flex items-center gap-2 font-bold text-brand-navy">
                    <MapPin className="w-4 h-4 text-brand-honey" />
                    <span>{city.city}</span>
                  </td>
                  <td className="py-3.5 px-6 text-slate-600">{city.product_count} / 36</td>
                  <td className="py-3.5 px-6 font-bold text-slate-800">
                    {city.total_stock.toLocaleString()} units
                  </td>
                  <td className="py-3.5 px-6">
                    {city.low_stock_count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                        {city.low_stock_count} SKUs low
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-semibold">Optimal</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active Hub
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Retailer Network Management */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              Retailer Network Management
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Authorize store managers, manage regional city assignments, and approve or suspend retail access.
            </p>
          </div>
          <span className="text-xs font-bold text-brand-muted">
            {retailers.length} {retailers.length === 1 ? 'Retailer' : 'Retailers'} Registered
          </span>
        </div>

        {retailers.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">No Retailers Registered Yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Add your first regional store partner using the button above.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-deep-navy transition-all"
            >
              Add First Retailer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-6">Retailer Profile</th>
                  <th className="py-3.5 px-6">Assigned City Hub</th>
                  <th className="py-3.5 px-6">Approval Status</th>
                  <th className="py-3.5 px-6">Account Status</th>
                  <th className="py-3.5 px-6">Created</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {retailers.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-6">
                      <p className="font-bold text-brand-navy">{r.name}</p>
                      <p className="text-[11px] text-slate-400">{r.email}</p>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-honey" />
                        <select
                          value={r.assigned_city}
                          onChange={(e) => handleCityChange(r.id, e.target.value as SupportedCity)}
                          className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-honey cursor-pointer"
                        >
                          {SUPPORTED_CITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          r.approval_status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.approval_status === 'SUSPENDED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {r.approval_status === 'APPROVED' && <Check className="w-3 h-3" />}
                        {r.approval_status === 'SUSPENDED' && <X className="w-3 h-3" />}
                        <span>{r.approval_status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          r.is_active ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            r.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        {r.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-400 text-[11px]">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.approval_status === 'APPROVED' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(r.id, 'SUSPENDED')}
                            className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-bold transition-colors"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(r.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleActiveToggle(r.id, r.is_active)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-bold transition-colors"
                        >
                          {r.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Recent Platform Orders */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              Recent Platform Checkouts
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Live orders processed across regional city warehouses.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-6">Order ID</th>
                <th className="py-3.5 px-6">Delivery Hub</th>
                <th className="py-3.5 px-6">Items</th>
                <th className="py-3.5 px-6">Total Amount</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(overview?.recent_orders || []).map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-mono text-slate-700">{o.id.slice(0, 13)}...</td>
                  <td className="py-3.5 px-6 font-semibold text-brand-navy">{o.city}</td>
                  <td className="py-3.5 px-6 text-slate-600">{o.total_items} items</td>
                  <td className="py-3.5 px-6 font-bold text-brand-navy">
                    ₹{Number(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      {o.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-slate-400 text-[11px]">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Offline Retail & POS Terminal Governance */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-honey text-brand-navy text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Store className="w-3 h-3" />
                Sprint 9G: Offline POS Oversight
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              In-Store Retail Billing & Revenue
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Aggregated counter sales and transactional outbox status across regional fulfillment centers.
            </p>
          </div>
        </div>

        {/* Offline Summary Metric Cards */}
        <div className="p-5 sm:p-6 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 border-b border-brand-border">
          <div className="bg-white p-4 rounded-2xl border border-brand-border shadow-sm">
            <span className="text-[11px] font-semibold text-brand-muted">Total POS Bills</span>
            <p className="text-xl sm:text-2xl font-black text-brand-navy mt-1">
              {offlineOverview?.totals.total_bills ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Recorded offline bills</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-brand-border shadow-sm">
            <span className="text-[11px] font-semibold text-brand-muted">Finalized Bills</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
              {offlineOverview?.totals.finalized_bills ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Stock deducted & synced</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-brand-border shadow-sm">
            <span className="text-[11px] font-semibold text-brand-muted">In-Progress Drafts</span>
            <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
              {offlineOverview?.totals.draft_bills ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Zero stock deducted</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-brand-border shadow-sm">
            <span className="text-[11px] font-semibold text-brand-muted">Offline Revenue</span>
            <p className="text-xl sm:text-2xl font-black text-brand-navy font-mono mt-1">
              ₹{Number(offlineOverview?.totals.total_offline_revenue ?? 0).toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Gross counter billings</p>
          </div>
        </div>

        {/* City Breakdown & Recent In-Store Bills */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* City Breakdown (5 Cols) */}
          <div className="lg:col-span-5 border border-brand-border rounded-2xl p-4 bg-slate-50">
            <h3 className="text-xs font-black text-brand-navy uppercase tracking-wider mb-3">
              City Retail Distribution
            </h3>
            <div className="space-y-2">
              {(offlineOverview?.city_sales || []).map((cs) => (
                <div
                  key={cs.city}
                  className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-brand-navy flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-honey" />
                    {cs.city}
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-brand-navy">
                      ₹{Number(cs.total_revenue).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {cs.finalized_sales_count} finalized
                    </span>
                  </div>
                </div>
              ))}
              {(!offlineOverview?.city_sales || offlineOverview.city_sales.length === 0) && (
                <p className="text-xs text-slate-400 py-4 text-center">No finalized sales yet.</p>
              )}
            </div>
          </div>

          {/* Recent Offline Bills (7 Cols) */}
          <div className="lg:col-span-7 border border-brand-border rounded-2xl p-4 bg-white overflow-hidden">
            <h3 className="text-xs font-black text-brand-navy uppercase tracking-wider mb-3">
              Recent Counter Receipts
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2">Bill #</th>
                    <th className="pb-2">Retailer / City</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(offlineOverview?.recent_bills || []).map((rb) => (
                    <tr key={rb.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 font-mono font-bold text-brand-navy">
                        {rb.bill_number}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        <div>{rb.retailer_name}</div>
                        <span className="text-[10px] text-slate-400">{rb.city}</span>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-brand-navy">
                        ₹{Number(rb.total_amount).toFixed(2)}
                      </td>
                      <td className="py-2.5 text-center">
                        <Link
                          to={`/retailer/bills/${rb.id}`}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-brand-navy hover:text-white text-[11px] font-bold transition-all"
                        >
                          Receipt
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(!offlineOverview?.recent_bills || offlineOverview.recent_bills.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                        No in-store receipts generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Centralized Inventory Movements & Concurrency Audit Trail */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <History className="w-3 h-3 text-brand-honey" />
                Audit Trail
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              Centralized Warehouse Stock Movements
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Immutable audit log of all online checkout and offline POS inventory deductions with concurrency protection.
            </p>
          </div>
          <span className="text-xs font-bold text-brand-muted">
            {offlineOverview?.total_inventory_movements ?? inventoryMovements.length} Total Movements Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-6">Timestamp</th>
                <th className="py-3 px-6">Product</th>
                <th className="py-3 px-6">Warehouse</th>
                <th className="py-3 px-6">Movement Type</th>
                <th className="py-3 px-6 text-center">Delta</th>
                <th className="py-3 px-6 text-center">Stock Before → After</th>
                <th className="py-3 px-6">Performer / Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {inventoryMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-6 text-slate-400 whitespace-nowrap text-[11px]">
                    {new Date(m.created_at).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="py-3 px-6 font-bold text-brand-navy">
                    <div>{m.product_name || m.product_id}</div>
                    {m.product_category && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        {m.product_category}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-slate-700 font-semibold">{m.city}</td>
                  <td className="py-3 px-6">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        m.movement_type === 'OFFLINE_SALE'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : m.movement_type === 'ONLINE_SALE'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {m.movement_type}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-center font-bold font-mono text-red-600">
                    {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                  </td>
                  <td className="py-3 px-6 text-center font-mono text-slate-600">
                    <span className="font-bold text-slate-700">{m.quantity_before}</span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span className="font-bold text-brand-navy">{m.quantity_after}</span>
                  </td>
                  <td className="py-3 px-6 text-slate-600">
                    <div className="font-semibold text-slate-800">
                      {m.performed_by_name || 'Online Customer'}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Ref: {m.source_id.slice(0, 14)}...
                    </span>
                  </td>
                </tr>
              ))}
              {inventoryMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No warehouse inventory movements logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Multi-City Smart Inventory Alerts & Early Warning Oversight (Sprint 9H) */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-brand-navy text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-brand-navy" />
                Sprint 9H: Smart Inventory Alerts
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              Multi-City Stock Alerts &amp; Replenishment Oversight
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Proactive multi-threshold warehouse monitoring across all 5 regional fulfillment centers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshAnalytics}
              disabled={refreshingAnalytics}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-deep-navy text-white text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingAnalytics ? 'animate-spin' : ''}`} />
              <span>{refreshingAnalytics ? 'Computing...' : 'Refresh Analytics'}</span>
            </button>
          </div>
        </div>

        {/* Global Alert Counts */}
        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 bg-slate-50/50 border-b border-brand-border">
          <div className="bg-white p-3.5 rounded-2xl border border-red-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">Out of Stock</span>
            <p className="text-2xl font-black text-red-900 mt-1 font-mono">
              {overview?.alerts_overview?.out_of_stock ?? 0}
            </p>
            <p className="text-[10px] text-red-600 mt-0.5 font-medium">0 units (Urgent)</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-orange-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Critical Stock</span>
            <p className="text-2xl font-black text-orange-900 mt-1 font-mono">
              {overview?.alerts_overview?.critical_stock ?? 0}
            </p>
            <p className="text-[10px] text-orange-600 mt-0.5 font-medium">&le; 2 units</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-amber-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Low Stock</span>
            <p className="text-2xl font-black text-amber-900 mt-1 font-mono">
              {overview?.alerts_overview?.low_stock ?? 0}
            </p>
            <p className="text-[10px] text-amber-600 mt-0.5 font-medium">&le; 5 units</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-blue-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Reorder Soon</span>
            <p className="text-2xl font-black text-blue-900 mt-1 font-mono">
              {overview?.alerts_overview?.reorder_soon ?? 0}
            </p>
            <p className="text-[10px] text-blue-600 mt-0.5 font-medium">&le; 10 units</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-purple-200 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Bestseller Alerts</span>
            <p className="text-2xl font-black text-purple-900 mt-1 font-mono">
              {overview?.alerts_overview?.bestseller_warnings ?? 0}
            </p>
            <p className="text-[10px] text-purple-600 mt-0.5 font-medium">&lt; 7 days run-out</p>
          </div>
        </div>

        {/* City Alert Matrix Table */}
        <div className="p-5 sm:p-6 border-b border-brand-border">
          <h3 className="text-xs font-black text-brand-navy uppercase tracking-wider mb-3">
            City Fulfillment Hub Alert Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Warehouse City</th>
                  <th className="py-2.5 px-4 text-center">Total Active Alerts</th>
                  <th className="py-2.5 px-4 text-center">Out of Stock</th>
                  <th className="py-2.5 px-4 text-center">Critical (&le; 2)</th>
                  <th className="py-2.5 px-4 text-center">Low Stock (&le; 5)</th>
                  <th className="py-2.5 px-4 text-center">Reorder Soon (&le; 10)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SUPPORTED_CITIES.map((c) => {
                  const cityStats = (stockAlertsData.overview?.byCity || []).find(
                    (item) => item.city?.toLowerCase() === c.toLowerCase()
                  ) || {
                    total_active: 0,
                    out_of_stock: 0,
                    critical_stock: 0,
                    low_stock: 0,
                    reorder_soon: 0,
                  };
                  return (
                    <tr key={c} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-brand-navy flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-honey" />
                        <span>{c}</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-800 font-mono">
                        {cityStats.total_active}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-red-700 font-mono">
                        {cityStats.out_of_stock}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-orange-700 font-mono">
                        {cityStats.critical_stock}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-amber-700 font-mono">
                        {cityStats.low_stock}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-blue-700 font-mono">
                        {cityStats.reorder_soon}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Alerts List with Filters */}
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-xs font-black text-brand-navy uppercase tracking-wider">
              Live Stock Alerts Feed
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={alertFilterCity}
                onChange={(e) => setAlertFilterCity(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">All Cities</option>
                {SUPPORTED_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={alertFilterSeverity}
                onChange={(e) => setAlertFilterSeverity(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">All Severities</option>
                <option value="URGENT">URGENT (Out of Stock)</option>
                <option value="CRITICAL">CRITICAL (&le; 2)</option>
                <option value="WARNING">WARNING (Low Stock)</option>
                <option value="INFO">INFO (Reorder Soon)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Warehouse</th>
                  <th className="py-2.5 px-4">Current Stock</th>
                  <th className="py-2.5 px-4">Alert Type</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4 text-right">Triggered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {stockAlertsData.alerts
                  .filter((a) => {
                    if (alertFilterCity !== 'ALL' && a.city !== alertFilterCity) return false;
                    if (alertFilterSeverity !== 'ALL' && a.severity !== alertFilterSeverity) return false;
                    return true;
                  })
                  .slice(0, 10)
                  .map((alert) => (
                    <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-brand-navy">{alert.product_name}</div>
                        <div className="text-[10px] text-slate-400">{alert.product_category}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 font-semibold">{alert.city}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-brand-navy">
                        {alert.current_stock} units
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          {alert.alert_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                            alert.severity === 'URGENT'
                              ? 'bg-red-100 text-red-800'
                              : alert.severity === 'CRITICAL'
                              ? 'bg-orange-100 text-orange-800'
                              : alert.severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400 text-[11px]">
                        {new Date(alert.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                {stockAlertsData.alerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No active stock alerts detected. All warehouse inventory levels healthy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 9. Cross-City Monthly Bestsellers & Demand Velocity (Sprint 9H) */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-honey text-brand-navy text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3 text-brand-navy" />
                Sprint 9H: Bestseller Analytics
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              Cross-City Monthly Bestsellers &amp; Sales Velocity
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Online customer checkouts and offline counter bills combined into daily sales velocity and stock coverage days.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">City:</span>
            <select
              value={bestsellerCity}
              onChange={(e) => handleBestsellerCityChange(e.target.value as SupportedCity)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-brand-navy bg-white focus:outline-none focus:ring-1 focus:ring-brand-honey cursor-pointer"
            >
              {SUPPORTED_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-6">Rank &amp; Product</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Month Total Sales (Online / Counter)</th>
                <th className="py-3.5 px-6">Sales Velocity</th>
                <th className="py-3.5 px-6">Current Stock</th>
                <th className="py-3.5 px-6">Coverage Days</th>
                <th className="py-3.5 px-6 text-right">Replenishment Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(bestsellerReport?.bestsellers || []).map((item) => (
                <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-deep-navy text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        #{item.rank}
                      </span>
                      <div>
                        <p className="font-bold text-brand-navy">{item.productName}</p>
                        <p className="text-[10px] font-mono text-slate-400">
                          ₹{Number(item.price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-slate-600">{item.category}</td>
                  <td className="py-3.5 px-6">
                    <span className="font-bold text-brand-navy font-mono">
                      {item.totalUnits} units
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      ({item.onlineUnits} online + {item.offlineUnits} counter)
                    </span>
                  </td>
                  <td className="py-3.5 px-6 font-mono font-bold text-slate-700">
                    {item.avgDailySales.toFixed(2)} units/day
                  </td>
                  <td className="py-3.5 px-6 font-mono font-bold text-brand-navy">
                    {item.currentStock} units
                  </td>
                  <td className="py-3.5 px-6">
                    {item.daysOfStockRemaining !== null ? (
                      <span
                        className={`font-mono font-bold ${
                          item.daysOfStockRemaining < 7
                            ? 'text-red-700'
                            : item.daysOfStockRemaining < 14
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {item.daysOfStockRemaining.toFixed(1)} days
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No sales velocity</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {item.replenishmentWarning ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-extrabold uppercase tracking-wide">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        Reorder (&lt; 7d)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Healthy Coverage
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(!bestsellerReport?.bestsellers || bestsellerReport.bestsellers.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No sales data recorded for {bestsellerCity} this month yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 10. Product Stock Alert Threshold Governance (Sprint 9H) */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card mt-8 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-3 h-3 text-brand-honey" />
                Threshold Governance
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              Product Stock Alert Threshold Configurations
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Customize Early Reorder, Low Stock, and Critical Stock trigger points per product with hierarchy enforcement (Early &ge; Min &ge; Critical &ge; 0).
            </p>
          </div>
          <span className="text-xs font-bold text-brand-muted">
            {thresholds.length} Configured Rules
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-6">Product</th>
                <th className="py-3 px-6">Category</th>
                <th className="py-3 px-6 text-center">Early Reorder Trigger</th>
                <th className="py-3 px-6 text-center">Low Stock Trigger</th>
                <th className="py-3 px-6 text-center">Critical Stock Trigger</th>
                <th className="py-3 px-6 text-center">Last Modified</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {thresholds.slice(0, 10).map((t) => (
                <tr key={`${t.product_id}-${t.city}`} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-6 font-bold text-brand-navy">
                    <div>{t.product_name}</div>
                    <span className="text-[10px] text-slate-400 font-mono">{t.city}</span>
                  </td>
                  <td className="py-3 px-6 text-slate-600">{t.product_category}</td>
                  <td className="py-3 px-6 text-center font-mono font-bold text-blue-700">
                    &le; {t.early_warning_threshold} units
                  </td>
                  <td className="py-3 px-6 text-center font-mono font-bold text-amber-700">
                    &le; {t.minimum_stock_threshold} units
                  </td>
                  <td className="py-3 px-6 text-center font-mono font-bold text-orange-700">
                    &le; {t.critical_stock_threshold} units
                  </td>
                  <td className="py-3 px-6 text-center text-slate-400 text-[11px]">
                    {t.setting_updated_at ? new Date(t.setting_updated_at).toLocaleDateString() : 'Default'}
                  </td>
                  <td className="py-3 px-6 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenEditThreshold(t)}
                      className="px-2.5 py-1 rounded-lg border border-brand-border hover:bg-slate-100 text-brand-navy text-[11px] font-bold transition-all inline-flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3 text-brand-honey" />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
              {thresholds.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No threshold configurations loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 11. Edit Stock Threshold Modal Dialog (Sprint 9H) */}
      {editingThreshold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-brand-border max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-brand-navy">Configure Thresholds</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingThreshold(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3">
              <p className="text-xs font-bold text-brand-navy">{editingThreshold.product_name}</p>
              <p className="text-[11px] text-slate-400">{editingThreshold.product_category}</p>
            </div>

            {thresholdError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{thresholdError}</span>
              </div>
            )}

            <form onSubmit={handleSaveThreshold} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="early-reorder">
                  Early Warning Reorder Threshold (INFO alert)
                </label>
                <input
                  id="early-reorder"
                  type="number"
                  min={0}
                  required
                  value={editForm.early_warning_threshold}
                  onChange={(e) =>
                    setEditForm({ ...editForm, early_warning_threshold: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Triggers when stock &le; this value (Default: 10)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="min-stock">
                  Minimum Stock Threshold (LOW_STOCK warning)
                </label>
                <input
                  id="min-stock"
                  type="number"
                  min={0}
                  required
                  value={editForm.minimum_stock_threshold}
                  onChange={(e) =>
                    setEditForm({ ...editForm, minimum_stock_threshold: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Triggers when stock &le; this value (Default: 5)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="crit-stock">
                  Critical Stock Threshold (CRITICAL alert)
                </label>
                <input
                  id="crit-stock"
                  type="number"
                  min={0}
                  required
                  value={editForm.critical_stock_threshold}
                  onChange={(e) =>
                    setEditForm({ ...editForm, critical_stock_threshold: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Triggers when stock &le; this value (Default: 2)</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                Rule: <strong>Early Reorder &ge; Min Stock &ge; Critical Stock &ge; 0</strong>. Out of Stock is always automatically triggered at 0 units.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingThreshold(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingThreshold}
                  className="px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold disabled:opacity-50"
                >
                  {savingThreshold ? 'Saving...' : 'Update & Re-evaluate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12. Add Retailer Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-brand-border max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-soft-honey flex items-center justify-center text-brand-navy">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-brand-navy">Create Retailer Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRetailer} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="retailer-name">
                  Full Name / Store Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="retailer-name"
                    type="text"
                    required
                    placeholder="e.g. Bengaluru Hub Retailer"
                    value={newRetailer.name}
                    onChange={(e) => setNewRetailer({ ...newRetailer, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="retailer-email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="retailer-email"
                    type="email"
                    required
                    placeholder="retailer@hivemart.test"
                    value={newRetailer.email}
                    onChange={(e) => setNewRetailer({ ...newRetailer, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="retailer-password">
                  Initial Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="retailer-password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={newRetailer.password}
                    onChange={(e) => setNewRetailer({ ...newRetailer, password: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="retailer-city">
                  Assigned Regional City Hub
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <select
                    id="retailer-city"
                    value={newRetailer.assignedCity}
                    onChange={(e) =>
                      setNewRetailer({ ...newRetailer, assignedCity: e.target.value as SupportedCity })
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800 bg-white"
                  >
                    {SUPPORTED_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1" htmlFor="retailer-status">
                  Approval Status
                </label>
                <select
                  id="retailer-status"
                  value={newRetailer.approvalStatus}
                  onChange={(e) =>
                    setNewRetailer({
                      ...newRetailer,
                      approvalStatus: e.target.value as RetailerApprovalStatus,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800 bg-white"
                >
                  <option value="APPROVED">APPROVED (Immediate access)</option>
                  <option value="PENDING">PENDING (Review required)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRetailer}
                  className="px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingRetailer ? 'Creating...' : 'Create Retailer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
