import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Package,
  RotateCcw,
  Check,
} from 'lucide-react';
import { useCity } from '../context/CityContext.tsx';
import { searchProducts, getCategories } from '../services/api.ts';
import { Product, CategoryInfo, PaginationMetadata, ProductSortOption } from '../types/index.ts';
import { ProductCard } from '../components/common/ProductCard.tsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';
import { ErrorState } from '../components/common/ErrorState.tsx';
import { Badge } from '../components/common/Badge.tsx';

const PRICE_TIERS = [
  { label: 'All Prices', min: undefined, max: undefined },
  { label: 'Under ₹500', min: undefined, max: 500 },
  { label: '₹500 - ₹1,500', min: 500, max: 1500 },
  { label: '₹1,500 - ₹3,000', min: 1500, max: 3000 },
  { label: 'Above ₹3,000', min: 3000, max: undefined },
];

const SORT_OPTIONS: { value: ProductSortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance / Recommended' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A to Z' },
  { value: 'name_desc', label: 'Name: Z to A' },
  { value: 'newest', label: 'Newest Arrivals' },
];

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCity } = useCity();

  // Read URL parameters
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
  const maxPriceParam = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
  const inStockParam = searchParams.get('inStock') === 'true';
  const sortParam = (searchParams.get('sort') as ProductSortOption) || (queryParam ? 'relevance' : 'newest');
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Local state for interactive controls
  const [searchInput, setSearchInput] = useState(queryParam);
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam !== undefined ? String(minPriceParam) : '');
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam !== undefined ? String(maxPriceParam) : '');
  const [priceError, setPriceError] = useState<string | null>(null);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Request cancellation ref to prevent stale response races
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync search input when URL changes
  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  // Sync price inputs when URL changes
  useEffect(() => {
    setMinPriceInput(minPriceParam !== undefined ? String(minPriceParam) : '');
    setMaxPriceInput(maxPriceParam !== undefined ? String(maxPriceParam) : '');
  }, [minPriceParam, maxPriceParam]);

  // Fetch categories once on mount
  useEffect(() => {
    let isMounted = true;
    const fetchCats = async () => {
      try {
        const catData = await getCategories();
        if (isMounted) setCategories(catData);
      } catch (err) {
        console.warn('Failed to load categories in ProductsPage:', err);
      }
    };
    fetchCats();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update URL search parameters helper
  const updateUrlParams = (updates: Record<string, string | number | boolean | undefined | null>) => {
    const newParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, String(val));
      }
    });

    // When modifying filters or search query, always reset page to 1
    if (!('page' in updates)) {
      newParams.delete('page');
    }

    setSearchParams(newParams);
  };

  // Debounced search while typing (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput.trim() !== queryParam) {
        updateUrlParams({ q: searchInput.trim() || undefined });
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch products from OpenSearch endpoint with cancellation
  const fetchCatalog = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      const result = await searchProducts(
        {
          q: queryParam || undefined,
          category: categoryParam || undefined,
          city: selectedCity,
          minPrice: minPriceParam,
          maxPrice: maxPriceParam,
          inStock: inStockParam ? true : undefined,
          sort: sortParam,
          page: pageParam,
          limit: 12,
        },
        abortController.signal
      );

      setProducts(result.products);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Stale request aborted, do nothing
      }
      setError(err instanceof Error ? err.message : 'Failed to retrieve products from OpenSearch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [queryParam, categoryParam, minPriceParam, maxPriceParam, inStockParam, sortParam, pageParam, selectedCity]);

  // Handle Search Submit (Enter key or button)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ q: searchInput.trim() || undefined });
  };

  // Handle Category Click
  const handleCategorySelect = (catName: string) => {
    if (categoryParam.toLowerCase() === catName.toLowerCase()) {
      updateUrlParams({ category: undefined });
    } else {
      updateUrlParams({ category: catName });
    }
    setMobileFiltersOpen(false);
  };

  // Handle In-Stock Toggle
  const handleInStockToggle = () => {
    updateUrlParams({ inStock: !inStockParam ? 'true' : undefined });
  };

  // Handle Price Filter Apply
  const handleApplyPrice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPriceError(null);

    const min = minPriceInput.trim() !== '' ? Number(minPriceInput) : undefined;
    const max = maxPriceInput.trim() !== '' ? Number(maxPriceInput) : undefined;

    if (min !== undefined && (isNaN(min) || min < 0)) {
      setPriceError('Min price must be 0 or greater');
      return;
    }
    if (max !== undefined && (isNaN(max) || max < 0)) {
      setPriceError('Max price must be 0 or greater');
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError('Min price cannot exceed Max price');
      return;
    }

    updateUrlParams({
      minPrice: min,
      maxPrice: max,
    });
    setMobileFiltersOpen(false);
  };

  // Handle Price Preset Tier Click
  const handlePriceTierClick = (min?: number, max?: number) => {
    setMinPriceInput(min !== undefined ? String(min) : '');
    setMaxPriceInput(max !== undefined ? String(max) : '');
    setPriceError(null);
    updateUrlParams({
      minPrice: min,
      maxPrice: max,
    });
    setMobileFiltersOpen(false);
  };

  // Handle Sort Change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value as ProductSortOption;
    updateUrlParams({ sort: newSort });
  };

  // Handle Page Change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
    updateUrlParams({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clear All Filters
  const handleClearAllFilters = () => {
    setSearchInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setPriceError(null);
    setSearchParams(new URLSearchParams());
    setMobileFiltersOpen(false);
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Boolean(queryParam || categoryParam || minPriceParam !== undefined || maxPriceParam !== undefined || inStockParam);
  }, [queryParam, categoryParam, minPriceParam, maxPriceParam, inStockParam]);

  // Active filters count for mobile badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (queryParam) count++;
    if (categoryParam) count++;
    if (minPriceParam !== undefined || maxPriceParam !== undefined) count++;
    if (inStockParam) count++;
    return count;
  }, [queryParam, categoryParam, minPriceParam, maxPriceParam, inStockParam]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* ======================================================== */}
      {/* 1. BREADCRUMBS & PAGE HEADER */}
      {/* ======================================================== */}
      <div className="flex items-center gap-2 text-xs text-brand-muted mb-4">
        <Link to="/" className="hover:text-brand-navy flex items-center gap-1 font-medium">
          Home
        </Link>
        <span>/</span>
        <span className="font-semibold text-brand-navy">Catalog</span>
        {categoryParam && (
          <>
            <span>/</span>
            <span className="text-brand-navy font-bold">{categoryParam}</span>
          </>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-brand-border p-6 sm:p-8 shadow-card mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft-honey text-brand-navy text-xs font-bold mb-2">
              <MapPin className="w-3.5 h-3.5 text-brand-honey" />
              <span>Live Inventory Hub: <strong className="font-extrabold">{selectedCity}</strong></span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
              Explore Our Products
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted mt-1 leading-relaxed">
              Find what you love, available in your city. Real-time warehouse availability powered by Aiven OpenSearch.
            </p>
          </div>

          {/* Catalog Search Bar */}
          <div className="w-full lg:max-w-md">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="Search products, brands, or keywords..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-11 pr-24 py-3 rounded-2xl bg-slate-50 border border-brand-border text-brand-text placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-honey focus:bg-white shadow-inner transition-all"
              />
              <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateUrlParams({ q: undefined });
                  }}
                  className="absolute right-16 top-3 text-slate-400 hover:text-brand-navy p-0.5"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-2 top-2 px-3.5 py-1.5 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-bold transition-colors shadow-sm"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Action Controls & Active Filter Chips Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Active Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-brand-muted mr-1">
              {loading ? 'Searching...' : `Showing ${products.length} of ${pagination.total} products`}
            </span>

            {queryParam && (
              <Badge variant="honey" size="sm" className="gap-1.5">
                <span>"{queryParam}"</span>
                <button
                  onClick={() => {
                    setSearchInput('');
                    updateUrlParams({ q: undefined });
                  }}
                  className="hover:text-brand-navy"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {categoryParam && (
              <Badge variant="navy" size="sm" className="gap-1.5">
                <span>{categoryParam}</span>
                <button onClick={() => updateUrlParams({ category: undefined })} className="hover:text-amber-300">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {(minPriceParam !== undefined || maxPriceParam !== undefined) && (
              <Badge variant="warning" size="sm" className="gap-1.5">
                <span>
                  Price: {minPriceParam !== undefined ? `₹${minPriceParam}` : '₹0'} -{' '}
                  {maxPriceParam !== undefined ? `₹${maxPriceParam}` : 'Any'}
                </span>
                <button
                  onClick={() => {
                    setMinPriceInput('');
                    setMaxPriceInput('');
                    updateUrlParams({ minPrice: undefined, maxPrice: undefined });
                  }}
                  className="hover:text-brand-navy"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {inStockParam && (
              <Badge variant="success" size="sm" className="gap-1.5">
                <span>In-Stock in {selectedCity}</span>
                <button onClick={() => updateUrlParams({ inStock: undefined })} className="hover:text-emerald-900">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 ml-1 py-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            )}
          </div>

          {/* Right Controls: Sort Dropdown & Mobile Filter Button */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Mobile Filter Button */}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-brand-navy text-xs font-bold transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-brand-honey" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-honey text-brand-navy text-[10px] font-extrabold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              <span className="text-xs text-brand-muted hidden sm:inline">Sort by:</span>
              <select
                value={sortParam}
                onChange={handleSortChange}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-brand-border text-xs font-semibold text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-honey"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MAIN CATALOG BODY (SIDEBAR + PRODUCT GRID) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================== */}
        {/* DESKTOP FILTER SIDEBAR (4 COLUMNS) */}
        {/* ======================================================== */}
        <aside className="hidden lg:block lg:col-span-3 space-y-6 bg-white rounded-3xl border border-brand-border p-6 shadow-card sticky top-28">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="text-sm font-extrabold text-brand-navy flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-brand-honey" />
              <span>Filter Catalog</span>
            </h3>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
              >
                Clear All
              </button>
            )}
          </div>

          {/* 1. Category Filter */}
          <div>
            <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider mb-3">
              Categories
            </h4>
            <div className="space-y-1 text-xs">
              <button
                type="button"
                onClick={() => updateUrlParams({ category: undefined })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                  !categoryParam
                    ? 'bg-brand-soft-honey text-brand-navy font-bold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <span>All Categories</span>
                {!categoryParam && <Check className="w-3.5 h-3.5 text-brand-honey" />}
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => handleCategorySelect(cat.category)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                    categoryParam.toLowerCase() === cat.category.toLowerCase()
                      ? 'bg-brand-soft-honey text-brand-navy font-bold'
                      : 'text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="truncate pr-2">{cat.category}</span>
                  <span className="text-[11px] text-brand-muted shrink-0">
                    {cat.product_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. In-Stock Filter Toggle */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-brand-navy">
                  In-Stock Only
                </h4>
                <p className="text-[11px] text-brand-muted leading-relaxed mt-0.5">
                  Exclude products with 0 stock in {selectedCity}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={inStockParam}
                onClick={handleInStockToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  inStockParam ? 'bg-brand-honey' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    inStockParam ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. Price Range Filter */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">
              Price Range (INR)
            </h4>

            {/* Quick Price Tier Pills */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRICE_TIERS.map((tier) => {
                const isSelected =
                  minPriceParam === tier.min && maxPriceParam === tier.max;
                return (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() => handlePriceTierClick(tier.min, tier.max)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      isSelected
                        ? 'bg-brand-navy text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Min / Max Inputs */}
            <form onSubmit={handleApplyPrice} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">
                    Min (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-brand-border text-xs focus:ring-1 focus:ring-brand-honey focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">
                    Max (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Any"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-brand-border text-xs focus:ring-1 focus:ring-brand-honey focus:outline-none"
                  />
                </div>
              </div>

              {priceError && (
                <p className="text-[11px] text-rose-600 font-medium">{priceError}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors"
                >
                  Apply
                </button>
                {(minPriceInput || maxPriceInput) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMinPriceInput('');
                      setMaxPriceInput('');
                      setPriceError(null);
                      updateUrlParams({ minPrice: undefined, maxPrice: undefined });
                    }}
                    className="px-2 py-1.5 rounded-xl border border-brand-border text-slate-600 hover:bg-slate-50 text-xs font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* 4. Warehouse City Highlight Info */}
          <div className="pt-4 border-t border-slate-100">
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-brand-honey/30 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-brand-navy">
                <MapPin className="w-3.5 h-3.5 text-brand-honey" />
                <span>Hyper-Local Availability</span>
              </div>
              <p className="text-[11px] text-brand-muted leading-relaxed">
                Stock quantities reflect physical inventory in <strong className="text-brand-navy">{selectedCity}</strong>.
                Switch cities via the navbar to check other hubs.
              </p>
            </div>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* PRODUCT GRID & PAGINATION (9 COLUMNS) */}
        {/* ======================================================== */}
        <main className="lg:col-span-9 space-y-8">
          {loading ? (
            <div className="py-20 text-center">
              <LoadingSpinner message="Searching verified catalog products..." size="lg" />
            </div>
          ) : error ? (
            <ErrorState
              title="Catalog Search Error"
              message={error}
              onRetry={fetchCatalog}
            />
          ) : products.length === 0 ? (
            <div className="bg-white rounded-3xl border border-brand-border p-12 text-center max-w-lg mx-auto shadow-card">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-brand-honey flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-brand-navy mb-2">
                No products match your search or filters
              </h3>
              <p className="text-xs text-brand-muted leading-relaxed mb-6">
                Try checking for spelling mistakes, removing price constraints, or switching off the in-stock filter.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors shadow-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear All Active Filters</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    selectedCity={selectedCity}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-brand-border">
                  <div className="text-xs text-brand-muted font-medium">
                    Page <strong className="text-brand-navy font-bold">{pagination.page}</strong> of{' '}
                    <strong className="text-brand-navy font-bold">{pagination.totalPages}</strong> (
                    {pagination.total} total items)
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Previous Button */}
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                      className="px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-navy bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        return p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1;
                      })
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={p}>
                            {prev && p - prev > 1 && (
                              <span className="px-1 text-slate-400 text-xs">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePageChange(p)}
                              className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${
                                p === pagination.page
                                  ? 'bg-brand-navy text-white shadow-sm'
                                  : 'bg-white border border-brand-border text-brand-text hover:bg-slate-50'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    {/* Next Button */}
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                      className="px-3.5 py-2 rounded-xl border border-brand-border text-xs font-semibold text-brand-navy bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MOBILE FILTERS SLIDE-OVER DRAWER */}
      {/* ======================================================== */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileFiltersOpen(false)}
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-white shadow-2xl p-6 overflow-y-auto z-10 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-brand-navy flex items-center gap-2">
                  <Filter className="w-4 h-4 text-brand-honey" />
                  <span>Filter Products</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-brand-navy"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Categories */}
              <div>
                <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">
                  Category
                </h4>
                <div className="space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => updateUrlParams({ category: undefined })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left ${
                      !categoryParam ? 'bg-brand-soft-honey font-bold text-brand-navy' : 'text-slate-600'
                    }`}
                  >
                    <span>All Categories</span>
                    {!categoryParam && <Check className="w-3.5 h-3.5 text-brand-honey" />}
                  </button>

                  {categories.map((cat) => (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => handleCategorySelect(cat.category)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left ${
                        categoryParam.toLowerCase() === cat.category.toLowerCase()
                          ? 'bg-brand-soft-honey font-bold text-brand-navy'
                          : 'text-slate-600'
                      }`}
                    >
                      <span className="truncate pr-2">{cat.category}</span>
                      <span className="text-[11px] text-brand-muted">{cat.product_count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* In-Stock Toggle */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-brand-navy">In-Stock Only</h4>
                  <p className="text-[11px] text-brand-muted">Positive stock in {selectedCity}</p>
                </div>
                <button
                  type="button"
                  onClick={handleInStockToggle}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    inStockParam ? 'bg-brand-honey' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      inStockParam ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Price Range */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-brand-navy uppercase tracking-wider mb-2">
                  Price Range (INR)
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {PRICE_TIERS.map((tier) => (
                    <button
                      key={tier.label}
                      type="button"
                      onClick={() => handlePriceTierClick(tier.min, tier.max)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700"
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min ₹"
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-brand-border text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Max ₹"
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-brand-border text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyPrice()}
                  className="w-full py-2 rounded-xl bg-brand-navy text-white text-xs font-bold"
                >
                  Apply Price
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="flex-1 py-2 rounded-xl border border-brand-border text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 py-2 rounded-xl bg-brand-honey text-brand-navy text-xs font-bold"
              >
                View Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
