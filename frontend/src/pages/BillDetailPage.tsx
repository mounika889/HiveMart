import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { OfflineBill, OfflineBillItem } from '../types/index.ts';
import { getRetailerBillById, getAdminBillById } from '../services/pos.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';

export const BillDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [bill, setBill] = useState<OfflineBill | null>(null);
  const [items, setItems] = useState<OfflineBillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBill = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data =
        user?.role === 'admin'
          ? await getAdminBillById(id)
          : await getRetailerBillById(id);

      setBill(data.bill);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve bill details.');
    } finally {
      setLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-20">
        <LoadingSpinner size="lg" message="Loading bill details..." />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-brand-navy">Bill Not Found or Inaccessible</h2>
        <p className="text-xs text-brand-muted mt-1 max-w-md mx-auto">
          {error || 'The requested offline bill could not be found or you do not have permission to view it.'}
        </p>
        <button
          type="button"
          onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/retailer/bills')}
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  const isFinalized = bill.status === 'FINALIZED';
  const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-left">
      {/* Top Nav Controls */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          to={user?.role === 'admin' ? '/admin/dashboard' : '/retailer/bills'}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-navy transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{user?.role === 'admin' ? 'Back to Admin Portal' : 'Back to Store Bills'}</span>
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          <span>Print Receipt</span>
        </button>
      </div>

      {/* Printable Receipt Card */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 sm:p-8 shadow-card printable-receipt">
        {/* Receipt Header */}
        <div className="border-b border-brand-border pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-brand-navy">
                Hive<span className="text-brand-honey">Mart</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-brand-deep-navy text-white text-[10px] font-bold uppercase">
                Retail Store
              </span>
            </div>
            <p className="text-xs text-brand-muted mt-1">
              Fulfillment Hub: <strong className="text-brand-navy">{bill.city}</strong>
            </p>
            <p className="text-xs text-brand-muted">
              Issued by:{' '}
              <strong className="text-brand-navy">{bill.retailer_name || 'Authorized Store Retailer'}</strong>
              {bill.retailer_email && <span className="text-slate-400"> ({bill.retailer_email})</span>}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-1 ${
                isFinalized
                  ? 'bg-emerald-100 text-emerald-800'
                  : bill.status === 'DRAFT'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {bill.status}
            </span>
            <p className="text-xs font-mono font-bold text-brand-navy">Bill #{bill.bill_number}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {new Date(bill.finalized_at || bill.created_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <div className="py-6 border-b border-brand-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                <th className="pb-2">Item Description</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={it.id || idx} className="py-2.5">
                  <td className="py-2.5 font-medium text-brand-navy">
                    <div>{it.product_name_snapshot}</div>
                    {it.category && <span className="text-[10px] text-brand-muted">{it.category}</span>}
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-700">{it.quantity}</td>
                  <td className="py-2.5 text-right font-mono text-slate-600">
                    ₹{Number(it.unit_price_snapshot).toFixed(2)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-brand-navy">
                    ₹{Number(it.line_total).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Payment Details */}
        <div className="pt-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="text-xs text-slate-600 max-w-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-bold text-brand-navy">Payment Method:</span>
              <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-brand-navy text-[11px]">
                {bill.payment_method}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Payment verified and collected at store counter. Centralized warehouse inventory in {bill.city} synchronized.
            </p>
            {bill.notes && (
              <p className="mt-2 text-[11px] text-slate-700 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                Notes: {bill.notes}
              </p>
            )}
            {bill.idempotency_key && (
              <p className="mt-1 text-[10px] font-mono text-slate-400">
                Tx Ref: {bill.idempotency_key}
              </p>
            )}
          </div>

          <div className="w-full sm:w-64 space-y-2 text-right">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Total Units:</span>
              <span className="font-bold text-slate-700">{totalUnits} units</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-700">₹{Number(bill.subtotal_amount).toFixed(2)}</span>
            </div>
            <div className="border-t border-brand-border pt-2 flex justify-between items-baseline">
              <span className="text-sm font-bold text-brand-navy">Grand Total:</span>
              <span className="text-xl font-extrabold text-brand-navy font-mono">
                ₹{Number(bill.total_amount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillDetailPage;
