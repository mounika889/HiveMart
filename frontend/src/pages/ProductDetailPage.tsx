import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShoppingBag,
  Sparkles,
  Share2,
  Check,
  Building2,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react';
import { getProductById, getRelatedProducts } from '../services/api.ts';
import { Product, SupportedCity } from '../types/index.ts';
import { useCity } from '../context/CityContext.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useCart } from '../hooks/useCart.ts';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { ProductCard } from '../components/common/ProductCard.tsx';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCity, setSelectedCity, supportedCities } = useCity();
  const { isAuthenticated } = useAuth();
  const { addItem, mutationPending } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Cart addition state
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const loadProductData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await getProductById(id);
      setProduct(data);

      if (data.category) {
        const related = await getRelatedProducts(data.category, data.id, selectedCity, 4);
        setRelatedProducts(related);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Product details not available');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setQuantity(1);
    setAddedSuccess(false);
    setCartError(null);
  }, [id, selectedCity]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Determine stock in currently selected city
  const selectedCityInventory = product?.inventory?.find(
    (inv) => inv.city.toLowerCase() === selectedCity.toLowerCase()
  );
  const currentCityStock = selectedCityInventory?.quantity ?? 0;
  const isOutOfStock = currentCityStock <= 0;

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }

    if (isOutOfStock || !product) return;

    setAddingToCart(true);
    setCartError(null);

    try {
      await addItem(product.id, quantity);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    } catch (err: any) {
      setCartError(err instanceof Error ? err.message : 'Failed to add item to cart.');
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 max-w-7xl mx-auto px-4">
        <LoadingSpinner message="Fetching verified product specifications..." size="lg" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <ErrorState
          title="Product Not Found"
          message={error || 'The requested product could not be found or may have been deactivated.'}
          onRetry={loadProductData}
        />
        <div className="text-center mt-6">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to All Products</span>
          </Link>
        </div>
      </div>
    );
  }

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(product.price));

  const totalStock = product.inventory?.reduce((sum, i) => sum + i.quantity, 0) ?? product.total_stock ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
      {/* 1. BREADCRUMBS & SHARE ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-brand-muted flex-wrap">
          <Link to="/" className="hover:text-brand-navy font-medium">
            Home
          </Link>
          <span>/</span>
          <Link to="/products" className="hover:text-brand-navy font-medium">
            Products
          </Link>
          <span>/</span>
          <Link
            to={`/products?category=${encodeURIComponent(product.category)}`}
            className="hover:text-brand-navy font-medium"
          >
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-brand-navy font-bold truncate max-w-xs">{product.name}</span>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-brand-border text-xs font-semibold text-brand-text hover:bg-slate-50 transition-colors self-start sm:self-auto shadow-subtle"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Share Product</span>
            </>
          )}
        </button>
      </div>

      {/* 2. PRODUCT HERO DETAILS CARD */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 sm:p-10 shadow-card">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Product Image */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full aspect-square rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-6 overflow-hidden relative group">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent) {
                      const fallback = parent.querySelector('.detail-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className={`detail-fallback ${product.image_url ? 'hidden' : 'flex'} flex-col items-center justify-center text-slate-300`}
              >
                <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center text-brand-honey mb-3">
                  <Package className="w-10 h-10" />
                </div>
                <span className="text-xs font-semibold text-slate-400">HiveMart Genuine Product</span>
              </div>
            </div>
          </div>

          {/* Right Column: Information & Stock */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Link to={`/products?category=${encodeURIComponent(product.category)}`}>
                  <Badge variant="honey" size="sm">
                    {product.category}
                  </Badge>
                </Link>
                <Badge variant="navy" size="sm">
                  Verified SKU
                </Badge>
                {totalStock > 0 && (
                  <Badge variant="neutral" size="sm">
                    National Stock: {totalStock} units
                  </Badge>
                )}
              </div>

              <h1 className="text-xl sm:text-3xl font-extrabold text-brand-navy tracking-tight leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Price Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 inline-block min-w-[220px]">
              <span className="text-xs text-brand-muted block font-medium">Standard Retail Price</span>
              <span className="text-2xl sm:text-3xl font-black text-brand-navy tracking-tight">
                {formattedPrice}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Inclusive of all local GST taxes</span>
            </div>

            {/* Active City Inventory Status Card */}
            <div className="rounded-2xl border border-brand-border p-5 bg-white space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-brand-navy flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-brand-honey" />
                  <span>Availability in <strong className="text-brand-navy font-black">{selectedCity}</strong>:</span>
                </span>

                {currentCityStock > 3 ? (
                  <Badge variant="success" size="md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>In Stock ({currentCityStock} available)</span>
                  </Badge>
                ) : currentCityStock > 0 ? (
                  <Badge variant="warning" size="md">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Low Stock (Only {currentCityStock} remaining)</span>
                  </Badge>
                ) : (
                  <Badge variant="danger" size="md">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Out of Stock in {selectedCity}</span>
                  </Badge>
                )}
              </div>

              <p className="text-[11px] text-brand-muted leading-relaxed">
                Stock is verified and row-locked in PostgreSQL during checkout to prevent overselling.
              </p>

              {/* City Switcher Row */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-500">Check another city:</span>
                {supportedCities.map((city: SupportedCity) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSelectedCity(city)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                      selectedCity === city
                        ? 'bg-brand-honey text-brand-navy'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">
                Product Description
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* 5-City National Hub Inventory Table */}
            {product.inventory && product.inventory.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-navy uppercase tracking-wider mb-3">
                  <Building2 className="w-3.5 h-3.5 text-brand-honey" />
                  <span>National Distribution Centers (5 Metro Hubs)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {product.inventory.map((inv) => {
                    const isCurrent = inv.city.toLowerCase() === selectedCity.toLowerCase();
                    return (
                      <button
                        key={inv.city}
                        type="button"
                        onClick={() => setSelectedCity(inv.city as SupportedCity)}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          isCurrent
                            ? 'border-brand-honey bg-brand-soft-honey/60 font-bold text-brand-navy shadow-sm'
                            : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <div className="text-[11px] text-slate-500 truncate flex items-center justify-center gap-1">
                          {isCurrent && <MapPin className="w-3 h-3 text-brand-honey" />}
                          <span>{inv.city}</span>
                        </div>
                        <div className="font-extrabold text-sm sm:text-base mt-1">
                          {inv.quantity}
                        </div>
                        <span className="text-[10px] text-brand-muted">
                          {inv.quantity > 0 ? 'units' : 'out of stock'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add to Cart Section (Sprint 9D Live) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              {cartError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {cartError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Quantity Controls */}
                {!isOutOfStock && (
                  <div className="flex items-center rounded-2xl border border-brand-border bg-slate-50 p-1">
                    <button
                      type="button"
                      disabled={quantity <= 1 || addingToCart}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-xl bg-white text-brand-navy flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-subtle transition-all"
                      title="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-xs font-bold text-brand-navy">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={quantity >= currentCityStock || addingToCart}
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-9 h-9 rounded-xl bg-white text-brand-navy flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-subtle transition-all"
                      title="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Add to Cart Button */}
                <button
                  type="button"
                  data-testid="add-to-cart-btn"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || addingToCart || mutationPending}
                  className={`w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                    addedSuccess
                      ? 'bg-emerald-600 text-white'
                      : isOutOfStock
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-brand-navy hover:bg-brand-deep-navy text-white hover:text-brand-honey'
                  }`}
                >
                  {addingToCart ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-brand-honey" />
                      <span>Adding to Cart...</span>
                    </>
                  ) : addedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Added to Cart!</span>
                    </>
                  ) : isOutOfStock ? (
                    <>
                      <XCircle className="w-4 h-4 text-slate-400" />
                      <span>Out of Stock in {selectedCity}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4 text-brand-honey" />
                      <span>{isAuthenticated ? 'Add to Cart' : 'Sign In to Add to Cart'}</span>
                    </>
                  )}
                </button>

                {addedSuccess && (
                  <Link
                    to="/cart"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-2xl bg-brand-honey hover:bg-amber-400 text-xs font-bold text-brand-navy transition-colors shadow-sm"
                  >
                    <span>View Cart</span>
                  </Link>
                )}

                <Link
                  to="/products"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-2xl border border-brand-border bg-white hover:bg-slate-50 text-xs font-bold text-brand-navy transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Browse Products</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RELATED PRODUCTS IN SAME CATEGORY */}
      {relatedProducts.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1 text-xs font-bold text-brand-honey uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>More Choices</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy tracking-tight">
                Related in {product.category}
              </h2>
            </div>
            <Link
              to={`/products?category=${encodeURIComponent(product.category)}`}
              className="text-xs font-bold text-brand-navy hover:text-brand-honey inline-flex items-center gap-1 transition-colors"
            >
              <span>View All {product.category}</span>
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {relatedProducts.map((relProduct) => (
              <ProductCard
                key={relProduct.id}
                product={relProduct}
                selectedCity={selectedCity}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
