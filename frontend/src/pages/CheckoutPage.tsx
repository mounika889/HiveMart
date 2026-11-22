import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  User,
  AlertTriangle,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useCart } from '../hooks/useCart.ts';
import { useCity } from '../context/CityContext.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { placeOrder } from '../services/order.ts';
import { SupportedCity } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';

interface PendingCheckoutRecord {
  idempotencyKey: string;
  city: string;
  cartFingerprint: string;
  attemptState: 'idle' | 'submitting' | 'uncertain';
  timestamp: number;
}

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, totalItems, totalAmount, refreshCart, loading: cartLoading } = useCart();
  const { selectedCity, setSelectedCity, supportedCities } = useCity();
  const { user } = useAuth();

  const items = useMemo(() => cart?.items || [], [cart]);
  const hasInsufficientStock = items.some((item) => item.is_available_in_city === false);

  // Deterministic cart fingerprint: product_id:quantity pairs sorted
  const cartFingerprint = useMemo(() => {
    return items
      .map((item) => `${item.product_id}:${item.quantity}`)
      .sort()
      .join('|');
  }, [items]);

  const storageKey = user?.id ? `hivemart_pending_checkout_${user.id}` : 'hivemart_pending_checkout_guest';

  // Manage stable idempotency key with cross-refresh retry safety
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed: PendingCheckoutRecord = JSON.parse(stored);
        if (parsed.idempotencyKey) {
          return parsed.idempotencyKey;
        }
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
    return crypto.randomUUID ? crypto.randomUUID() : `hm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);
  const [isUncertainRetry, setIsUncertainRetry] = useState(false);

  // Synchronize idempotency key with city and cart modifications
  useEffect(() => {
    if (!cartFingerprint) return;

    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed: PendingCheckoutRecord = JSON.parse(stored);
        // If the pending checkout matches the exact city and cart content, reuse the key
        if (parsed.city === selectedCity && parsed.cartFingerprint === cartFingerprint) {
          setIdempotencyKey(parsed.idempotencyKey);
          if (parsed.attemptState === 'uncertain') {
            setIsUncertainRetry(true);
            setNetworkWarning(
              'Your previous checkout attempt encountered an uncertain network interruption. Retrying will safely verify your order without creating duplicates or double-deducting stock.'
            );
          }
          return;
        }
      }

      // If city or cart items changed, generate a new idempotency key for this distinct logical order
      const newKey = crypto.randomUUID ? crypto.randomUUID() : `hm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setIdempotencyKey(newKey);
      setIsUncertainRetry(false);
      setNetworkWarning(null);

      const newRecord: PendingCheckoutRecord = {
        idempotencyKey: newKey,
        city: selectedCity,
        cartFingerprint,
        attemptState: 'idle',
        timestamp: Date.now(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(newRecord));
    } catch {
      // SessionStorage fallback
    }
  }, [selectedCity, cartFingerprint, storageKey]);

  const formatPrice = (val: string | number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  const handlePlaceOrder = async () => {
    if (submitting) return;

    if (items.length === 0) {
      setErrorMessage('Your cart is empty. Please add items before placing an order.');
      return;
    }

    if (hasInsufficientStock) {
      setErrorMessage(`Some items in your cart exceed warehouse stock in ${selectedCity}. Please adjust your cart.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setNetworkWarning(null);

    // Record submission state
    try {
      const record: PendingCheckoutRecord = {
        idempotencyKey,
        city: selectedCity,
        cartFingerprint,
        attemptState: 'submitting',
        timestamp: Date.now(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(record));
    } catch {
      // Non-critical
    }

    try {
      // Send atomic checkout request using the persistent idempotencyKey
      const response = await placeOrder({
        city: selectedCity,
        idempotencyKey,
      });

      // Clear pending retry metadata on confirmed success
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Non-critical
      }

      // Refresh cart to reflect PostgreSQL cart clearing
      await refreshCart();

      // Navigate to confirmed order page
      navigate(`/orders/${response.order.id}`, { replace: true });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Checkout could not be completed.';

      // If it looks like a network timeout/disconnect, preserve key and mark state uncertain
      if (
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('timeout')
      ) {
        setIsUncertainRetry(true);
        setNetworkWarning(
          "We couldn't confirm the order result due to a network interruption. Please retry — your idempotency key is preserved to ensure you are not double-charged or issued duplicate orders."
        );
        try {
          const record: PendingCheckoutRecord = {
            idempotencyKey,
            city: selectedCity,
            cartFingerprint,
            attemptState: 'uncertain',
            timestamp: Date.now(),
          };
          sessionStorage.setItem(storageKey, JSON.stringify(record));
        } catch {
          // Non-critical
        }
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
          Secure Checkout
        </h1>
        <p className="text-xs text-brand-muted mt-1">
          Review your delivery destination and confirm your order.
        </p>
      </div>

      {/* Network Warning Banner */}
      {networkWarning && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold">Pending Order Verification</h4>
            <p className="mt-0.5 text-amber-800 leading-relaxed">{networkWarning}</p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Checkout Details */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Customer Summary */}
          <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-card space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-navy uppercase tracking-wider">
              <User className="w-4 h-4 text-brand-honey" />
              <span>1. Customer Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-brand-border">
                <span className="text-[11px] font-semibold text-brand-muted uppercase block">Customer Name</span>
                <span className="font-bold text-brand-navy">{user?.name}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-brand-border">
                <span className="text-[11px] font-semibold text-brand-muted uppercase block">Email Address</span>
                <span className="font-bold text-brand-navy truncate block">{user?.email}</span>
              </div>
            </div>
          </div>

          {/* 2. Delivery Destination */}
          <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-navy uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-brand-honey" />
                <span>2. Delivery Destination</span>
              </div>
              <Badge variant="warning">{selectedCity}</Badge>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-brand-navy block">Warehouse Hub: {selectedCity}</span>
                <span className="text-brand-muted text-[11px]">
                  Inventory is allocated from our {selectedCity} fulfillment distribution facility.
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {supportedCities.map((city: SupportedCity) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSelectedCity(city)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                      selectedCity === city
                        ? 'bg-brand-navy text-white shadow-sm'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Order Items Review */}
          <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-brand-navy uppercase tracking-wider">
              <span>3. Order Items Review</span>
              <span className="text-brand-muted normal-case font-medium">{totalItems} units</span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-xs text-brand-muted">
                Your cart is empty. <Link to="/products" className="text-brand-navy font-bold hover:underline">Add products</Link> to checkout.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.product_id} className="py-3 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-brand-navy block truncate">{item.product_name}</span>
                      <span className="text-slate-500 text-[11px]">
                        Qty: {item.quantity} × {formatPrice(item.unit_price)}
                      </span>
                    </div>
                    <span className="font-bold text-brand-navy shrink-0">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Availability Notice */}
          <div className="p-4 rounded-2xl bg-brand-soft-honey/40 border border-amber-200/60 flex items-start gap-3 text-xs text-brand-text">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-brand-navy block">Atomic Inventory Guarantee</span>
              <span className="text-[11px] text-slate-600 leading-relaxed">
                Stock is verified and row-locked using PostgreSQL <code>SELECT FOR UPDATE</code> during order placement.
                Availability is authoritative at checkout commit.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Summary & Place Order CTA */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-brand-border p-6 shadow-card space-y-6 sticky top-24">
          <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider pb-3 border-b border-slate-100">
            Order Confirmation
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Items Total ({totalItems} units):</span>
              <span className="font-bold text-brand-navy">{formatPrice(totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Delivery Hub:</span>
              <span className="font-bold text-brand-navy">{selectedCity}</span>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-base font-extrabold text-brand-navy">
              <span>Order Total:</span>
              <span>{formatPrice(totalAmount)}</span>
            </div>
          </div>

          {/* Idempotency footprint */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-400 font-mono truncate">
            Request Key: {idempotencyKey.substring(0, 16)}...
          </div>

          {/* Place Order Button */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              data-testid="place-order-btn"
              onClick={handlePlaceOrder}
              disabled={submitting || items.length === 0 || hasInsufficientStock || cartLoading}
              className="w-full py-4 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy font-black text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
                  <span>Processing Atomic Checkout...</span>
                </>
              ) : isUncertainRetry ? (
                <>
                  <RefreshCw className="w-4 h-4 text-brand-navy" />
                  <span>Retry Placement (Protected Key)</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Place Order ({formatPrice(totalAmount)})</span>
                </>
              )}
            </button>

            <Link
              to="/cart"
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-brand-muted hover:text-brand-navy font-semibold py-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Cart</span>
            </Link>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Outbox event committed atomically with order</span>
          </div>
        </div>
      </div>
    </div>
  );
};
