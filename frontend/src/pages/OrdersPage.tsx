import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { getOrders } from '../services/order.ts';
import { OrderSummary } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve order history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const formatPrice = (val: string | number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  if (loading) {
    return (
      <div className="py-24 max-w-4xl mx-auto px-4">
        <LoadingSpinner message="Fetching your confirmed orders..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <ErrorState
          title="Failed to Load Orders"
          message={error}
          onRetry={fetchOrders}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
          Your Order History
        </h1>
        <p className="text-xs text-brand-muted mt-1">
          Review past orders and verified fulfillment receipts.
        </p>
      </div>

      {orders.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-brand-border p-12 sm:p-16 text-center shadow-card max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy tracking-tight mb-2">
            No Orders Yet
          </h2>
          <p className="text-xs text-brand-muted mb-8 max-w-md mx-auto">
            You haven't placed any orders with this customer account yet. Browse our multi-city catalog!
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors shadow-sm"
          >
            <span>Start Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-4">
          {orders.map((order) => {
            const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-brand-border p-6 shadow-card hover:shadow-card-hover transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="success" size="sm">
                      {order.status}
                    </Badge>
                    <Badge variant="navy" size="sm">
                      {order.city} Hub
                    </Badge>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-brand-muted">{formattedDate}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-brand-muted font-mono block">
                      Order #{order.id}
                    </span>
                    <span className="text-base font-extrabold text-brand-navy mt-0.5 block">
                      {formatPrice(order.total_amount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <Link
                    to={`/orders/${order.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-50 hover:bg-brand-soft-honey text-brand-navy text-xs font-bold border border-brand-border transition-colors shadow-subtle"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-4 h-4 text-brand-muted" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
