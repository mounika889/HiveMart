import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  PackageCheck,
  AlertTriangle,
  XCircle,
  ShoppingBag,
  Plus,
  Check,
  Loader2,
} from 'lucide-react';
import { Product } from '../../types/index.ts';
import { Badge } from './Badge.tsx';
import { useCart } from '../../hooks/useCart.ts';
import { useAuth } from '../../hooks/useAuth.ts';

interface ProductCardProps {
  product: Product;
  selectedCity: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, selectedCity }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem, mutationPending } = useCart();
  const { isAuthenticated } = useAuth();

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(product.price));

  // Determine stock status for selected city
  const cityStock = typeof product.city_stock === 'number' ? product.city_stock : null;
  const isOutOfStock = cityStock !== null && cityStock <= 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }

    if (isOutOfStock || adding) return;

    setAdding(true);
    try {
      await addItem(product.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      console.warn('Failed to add to cart:', err);
    } finally {
      setAdding(false);
    }
  };

  const renderStockBadge = () => {
    if (cityStock === null) {
      return (
        <Badge variant="neutral" size="sm">
          <MapPin className="w-3 h-3 text-brand-muted" />
          <span>{selectedCity}</span>
        </Badge>
      );
    }

    if (cityStock > 3) {
      return (
        <Badge variant="success" size="sm">
          <PackageCheck className="w-3 h-3 text-emerald-600" />
          <span>In Stock in {selectedCity}</span>
        </Badge>
      );
    }

    if (cityStock > 0 && cityStock <= 3) {
      return (
        <Badge variant="warning" size="sm">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>Only {cityStock} left</span>
        </Badge>
      );
    }

    return (
      <Badge variant="danger" size="sm">
        <XCircle className="w-3 h-3 text-rose-600" />
        <span>Out of Stock</span>
      </Badge>
    );
  };

  return (
    <div className="group bg-white rounded-2xl border border-brand-border p-4 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between h-full">
      {/* Top: Category & Stock Badge */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-brand-muted truncate max-w-[140px]">
            {product.category}
          </span>
          {renderStockBadge()}
        </div>

        {/* Product Image with Fallback */}
        <Link
          to={`/products/${product.id}`}
          className="block aspect-square w-full rounded-xl bg-slate-50 overflow-hidden relative mb-4 border border-slate-100 flex items-center justify-center group-hover:opacity-95 transition-opacity"
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  const fallback = parent.querySelector('.image-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            className={`image-fallback ${product.image_url ? 'hidden' : 'flex'} flex-col items-center justify-center p-4 text-center text-slate-300`}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-brand-honey mb-2">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <span className="text-xs font-medium text-slate-400">HiveMart Genuine</span>
          </div>
        </Link>

        {/* Product Title */}
        <Link to={`/products/${product.id}`}>
          <h3
            className="text-sm font-semibold text-brand-text line-clamp-2 hover:text-brand-navy transition-colors mb-2 min-h-[2.5rem]"
            title={product.name}
          >
            {product.name}
          </h3>
        </Link>
      </div>

      {/* Bottom: Price & Quick Actions */}
      <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
        <div>
          <span className="text-xs text-brand-muted block">Price</span>
          <span className="text-lg font-bold text-brand-navy tracking-tight">{formattedPrice}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding || mutationPending}
            className={`p-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center ${
              added
                ? 'bg-emerald-600 text-white'
                : isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-brand-navy hover:bg-brand-deep-navy text-white hover:text-brand-honey'
            }`}
            title={
              isOutOfStock
                ? `Out of stock in ${selectedCity}`
                : isAuthenticated
                ? 'Add to Cart'
                : 'Sign in to add to cart'
            }
          >
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand-honey" />
            ) : added ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>

          <Link
            to={`/products/${product.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-brand-soft-honey text-brand-navy text-xs font-semibold border border-brand-border hover:border-brand-honey/40 transition-all duration-200"
            title="View product details"
          >
            <span>Details</span>
            <ArrowRight className="w-3.5 h-3.5 text-brand-muted group-hover:text-brand-navy group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>
    </div>
  );
};
