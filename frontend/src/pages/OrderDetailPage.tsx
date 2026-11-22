import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  Calendar,
  MapPin,
  ArrowLeft,
  ShoppingBag,
  ShieldCheck,
} from 'lucide-react';
import { getOrderById } from '../services/order.ts';
import { Order } from '../types/index.ts';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';
import { Badge } from '../components/common/Badge.tsx';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await getOrderById(id);
      setOrder(data);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Unable to retrieve order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  const formatPrice = (val: string | number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  if (loading) {
    return (
      <div className="py-24 max-w-7xl mx-auto px-4">
        <LoadingSpinner message="Retrieving order details from PostgreSQL..." size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <ErrorState
          title="Order Not Found"
          message={error || 'The requested order could not be found or you do not have permission to view it.'}
          onRetry={fetchOrder}
        />
        <div className="text-center mt-6">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>View All Orders</span>
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(order.created_at).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* 1. Order Confirmed Banner */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-3xl p-6 sm:p-8 shadow-card flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider block">
              Order Confirmed & Committed
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Thank You for Your Order!
            </h1>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Your order has been recorded with atomic row locking in PostgreSQL.
            </p>
          </div>
        </div>

        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold transition-colors shadow-sm shrink-0"
        >
          <span>Continue Shopping</span>
        </Link>
      </div>

      {/* 2. Order Metadata Card */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs text-brand-muted block">Order Identifier</span>
            <span className="font-mono text-xs sm:text-sm font-bold text-brand-navy select-all break-all">
              {order.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="success" size="md">
              {order.status}
            </Badge>
            <Badge variant="navy" size="md">
              {order.city}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-brand-border flex items-start gap-3">
            <Calendar className="w-4 h-4 text-brand-honey shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-semibold text-brand-muted uppercase block">Date Placed</span>
              <span className="font-bold text-brand-navy">{formattedDate}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-brand-border flex items-start gap-3">
            <MapPin className="w-4 h-4 text-brand-honey shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-semibold text-brand-muted uppercase block">Fulfillment City</span>
              <span className="font-bold text-brand-navy">{order.city} Hub</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-brand-border flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-semibold text-brand-muted uppercase block">Transactional Outbox</span>
              <span className="font-bold text-emerald-700">Kafka Event Emitted</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Purchased Items Breakdown */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-brand-navy uppercase tracking-wider pb-3 border-b border-slate-100">
          <span>Items Ordered</span>
          <span>{order.items?.length || 0} Products</span>
        </div>

        <div className="divide-y divide-slate-100">
          {order.items?.map((item) => (
            <div key={item.id || item.order_item_id || item.product_id} className="py-4 flex items-center justify-between text-xs gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.product_name} className="w-full h-full object-contain" />
                  ) : (
                    <Package className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-brand-navy block truncate">{item.product_name}</span>
                  <span className="text-slate-500 text-[11px]">
                    Qty: {item.quantity} × {formatPrice(item.unit_price)}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-extrabold text-brand-navy text-sm">{formatPrice(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Total Summary */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-base font-black text-brand-navy">
          <span>Total Amount:</span>
          <span>{formatPrice(order.total_amount)}</span>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-navy font-semibold py-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>View All Orders</span>
        </Link>
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-deep-navy transition-colors shadow-sm"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-brand-honey" />
          <span>Shop More Products</span>
        </Link>
      </div>
    </div>
  );
};
