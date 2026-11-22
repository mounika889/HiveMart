import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  User,
  ShoppingBag,
  Package,
  Menu,
  X,
  ChevronDown,
  Layers,
  LogOut,
  UserCheck,
  Shield,
  Store,
  Receipt,
  FileText,
  Bell,
  Sparkles,
} from 'lucide-react';
import { useCity } from '../../context/CityContext.tsx';
import { useAuth } from '../../hooks/useAuth.ts';
import { useCart } from '../../hooks/useCart.ts';
import { getCategories } from '../../services/api.ts';
import * as notificationService from '../../services/notifications.ts';
import { CategoryInfo, SupportedCity } from '../../types/index.ts';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedCity, setSelectedCity, supportedCities } = useCity();
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  // Fetch unread stock notifications count for retailers
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && user?.role === 'retailer') {
      notificationService
        .getUnreadNotificationCount()
        .then((count) => {
          if (isMounted) setUnreadAlertCount(count);
        })
        .catch(() => {});
    } else {
      setUnreadAlertCount(0);
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.role]);

  // Sync search input if query param changes
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  // Load real categories from backend API
  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (isMounted) {
          setCategories(data);
          setLoadingCategories(false);
        }
      } catch (err) {
        console.warn('Failed to load dynamic categories in navbar:', err);
        if (isMounted) setLoadingCategories(false);
      }
    };
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    } else {
      navigate('/products');
      setMobileMenuOpen(false);
    }
  };

  const handleCityChange = (city: SupportedCity) => {
    setSelectedCity(city);
    setCityDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Account';
  const userInitials = (user?.name || 'HM')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0].toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <header className="sticky top-0 z-50 bg-brand-navy shadow-md transition-all">
      {/* 1. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Left: Brand Logo & Tagline */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            {/* Hexagon Hive Icon with Bee accent */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-deep-navy border border-brand-honey/40 flex items-center justify-center p-1.5 shadow-sm group-hover:border-brand-honey transition-colors">
              <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
                <polygon points="24,3 43,14 43,34 24,45 5,34 5,14" fill="#14213D" stroke="#F5B700" strokeWidth="3" />
                <polygon points="24,10 35,16.5 35,29.5 24,36 13,29.5 13,16.5" fill="#F5B700" />
                <circle cx="24" cy="23" r="5" fill="#14213D" />
                <path d="M19 19 Q16 13 22 17" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M29 19 Q32 13 26 17" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center">
                Hive<span className="text-brand-honey">Mart</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-medium text-slate-300 tracking-wider uppercase -mt-1">
                Your City. Your Cart.
              </span>
            </div>
          </Link>

          {/* Center: Search Input (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl mx-4">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="Search products, brands and more..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-28 py-2.5 rounded-xl bg-white text-brand-text placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-honey shadow-sm transition-all"
              />
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    navigate('/products');
                  }}
                  className="absolute right-20 top-2.5 text-slate-400 hover:text-brand-navy p-0.5"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 px-4 py-1.5 rounded-lg bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-bold transition-colors shadow-sm"
              >
                Search
              </button>
            </form>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-2 sm:gap-4 text-white">
            {/* City Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-brand-deep-navy/80 hover:bg-brand-deep-navy border border-white/10 hover:border-brand-honey/50 transition-all text-xs font-medium"
                title="Select Delivery City"
              >
                <MapPin className="w-3.5 h-3.5 text-brand-honey shrink-0" />
                <span className="hidden sm:inline text-slate-300">City:</span>
                <span className="font-bold text-white max-w-[80px] sm:max-w-none truncate">{selectedCity}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {cityDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setCityDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-brand-border py-2 z-30 animate-in fade-in slide-in-from-top-1 text-brand-text">
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
                      Select Your City
                    </div>
                    {supportedCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => handleCityChange(city)}
                        className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between hover:bg-brand-soft-honey transition-colors ${
                          selectedCity === city
                            ? 'text-brand-navy font-bold bg-amber-50/60'
                            : 'text-slate-600'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <MapPin
                            className={`w-3.5 h-3.5 ${
                              selectedCity === city ? 'text-brand-honey' : 'text-slate-300'
                            }`}
                          />
                          {city}
                        </span>
                        {selectedCity === city && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-honey" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Orders Link */}
            <Link
              to="/orders"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors"
            >
              <Package className="w-4 h-4 text-slate-300" />
              <span>Orders</span>
            </Link>

            {/* Monthly Essentials Link */}
            {isAuthenticated && (!user?.role || user.role === 'customer') && (
              <Link
                to="/monthly-essentials"
                data-testid="navbar-monthly-essentials-link"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors"
                title="My Monthly Essentials"
              >
                <Sparkles className="w-4 h-4 text-brand-honey" />
                <span>Essentials</span>
              </Link>
            )}

            {/* Retailer Notification Bell */}
            {isAuthenticated && user?.role === 'retailer' && (
              <Link
                to="/retailer/notifications"
                data-testid="navbar-retailer-notifications-btn"
                className="relative p-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                title="Warehouse Stock Notifications"
              >
                <Bell className="w-5 h-5 text-brand-honey" />
                {unreadAlertCount > 0 && (
                  <span
                    data-testid="navbar-unread-alerts-badge"
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center px-1 border-2 border-brand-navy shadow-sm"
                  >
                    {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                  </span>
                )}
              </Link>
            )}

            {/* Auth: Dynamic Sign In or User Profile Dropdown */}
            {isAuthenticated && user ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  data-testid="navbar-user-btn"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-brand-deep-navy/80 hover:bg-brand-deep-navy border border-white/10 hover:border-brand-honey/50 transition-all text-xs font-medium"
                  title="Account Profile"
                >
                  <div className="w-6 h-6 rounded-full bg-brand-honey text-brand-navy font-black text-[11px] flex items-center justify-center shrink-0">
                    {userInitials}
                  </div>
                  <span className="hidden sm:inline font-bold text-white max-w-[100px] truncate">
                    {firstName}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {userDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setUserDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-xl border border-brand-border py-2 z-30 animate-in fade-in slide-in-from-top-1 text-brand-text">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="text-xs font-bold text-brand-navy truncate">{user.name}</p>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-honey text-brand-navy shrink-0">
                            {user.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-brand-muted truncate">{user.email}</p>
                      </div>

                      <div className="py-1">
                        {user.role === 'admin' && (
                          <Link
                            to="/admin/dashboard"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-brand-navy bg-amber-50/60 hover:bg-brand-soft-honey transition-colors"
                          >
                            <Shield className="w-4 h-4 text-brand-honey" />
                            <span>Admin Portal</span>
                          </Link>
                        )}
                        {user.role === 'retailer' && (
                          <>
                            <Link
                              to="/retailer/dashboard"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-brand-navy bg-amber-50/60 hover:bg-brand-soft-honey transition-colors"
                            >
                              <Store className="w-4 h-4 text-brand-honey" />
                              <span>Retailer Portal</span>
                            </Link>
                            <Link
                              to="/retailer/pos"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-brand-navy hover:bg-brand-soft-honey transition-colors"
                            >
                              <Receipt className="w-4 h-4 text-brand-honey" />
                              <span>POS Billing Terminal</span>
                            </Link>
                            <Link
                              to="/retailer/bills"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-brand-soft-honey hover:text-brand-navy transition-colors"
                            >
                              <FileText className="w-4 h-4 text-brand-navy" />
                              <span>Store Bills</span>
                            </Link>
                            <Link
                              to="/retailer/notifications"
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center justify-between px-4 py-2 text-xs font-medium text-slate-700 hover:bg-brand-soft-honey hover:text-brand-navy transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <Bell className="w-4 h-4 text-brand-navy" />
                                <span>Stock Notifications</span>
                              </div>
                              {unreadAlertCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                                  {unreadAlertCount}
                                </span>
                              )}
                            </Link>
                          </>
                        )}
                        <Link
                          to="/account"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-brand-soft-honey hover:text-brand-navy transition-colors"
                        >
                          <UserCheck className="w-4 h-4 text-brand-navy" />
                          <span>My Account</span>
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-brand-soft-honey hover:text-brand-navy transition-colors"
                        >
                          <Package className="w-4 h-4 text-brand-navy" />
                          <span>My Orders</span>
                        </Link>
                        {(!user.role || user.role === 'customer') && (
                          <Link
                            to="/monthly-essentials"
                            onClick={() => setUserDropdownOpen(false)}
                            data-testid="dropdown-monthly-essentials-link"
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-brand-soft-honey hover:text-brand-navy transition-colors"
                          >
                            <Sparkles className="w-4 h-4 text-brand-honey" />
                            <span>My Monthly Essentials</span>
                          </Link>
                        )}
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4 text-red-600" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                data-testid="navbar-signin-link"
                className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors"
              >
                <User className="w-4 h-4 text-slate-300" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            )}

            {/* Cart Icon with Real-Time Counter */}
            <Link
              to="/cart"
              data-testid="navbar-cart-link"
              className="relative p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors"
              title="Shopping Cart"
            >
              <ShoppingBag className="w-5 h-5 text-brand-honey" />
              <span
                data-testid="navbar-cart-badge"
                className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brand-honey text-brand-navy font-bold text-[10px] flex items-center justify-center shadow-sm"
              >
                {totalItems}
              </span>
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white md:hidden hover:bg-white/10"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              placeholder="Search products in your city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-20 py-2 rounded-xl bg-white text-brand-text placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <button
              type="submit"
              className="absolute right-1 top-1 px-3 py-1 rounded-lg bg-brand-honey text-brand-navy text-[11px] font-bold"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* 2. Secondary Category Navigation Bar */}
      <div className="bg-brand-deep-navy border-t border-white/10 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 overflow-x-auto py-2 text-xs no-scrollbar">
            <Link
              to="/products"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-brand-honey hover:bg-white/10 font-bold shrink-0 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Products</span>
            </Link>

            <span className="w-px h-4 bg-white/20 mx-1 shrink-0" />

            {loadingCategories ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs px-2 py-1">
                <span>Loading categories...</span>
              </div>
            ) : categories.length > 0 ? (
              categories.map((cat) => (
                <Link
                  key={cat.category}
                  to={`/products?category=${encodeURIComponent(cat.category)}`}
                  className="px-3 py-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 font-medium shrink-0 transition-colors"
                >
                  {cat.category}
                </Link>
              ))
            ) : (
              ['Electronics', 'Fashion', 'Home & Kitchen', 'Beauty & Personal Care', 'Groceries', 'Sports & Fitness'].map((c) => (
                <Link
                  key={c}
                  to={`/products?category=${encodeURIComponent(c)}`}
                  className="px-3 py-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 font-medium shrink-0 transition-colors"
                >
                  {c}
                </Link>
              ))
            )}
          </nav>
        </div>
      </div>

      {/* 3. Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-brand-deep-navy border-t border-white/10 px-4 pt-3 pb-6 animate-in slide-in-from-top duration-200">
          <div className="mb-4 pb-3 border-b border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>Current City:</span>
            <span className="font-bold text-brand-honey">{selectedCity}</span>
          </div>

          <div className="space-y-1 mb-4">
            <Link
              to="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
            >
              All Products
            </Link>
            <Link
              to="/cart"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
            >
              <span>Shopping Cart</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-honey text-brand-navy font-bold text-xs">
                {totalItems}
              </span>
            </Link>
            <Link
              to="/orders"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
            >
              My Orders
            </Link>
            {isAuthenticated && (!user?.role || user.role === 'customer') && (
              <Link
                to="/monthly-essentials"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-brand-honey font-bold hover:bg-white/10"
              >
                <span>My Monthly Essentials</span>
                <Sparkles className="w-4 h-4" />
              </Link>
            )}

            {isAuthenticated && user ? (
              <>
                {user.role === 'admin' && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-brand-honey font-bold hover:bg-white/10"
                  >
                    <span>Admin Portal</span>
                    <Shield className="w-4 h-4" />
                  </Link>
                )}
                {user.role === 'retailer' && (
                  <>
                    <Link
                      to="/retailer/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-brand-honey font-bold hover:bg-white/10"
                    >
                      <span>Retailer Portal</span>
                      <Store className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/retailer/pos"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
                    >
                      <span>POS Billing Terminal</span>
                      <Receipt className="w-4 h-4 text-brand-honey" />
                    </Link>
                    <Link
                      to="/retailer/bills"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
                    >
                      <span>Store Bills</span>
                      <FileText className="w-4 h-4 text-slate-300" />
                    </Link>
                    <Link
                      to="/retailer/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
                    >
                      <span>Stock Notifications</span>
                      <div className="flex items-center gap-1.5">
                        {unreadAlertCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                            {unreadAlertCount}
                          </span>
                        )}
                        <Bell className="w-4 h-4 text-brand-honey" />
                      </div>
                    </Link>
                  </>
                )}
                <Link
                  to="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
                >
                  My Account ({user.name})
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-lg text-red-400 font-semibold hover:bg-white/10"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-white font-semibold hover:bg-white/10"
              >
                Sign In / Register
              </Link>
            )}
          </div>

          <div className="pt-3 border-t border-white/10">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
              Shop Categories
            </div>
            <div className="grid grid-cols-2 gap-1.5">
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
                  to={`/products?category=${encodeURIComponent(cat.category)}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 font-medium truncate"
                >
                  {cat.category}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
