import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Plus,
  Minus,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Package,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useCart } from '../hooks/useCart.ts';
import { useCity } from '../context/CityContext.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { SupportedCity } from '../types/index.ts';
import { Badge } from '../components/common/Badge.tsx';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, totalItems, totalAmount, loading, mutationPending, updateQuantity, removeItem, clear, error, clearError } = useCart();
  const { selectedCity, setSelectedCity, supportedCities } = useCity();
  const { isAuthenticated } = useAuth();

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const formatPrice = (val: string | number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  const handleClearCart = async () => {
    try {
      await clear();
      setConfirmClearOpen(false);
    } catch {
      // Handled by context
    }
  };

  // Check if any items have insufficient stock in the selected city
  const hasInsufficientStock = cart?.items?.some((item) => item.is_available_in_city === false);

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl border border-brand-border p-10 shadow-card">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-brand-honey flex items-center justify-center mx-auto mb-5 shadow-sm">
            <ShoppingBag className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight mb-2">
            Sign In to View Your Cart
          </h1>
          <p className="text-xs text-brand-muted mb-8 max-w-md mx-auto">
            Your shopping cart is securely synchronized with your customer account in PostgreSQL.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/login"
              state={{ from: { pathname: '/cart' } }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors shadow-sm"
            >
              Sign In to Your Account
            </Link>
            <Link
              to="/products"
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-colors"
            >
              Browse Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading && (!cart || !cart.items)) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-honey mx-auto mb-3" />
        <p className="text-sm font-semibold text-brand-muted">Loading your persistent cart...</p>
      </div>
    );
  }

  const items = cart?.items || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
            Your Shopping Cart
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Review your picks before checkout.
          </p>
        </div>

        {/* Selected City Switcher on Cart Page */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border border-brand-border text-xs shadow-subtle flex-wrap">
          <MapPin className="w-4 h-4 text-brand-honey shrink-0" />
          <span className="text-brand-muted">Delivering to:</span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value as SupportedCity)}
            className="font-bold text-brand-navy bg-transparent focus:outline-none cursor-pointer"
          >
            {supportedCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-700 hover:text-red-900 font-bold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Insufficient Stock Warning Banner */}
      {hasInsufficientStock && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Inventory Alert for {selectedCity}</h4>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              One or more items in your cart exceed available warehouse stock in {selectedCity}.
              Please adjust item quantities or select a different city before proceeding to checkout.
            </p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-white rounded-3xl border border-brand-border p-12 sm:p-16 text-center shadow-card max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-amber-50 text-brand-honey flex items-center justify-center mx-auto mb-5 shadow-sm">
            <ShoppingBag className="w-10 h-10" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy tracking-tight mb-2">
            Your Cart is Empty
          </h2>
          <p className="text-xs text-brand-muted mb-8 max-w-md mx-auto">
            You haven't added any products to your cart yet. Explore our catalog of verified Indian retail essentials!
          </p>

          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors shadow-sm"
          >
            <span>Explore Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        /* Items Grid & Summary */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Cart Items List */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-brand-border p-6 shadow-card divide-y divide-slate-100">
            <div className="pb-4 flex items-center justify-between text-xs text-brand-muted font-semibold uppercase tracking-wider">
              <span>Items ({totalItems})</span>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="text-red-600 hover:text-red-700 font-bold transition-colors normal-case"
              >
                Clear Cart
              </button>
            </div>

            {items.map((item) => {
              const itemOutOfStock = item.is_available_in_city === false;

              return (
                <div
                  key={item.product_id}
                  className={`py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                    itemOutOfStock ? 'bg-amber-50/40 -mx-6 px-6 rounded-2xl' : ''
                  }`}
                >
                  {/* Product Details & Image */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider block">
                        {item.category}
                      </span>
                      <Link
                        to={`/products/${item.product_id}`}
                        className="text-xs sm:text-sm font-bold text-brand-navy hover:text-brand-honey line-clamp-1 transition-colors"
                        title={item.product_name}
                      >
                        {item.product_name}
                      </Link>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">
                        {formatPrice(item.unit_price)} each
                      </div>

                      {/* Stock availability indicator */}
                      {typeof item.city_stock === 'number' && (
                        <div className="mt-1">
                          {item.city_stock >= item.quantity ? (
                            <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>In Stock in {selectedCity} ({item.city_stock} available)</span>
                            </span>
                          ) : item.city_stock > 0 ? (
                            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Only {item.city_stock} available in {selectedCity} (Requested: {item.quantity})</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Out of stock in {selectedCity}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantity & Subtotal Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0">
                    {/* Quantity Stepper */}
                    <div className="flex items-center rounded-xl border border-brand-border bg-slate-50 p-1">
                      <button
                        type="button"
                        disabled={mutationPending}
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-white text-brand-navy flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-subtle"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-xs font-bold text-brand-navy">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={mutationPending}
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-white text-brand-navy flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-subtle"
                        title="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right min-w-[80px]">
                      <span className="text-xs text-brand-muted block sm:hidden">Total</span>
                      <span className="text-sm sm:text-base font-extrabold text-brand-navy">
                        {formatPrice(item.subtotal)}
                      </span>
                    </div>

                    {/* Remove Item */}
                    <button
                      type="button"
                      disabled={mutationPending}
                      onClick={() => removeItem(item.product_id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Clear Cart Confirmation Dialog */}
            {confirmClearOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="clear-cart-title"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setConfirmClearOpen(false);
                }}
                className="pt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
              >
                <span id="clear-cart-title" className="text-xs font-bold text-red-800">
                  Are you sure you want to remove all items from your cart?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearCart}
                    disabled={mutationPending}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    Yes, Clear Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-white text-slate-700 text-xs font-semibold border border-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Order Summary Sidebar */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-brand-border p-6 shadow-card space-y-6 sticky top-24">
            <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider pb-3 border-b border-slate-100">
              Order Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Items ({totalItems}):</span>
                <span className="font-bold text-brand-navy">{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery Hub:</span>
                <Badge variant="navy" size="sm">{selectedCity}</Badge>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm sm:text-base font-extrabold text-brand-navy">
                <span>Order Total:</span>
                <span>{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                disabled={items.length === 0 || mutationPending || hasInsufficientStock}
                className="w-full py-3.5 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                to="/products"
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-brand-muted hover:text-brand-navy font-semibold py-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Continue Shopping</span>
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>PostgreSQL row locking prevents overselling</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
