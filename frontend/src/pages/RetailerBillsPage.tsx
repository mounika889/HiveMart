import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Store,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  ArrowRight,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { OfflineBill, OfflineBillStatus } from '../types/index.ts';
import { getRetailerBills } from '../services/pos.ts';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';

export const RetailerBillsPage: React.FC = () => {
  const [bills, setBills] = useState<OfflineBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | OfflineBillStatus>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBills, setTotalBills] = useState(0);

  const fetchBills = useCallback(async (targetPage = 1, status = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRetailerBills({
        page: targetPage,
        limit: 15,
        status: status === 'ALL' ? undefined : status,
      });
      setBills(res.bills);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalBills(res.pagination.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve bills.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBills(page, statusFilter);
  }, [fetchBills, page, statusFilter]);

  const handleStatusChange = (newStatus: 'ALL' | OfflineBillStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const getStatusBadge = (status: OfflineBillStatus) => {
    switch (status) {
      case 'FINALIZED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            FINALIZED
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            DRAFT
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-honey text-brand-navy text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Store className="w-3 h-3" />
              Retail Store
            </span>
            <span className="text-xs text-brand-muted">
              {totalBills} total recorded {totalBills === 1 ? 'bill' : 'bills'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-brand-navy tracking-tight">
            Store Invoices & Bills
          </h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Audit history of all offline retail bills, counter receipts, and status transitions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/retailer/pos"
            className="px-4 py-2 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-black transition-all shadow-sm flex items-center gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            <span>Launch POS Terminal</span>
          </Link>
          <Link
            to="/retailer/dashboard"
            className="px-3.5 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all shadow-sm"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Filters & Status Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-brand-border">
          {(['ALL', 'FINALIZED', 'DRAFT', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleStatusChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === tab
                  ? 'bg-white text-brand-navy shadow-sm'
                  : 'text-slate-600 hover:text-brand-navy'
              }`}
            >
              {tab === 'ALL' ? 'All Bills' : tab}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => fetchBills(page, statusFilter)}
          className="text-xs text-slate-500 hover:text-brand-navy flex items-center gap-1 font-semibold"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* 3. Bills Table */}
      <div className="mt-6 bg-white rounded-3xl border border-brand-border shadow-card overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="md" message="Loading store bills..." />
          </div>
        ) : bills.length === 0 ? (
          <div className="py-16 text-center text-brand-muted">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-brand-navy">No bills found</h3>
            <p className="text-xs text-slate-400 mt-1">
              {statusFilter !== 'ALL'
                ? `No bills currently match the status "${statusFilter}".`
                : 'No counter bills have been created yet. Launch the POS terminal to start billing.'}
            </p>
            {statusFilter === 'ALL' && (
              <Link
                to="/retailer/pos"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-honey text-brand-navy text-xs font-extrabold shadow-sm"
              >
                <span>Open POS Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-brand-border text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">City Hub</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-navy">
                      <Link
                        to={`/retailer/bills/${b.id}`}
                        className="hover:text-brand-honey hover:underline flex items-center gap-1"
                      >
                        {b.bill_number}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-honey" />
                        {b.city}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                      {b.item_count ?? '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                        {b.payment_method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(b.status)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-brand-navy">
                      ₹{Number(b.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
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
        )}

        {/* 4. Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-brand-border flex items-center justify-between text-xs text-brand-muted">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-brand-border bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-brand-border bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetailerBillsPage;
