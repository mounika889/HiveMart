import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Search,
  ShieldCheck,
  PackageCheck,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Tv,
  Shirt,
  Home as HomeIcon,
  Sparkle,
  Apple,
  Dumbbell,
  CheckCircle2,
} from 'lucide-react';
import { useCity } from '../context/CityContext.tsx';
import { getCategories, getProducts } from '../services/api.ts';
import { CategoryInfo, Product, SupportedCity } from '../types/index.ts';
import { ProductCard } from '../components/common/ProductCard.tsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';

// Mapping category names to corresponding Lucide icons & styling
const getCategoryIcon = (categoryName: string) => {
  const lower = categoryName.toLowerCase();
  if (lower.includes('electronic')) return <Tv className="w-6 h-6 text-indigo-600" />;
  if (lower.includes('fashion')) return <Shirt className="w-6 h-6 text-pink-600" />;
  if (lower.includes('home') || lower.includes('kitchen')) return <HomeIcon className="w-6 h-6 text-amber-600" />;
  if (lower.includes('beauty') || lower.includes('care')) return <Sparkle className="w-6 h-6 text-purple-600" />;
  if (lower.includes('grocer')) return <Apple className="w-6 h-6 text-emerald-600" />;
  if (lower.includes('sport') || lower.includes('fitness')) return <Dumbbell className="w-6 h-6 text-orange-600" />;
  return <ShoppingBag className="w-6 h-6 text-brand-honey" />;
};

