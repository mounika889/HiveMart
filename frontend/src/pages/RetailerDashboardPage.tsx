import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  MapPin,
  Package,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Layers,
  ArrowRight,
  Receipt,
  Banknote,
  Eye,
  Bell,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { RetailerDashboardData, RetailerInventoryItem } from '../types/index.ts';
import { getRetailerDashboard } from '../services/retailer.ts';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';

export const RetailerDashboardPage: React.FC = () => {
  const [data, setData] = useState<RetailerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getRetailerDashboard();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load retailer dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!data?.inventory) return [];
    const set = new Set<string>();
    data.inventory.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [data]);

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    if (!data?.inventory) return [];
    return data.inventory.filter((item: RetailerInventoryItem) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCat = item.category?.toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // Stock filter
      const stock = Number(item.city_stock) || 0;
      if (stockFilter === 'LOW' && (stock <= 0 || stock >= 10)) return false;
      if (stockFilter === 'OUT' && stock !== 0) return false;

      return true;
    });
  }, [data, searchQuery, selectedCategory, stockFilter]);

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-20">
        <LoadingSpinner size="lg" message="Loading retailer inventory hub..." />
      </div>
    );
  }

  const retailer = data?.retailer;
  const metrics = data?.metrics;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-left">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-honey text-brand-navy text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Store className="w-3 h-3" />
              Retailer Store Portal
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Status: {retailer?.approval_status}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-deep-navy text-white text-[11px] font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-brand-honey" />
              City Hub: {retailer?.assigned_city}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
            {retailer?.name}
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Warehouse fulfillment inventory for the <strong className="text-brand-navy">{retailer?.assigned_city}</strong> region.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Sync Warehouse Stock'}</span>
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-6">
        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">Assigned Hub</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-brand-navy truncate">
            {retailer?.assigned_city}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Dedicated regional fulfillment</p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">Warehouse Units</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy">
            {(metrics?.total_units ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Available physical stock</p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">Today's Finalized Bills</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy">
            {metrics?.today_finalized_bills ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Counter bills finalized today</p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-brand-muted">Today's In-Store Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy font-mono">
            ₹{Number(metrics?.today_sales_total ?? 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Gross counter sales today</p>
        </div>
      </div>

      {/* 3. In-Store Retail POS Terminal Banner */}
      <div className="mt-8 rounded-3xl bg-gradient-to-r from-brand-deep-navy to-slate-900 text-white p-5 sm:p-6 shadow-card border border-brand-honey/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-honey/20 border border-brand-honey/40 text-brand-honey text-[11px] font-bold uppercase tracking-wider mb-2">
            <Receipt className="w-3 h-3" />
            <span>Sprint 9G Preview — Coming Next — Active POS Terminal</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            Offline Retail Point of Sale (POS) Terminal
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Create draft bills, add customer counter items, and finalize sales with atomic inventory deduction from
            the <strong className="text-brand-honey">{retailer?.assigned_city}</strong> regional warehouse. All transactions are published to Kafka and synced to OpenSearch.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/retailer/bills"
            className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 text-white text-xs font-bold transition-all"
          >
            Bill History
          </Link>
          <Link
            to="/retailer/pos"
            className="px-4 py-2.5 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-extrabold transition-all shadow-md flex items-center gap-2"
          >
            <span>Launch POS Terminal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3.2 Smart Inventory Alerts & Replenishment Monitor (Sprint 9H) */}
      <div className="mt-8 bg-white rounded-3xl border border-brand-border p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-base sm:text-lg font-black text-brand-navy flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Smart Warehouse Stock Alerts &amp; Early Warnings
              </h2>
            </div>
            <p className="text-xs text-brand-muted mt-1">
              Active multi-threshold inventory triggers for regional warehouse {retailer?.assigned_city}.
            </p>
          </div>
          <Link
            to="/retailer/notifications"
            className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-deep-navy hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Bell className="w-3.5 h-3.5 text-brand-honey" />
            <span>Open Notification Center</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-5">
          <Link
            to="/retailer/notifications"
            className="p-3.5 rounded-2xl bg-red-50/70 border border-red-200 hover:bg-red-50 transition-all text-left"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">Out of Stock</span>
            <p className="text-2xl font-black text-red-900 mt-1 font-mono">
              {metrics?.stock_alerts?.out_of_stock ?? 0}
            </p>
            <p className="text-[10px] text-red-600 mt-0.5 font-medium">0 units (Urgent)</p>
          </Link>

          <Link
            to="/retailer/notifications"
            className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200 hover:bg-orange-50 transition-all text-left"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Critical Stock</span>
            <p className="text-2xl font-black text-orange-900 mt-1 font-mono">
              {metrics?.stock_alerts?.critical_stock ?? 0}
            </p>
            <p className="text-[10px] text-orange-600 mt-0.5 font-medium">&le; 2 units</p>
          </Link>

          <Link
            to="/retailer/notifications"
            className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 hover:bg-amber-50 transition-all text-left"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Low Stock</span>
            <p className="text-2xl font-black text-amber-900 mt-1 font-mono">
              {metrics?.stock_alerts?.low_stock ?? 0}
            </p>
            <p className="text-[10px] text-amber-600 mt-0.5 font-medium">&le; 5 units</p>
          </Link>

          <Link
            to="/retailer/notifications"
            className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 hover:bg-blue-50 transition-all text-left"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Reorder Soon</span>
            <p className="text-2xl font-black text-blue-900 mt-1 font-mono">
              {metrics?.stock_alerts?.reorder_soon ?? 0}
            </p>
            <p className="text-[10px] text-blue-600 mt-0.5 font-medium">&le; 10 units</p>
          </Link>

          <Link
            to="/retailer/notifications"
            className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 hover:bg-purple-50 transition-all text-left col-span-2 sm:col-span-1"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Replenish Alerts</span>
            <p className="text-2xl font-black text-purple-900 mt-1 font-mono">
              {metrics?.stock_alerts?.bestseller_warnings ?? 0}
            </p>
            <p className="text-[10px] text-purple-600 mt-0.5 font-medium">&lt; 7 days run-out</p>
          </Link>
        </div>
      </div>

      {/* 3.3 Monthly Bestsellers & Sales Velocity (Sprint 9H) */}
      {data?.top_bestsellers && data.top_bestsellers.length > 0 && (
        <div className="mt-8 bg-white rounded-3xl border border-brand-border shadow-card overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-brand-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
                  Monthly Bestseller Velocity ({retailer?.assigned_city})
                </h2>
              </div>
              <p className="text-xs text-brand-muted mt-0.5">
                Combined online + counter sales velocity and projected stock run-out coverage.
              </p>
            </div>
            <Link
              to="/retailer/notifications"
              className="text-xs font-bold text-brand-navy hover:text-brand-honey flex items-center gap-1"
            >
              <span>View Alert Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-6">Rank &amp; Product</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6">Month Sales (Online / Counter)</th>
                  <th className="py-3.5 px-6">Sales Velocity</th>
                  <th className="py-3.5 px-6">Current Stock</th>
                  <th className="py-3.5 px-6">Stock Coverage</th>
                  <th className="py-3.5 px-6 text-right">Replenishment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.top_bestsellers.map((item) => (
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
                          Reorder Urgently (&lt; 7d)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Adequate Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3.5 Recent Store Bills (if any) */}
      {data?.recent_bills && data.recent_bills.length > 0 && (
        <div className="mt-8 bg-white rounded-3xl border border-brand-border shadow-card overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-brand-border flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
                Recent Store Counter Bills
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Latest offline transactions generated at this regional retail counter.
              </p>
            </div>
            <Link
              to="/retailer/bills"
              className="text-xs font-bold text-brand-navy hover:text-brand-honey flex items-center gap-1"
            >
              <span>View All Bills</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-brand-border text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_bills.map((b) => (
                  <tr key={b.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-navy">
                      <Link to={`/retailer/bills/${b.id}`} className="hover:underline">
                        {b.bill_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{b.item_count}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'FINALIZED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-navy">
                      ₹{Number(b.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        to={`/retailer/bills/${b.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-navy hover:text-white text-slate-700 font-bold transition-all text-[11px]"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Inventory Controls & Search Filter Bar */}
      <div className="mt-8 bg-white rounded-3xl border border-brand-border shadow-card overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              City Warehouse Inventory
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Live stock levels specifically allocated to the {retailer?.assigned_city} fulfillment hub.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-800"
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-700 bg-white"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Stock Level Filter */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as 'ALL' | 'LOW' | 'OUT')}
              className="px-3 py-2 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey text-slate-700 bg-white"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="LOW">Low Stock (&lt; 10 units)</option>
              <option value="OUT">Out of Stock (0 units)</option>
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3.5 px-6">Product Details</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Unit Price</th>
                <th className="py-3.5 px-6">City Stock</th>
                <th className="py-3.5 px-6">Stock Status</th>
                <th className="py-3.5 px-6 text-right">Last Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No products matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const stock = Number(item.city_stock) || 0;
                  const isLow = stock > 0 && stock < 10;
                  const isOut = stock === 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-10 h-10 rounded-xl object-cover bg-slate-100 border border-slate-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-brand-navy">{item.name}</p>
                            <p className="text-[10px] font-mono text-slate-400">{item.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">{item.category}</td>
                      <td className="py-3.5 px-6 font-bold text-brand-navy">
                        ₹{Number(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black ${
                            isOut
                              ? 'bg-red-100 text-red-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {stock} units
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        {isOut ? (
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="text-amber-700 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Low Stock Alert
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-400 text-[11px]">
                        {item.inventory_updated_at
                          ? new Date(item.inventory_updated_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Live'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