export const HomePage: React.FC = () => {
  const { selectedCity, setSelectedCity, supportedCities } = useCity();

  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);

  // Load Categories once on mount
  useEffect(() => {
    let active = true;
    const loadCategoriesData = async () => {
      try {
        const data = await getCategories();
        if (active) {
          setCategories(data);
          setLoadingCategories(false);
        }
      } catch (err) {
        console.warn('Failed to load categories:', err);
        if (active) setLoadingCategories(false);
      }
    };
    loadCategoriesData();
    return () => {
      active = false;
    };
  }, []);

  // Load Featured Products whenever selected city changes
  const loadFeaturedProducts = async () => {
    setLoadingProducts(true);
    setProductError(null);
    try {
      const data = await getProducts({
        page: 1,
        limit: 8,
        city: selectedCity,
      });
      setProducts(data.products);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'Failed to load featured products');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadFeaturedProducts();
  }, [selectedCity]);

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* ======================================================== */}
      {/* SECTION 1: HERO BANNER */}
      {/* ======================================================== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-navy via-brand-navy to-brand-deep-navy text-white pt-8 pb-16 sm:pt-14 sm:pb-24">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-honey/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* City Context Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-brand-honey/30 text-xs text-brand-honey backdrop-blur-sm">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>Showing stock for <strong className="text-white font-bold">{selectedCity}</strong></span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
                Everything You Love,{' '}
                <span className="text-brand-honey block sm:inline">All in One Hive.</span>
              </h1>

              {/* Subheading */}
              <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Discover your favorites, shop with confidence, and find what's available in your city.
                Real inventory, guaranteed checkout, and zero guesswork.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                <Link
                  to="/products"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-sm font-bold shadow-lg shadow-brand-honey/20 transition-all hover:-translate-y-0.5"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Shop Now</span>
                </Link>

                <a
                  href="#categories"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/10 hover:border-white/20 transition-all"
                >
                  <span>Explore Categories</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </a>
              </div>

              {/* Live Trust Metrics */}
              <div className="pt-6 border-t border-white/10 grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0 text-left">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">36+</div>
                  <div className="text-[11px] text-slate-400 font-medium">Curated Products</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-brand-honey">5 Cities</div>
                  <div className="text-[11px] text-slate-400 font-medium">Live Hub Inventory</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-white">100%</div>
                  <div className="text-[11px] text-slate-400 font-medium">Atomic Checkout</div>
                </div>
              </div>
            </div>

            {/* Right Visual Column (CSS Composition) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-md bg-gradient-to-br from-white/10 to-white/5 border border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl relative">
                {/* Floating Highlight Card */}
                <div className="bg-brand-deep-navy/90 border border-white/15 rounded-2xl p-5 mb-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-semibold text-slate-300">Live Inventory Hub</span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-brand-honey/20 text-brand-honey">
                      {selectedCity}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    Multi-City Synchronized Catalog
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Stock updates sync in real-time across Bengaluru, Hyderabad, Chennai, Mumbai, and Delhi.
                  </p>
                </div>

                {/* Feature checklist */}
                <div className="space-y-3 text-xs text-slate-200">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-honey shrink-0" />
                    <span>Real-time per-city stock availability</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-honey shrink-0" />
                    <span>PostgreSQL row locking prevents overselling</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-honey shrink-0" />
                    <span>OpenSearch smart typo-tolerant discovery</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-brand-honey shrink-0" />
                    <span>Idempotent and atomic transaction checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 2: TRUST FEATURES */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Benefit 1 */}
          <div className="bg-white rounded-2xl border border-brand-border p-5 shadow-card hover:shadow-card-hover transition-all flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-brand-honey flex items-center justify-center shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-text mb-1">City-Wise Availability</h3>
              <p className="text-xs text-brand-muted leading-relaxed">
                Check exact quantities available in your local Indian warehouse before ordering.
              </p>
            </div>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white rounded-2xl border border-brand-border p-5 shadow-card hover:shadow-card-hover transition-all flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-text mb-1">Smart Product Search</h3>
              <p className="text-xs text-brand-muted leading-relaxed">
                Powered by OpenSearch with typo-tolerant fuzzy matching and phrase boosting.
              </p>
            </div>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white rounded-2xl border border-brand-border p-5 shadow-card hover:shadow-card-hover transition-all flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-text mb-1">Secure Checkout</h3>
              <p className="text-xs text-brand-muted leading-relaxed">
                Atomic database transactions guarantee no double-charging or overselling.
              </p>
            </div>
          </div>

          {/* Benefit 4 */}
          <div className="bg-white rounded-2xl border border-brand-border p-5 shadow-card hover:shadow-card-hover transition-all flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-text mb-1">Easy Order Tracking</h3>
              <p className="text-xs text-brand-muted leading-relaxed">
                View instant confirmation and transparent line items linked to your user account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 3: SHOP BY CATEGORY */}
      {/* ======================================================== */}
      <section id="categories" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-honey uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore The Hive</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
              Shop by Category
            </h2>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold text-brand-navy hover:text-brand-honey inline-flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            <span>View All Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingCategories ? (
          <LoadingSpinner message="Loading catalog categories..." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {(categories.length > 0
              ? categories
              : [
                  { category: 'Electronics', product_count: 6 },
                  { category: 'Fashion', product_count: 6 },
                  { category: 'Home & Kitchen', product_count: 6 },
                  { category: 'Beauty & Personal Care', product_count: 6 },
                  { category: 'Groceries', product_count: 6 },
                  { category: 'Sports & Fitness', product_count: 6 },
                ]
            ).map((cat) => (
              <Link
                key={cat.category}
                data-testid="home-category-card"
                to={`/products?category=${encodeURIComponent(cat.category)}`}
                className="group bg-white rounded-2xl border border-brand-border p-4 shadow-subtle hover:shadow-card hover:border-brand-honey/40 transition-all text-center flex flex-col items-center justify-between"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-50 group-hover:bg-brand-soft-honey flex items-center justify-center transition-colors mb-3">
                  {getCategoryIcon(cat.category)}
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-brand-text group-hover:text-brand-navy transition-colors mb-1 line-clamp-1">
                  {cat.category}
                </h3>
                <span className="text-[11px] font-medium text-brand-muted">
                  {cat.product_count} {cat.product_count === 1 ? 'item' : 'items'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SECTION 4: FEATURED PRODUCTS */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-honey uppercase tracking-wider mb-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Live in {selectedCity}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
              Featured Products
            </h2>
            <p className="text-xs text-brand-muted mt-1">
              Stock availability updated in real-time for customers in {selectedCity}.
            </p>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
          >
            <span>See Entire Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingProducts ? (
          <LoadingSpinner message={`Checking inventory for ${selectedCity}...`} />
        ) : productError ? (
          <ErrorState
            title="Unable to Load Products"
            message={productError}
            onRetry={loadFeaturedProducts}
          />
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-brand-border p-8">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-brand-text mb-1">No products found</h3>
            <p className="text-xs text-brand-muted mb-4">
              We couldn't find featured products for {selectedCity}. Try checking all products.
            </p>
            <Link
              to="/products"
              className="px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-semibold"
            >
              Browse All Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selectedCity={selectedCity}
              />
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SECTION 5: CITY SHOPPING HIGHLIGHT */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-brand-navy to-brand-deep-navy rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl">
          <div className="absolute right-0 bottom-0 w-80 h-80 bg-brand-honey/10 rounded-full blur-2xl pointer-events-none" />

          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-honey/20 border border-brand-honey/30 text-brand-honey text-xs font-bold uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" />
              <span>Hyper-Local Availability</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Shop Smarter, Right Where You Are.
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              At HiveMart, we synchronize our catalog across major Indian distribution centers.
              Whether you are shopping from Bengaluru, Hyderabad, Chennai, Mumbai, or Delhi,
              your cart reflects genuine warehouse availability.
            </p>

            <div className="pt-2">
              <div className="text-xs font-bold text-slate-300 mb-2">Switch your active city:</div>
              <div className="flex flex-wrap gap-2">
                {supportedCities.map((city: SupportedCity) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSelectedCity(city)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedCity === city
                        ? 'bg-brand-honey text-brand-navy shadow-md'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {city} {selectedCity === city && '✓'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

