import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ShoppingBag,
  Plus,
  Trash2,
  Edit2,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Search,
  Sparkles,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useCity } from '../context/CityContext.tsx';
import { useCart } from '../hooks/useCart.ts';
import { getProducts } from '../services/api.ts';
import {
  getMonthlyLists,
  getMonthlyList,
  createMonthlyList,
  updateMonthlyList,
  toggleMonthlyListStatus,
  addMonthlyItem,
  updateMonthlyItemQuantity,
  removeMonthlyItem,
  getMonthlyReminders,
  markMonthlyReminderRead,
  addMonthlyEssentialsToCart,
} from '../services/monthlyEssentials.ts';
import {
  MonthlyEssentialList,
  MonthlyReminder,
  Product,
  AddEssentialsToCartResult,
} from '../types/index.ts';

export const MonthlyEssentialsPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const { refreshCart } = useCart();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedList, setSelectedList] = useState<MonthlyEssentialList | null>(null);
  const [reminders, setReminders] = useState<MonthlyReminder[]>([]);

  // Modals & Panels
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [cartResultModal, setCartResultModal] = useState<AddEssentialsToCartResult | null>(null);
  const [addingToCart, setAddingToCart] = useState<boolean>(false);

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formShoppingDay, setFormShoppingDay] = useState<number>(28);
  const [formReminderDays, setFormReminderDays] = useState<number>(3);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Product search state
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [addingItem, setAddingItem] = useState<boolean>(false);

  // Fetch all lists and reminders
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedLists, fetchedReminders] = await Promise.all([
        getMonthlyLists(),
        getMonthlyReminders().catch(() => []),
      ]);

      setReminders(fetchedReminders);

      if (fetchedLists.length > 0) {
        // Load details for first list
        const detailed = await getMonthlyList(fetchedLists[0].id, selectedCity);
        setSelectedList(detailed);
        setFormName(detailed.name);
        setFormShoppingDay(detailed.shopping_day);
        setFormReminderDays(detailed.reminder_days_before);
      } else {
        // Automatically create a default list if none exists
        const defaultList = await createMonthlyList({
          name: 'My Monthly Essentials',
          shopping_day: 28,
          reminder_days_before: 3,
        });
        const detailed = await getMonthlyList(defaultList.id, selectedCity);
        setSelectedList(detailed);
        setFormName(detailed.name);
        setFormShoppingDay(detailed.shopping_day);
        setFormReminderDays(detailed.reminder_days_before);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to load monthly essentials.');
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load catalog for product picker
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await getProducts({ city: selectedCity, limit: 100 });
        setCatalogProducts(res.products);
      } catch (err) {
        console.warn('Failed to load products for picker:', err);
      }
    };
    fetchCatalog();
  }, [selectedCity]);

  // Refresh current list details
  const refreshCurrentList = async () => {
    if (!selectedList) return;
    try {
      const detailed = await getMonthlyList(selectedList.id, selectedCity);
      setSelectedList(detailed);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to refresh list.');
    }
  };

  // Toggle Pause/Resume
  const handleToggleStatus = async () => {
    if (!selectedList) return;
    try {
      const newStatus = !selectedList.is_active;
      const updated = await toggleMonthlyListStatus(selectedList.id, newStatus);
      setSelectedList({ ...selectedList, is_active: updated.is_active });
      setSuccessMessage(`List ${updated.is_active ? 'resumed' : 'paused'} successfully.`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to update list status.');
    }
  };

  // Save Settings Modal
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList) return;
    setSavingSettings(true);
    try {
      const updated = await updateMonthlyList(selectedList.id, {
        name: formName,
        shopping_day: formShoppingDay,
        reminder_days_before: formReminderDays,
      });
      setSuccessMessage(`Monthly essentials "${updated.name}" settings updated!`);
      setEditModalOpen(false);
      await refreshCurrentList();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Add Item to List
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !selectedProductId) return;
    setAddingItem(true);
    try {
      await addMonthlyItem(selectedList.id, {
        productId: selectedProductId,
        quantity: selectedQuantity,
      });
      setAddModalOpen(false);
      setSelectedProductId('');
      setSelectedQuantity(1);
      setSuccessMessage('Product added to monthly essentials!');
      await refreshCurrentList();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to add product.');
    } finally {
      setAddingItem(false);
    }
  };

  // Update Item Quantity
  const handleUpdateQty = async (itemId: string, newQty: number) => {
    if (!selectedList || newQty < 1) return;
    try {
      await updateMonthlyItemQuantity(selectedList.id, itemId, newQty);
      await refreshCurrentList();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to update quantity.');
    }
  };

  // Remove Item
  const handleRemoveItem = async (itemId: string) => {
    if (!selectedList) return;
    try {
      await removeMonthlyItem(selectedList.id, itemId);
      await refreshCurrentList();
      setSuccessMessage('Product removed from essentials.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to remove product.');
    }
  };

  // Dismiss Reminder
  const handleDismissReminder = async (reminderId: string) => {
    try {
      await markMonthlyReminderRead(reminderId);
      setReminders((prev) => prev.filter((r) => r.reminder_id !== reminderId));
    } catch (err) {
      console.warn('Failed to dismiss reminder:', err);
    }
  };

  // Add All to Cart
  const handleAddAllToCart = async () => {
    if (!selectedList) return;
    setAddingToCart(true);
    setError(null);
    try {
      const result = await addMonthlyEssentialsToCart(selectedList.id, selectedCity);
      setCartResultModal(result);
      await refreshCart();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to add essentials to cart.');
    } finally {
      setAddingToCart(false);
    }
  };

  // Filter products in picker
  const filteredCatalog = catalogProducts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-muted mb-1">
            <Link to="/account" className="hover:text-brand-navy transition-colors">
              Account
            </Link>
            <span>/</span>
            <span className="text-brand-navy">My Monthly Essentials</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight flex items-center gap-2">
            <span>My Monthly Essentials</span>
            <Sparkles className="w-6 h-6 text-brand-honey shrink-0" />
          </h1>
          <p className="text-xs text-brand-muted mt-1 max-w-2xl">
            Save your monthly recurring groceries and household goods for {user?.name || 'your household'}. Choose your preferred shopping day,
            and HiveMart will remind you with one-click cart replenishment.
          </p>
        </div>

        {/* City and Actions */}
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-brand-border text-xs flex items-center gap-1.5 shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-brand-honey" />
            <span className="text-slate-600 font-medium">Hub:</span>
            <strong className="text-brand-navy">{selectedCity}</strong>
          </div>

          <button
            onClick={() => setEditModalOpen(true)}
            data-testid="edit-essentials-settings-btn"
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-brand-border text-brand-navy text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Active Cycle Reminders Banner */}
      {reminders.length > 0 && (
        <div className="mb-8 p-4 sm:p-5 rounded-3xl bg-amber-50 border-2 border-brand-honey/60 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-honey text-brand-navy flex items-center justify-center shrink-0 shadow-sm">
                <Clock className="w-5 h-5 font-black" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded-md inline-block mb-1">
                  Smart Reminder Due
                </span>
                <h3 className="text-sm font-bold text-brand-navy">
                  Monthly order scheduled for {reminders[0].due_date}!
                </h3>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Your recurring list &ldquo;{reminders[0].list_name}&rdquo; is ready. Add all items to your cart now to check current stock and delivery!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddAllToCart}
                disabled={addingToCart}
                data-testid="reminder-banner-add-cart-btn"
                className="px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold flex items-center gap-2 shadow transition-all disabled:opacity-50"
              >
                <ShoppingBag className="w-4 h-4 text-brand-honey" />
                <span>{addingToCart ? 'Adding...' : 'Add All to Cart'}</span>
              </button>
              <button
                onClick={() => handleDismissReminder(reminders[0].reminder_id)}
                className="px-3 py-2 rounded-xl bg-white/80 hover:bg-white text-slate-600 text-xs font-medium border border-amber-200 transition-colors"
                title="Dismiss reminder"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      {selectedList && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Card A: Schedule Date */}
          <div className="bg-white rounded-3xl border border-brand-border p-5 shadow-card flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block">
                Scheduled Shopping Day
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-brand-navy">
                  Day {selectedList.shopping_day}
                </span>
                <span className="text-xs text-brand-muted">of every month</span>
              </div>
              <div className="mt-2 text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-honey" />
                <span>
                  Next: <strong>{selectedList.next_shopping_date || 'Calculated'}</strong>
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 text-brand-navy">
              <Calendar className="w-5 h-5 text-brand-honey" />
            </div>
          </div>

          {/* Card B: Smart Reminder Setting */}
          <div className="bg-white rounded-3xl border border-brand-border p-5 shadow-card flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block">
                Early Smart Alert
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-brand-navy">
                  {selectedList.reminder_days_before} Days
                </span>
                <span className="text-xs text-brand-muted">prior notice</span>
              </div>
              <div className="mt-2 text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-honey" />
                <span>
                  Alert trigger: <strong>{selectedList.reminder_date || 'Upcoming'}</strong>
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Card C: Estimated Monthly Total */}
          <div className="bg-white rounded-3xl border border-brand-border p-5 shadow-card flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider block">
                Estimated Monthly Value
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-brand-navy">
                  ₹{selectedList.total_amount || '0.00'}
                </span>
                <span className="text-xs text-brand-muted">
                  ({selectedList.total_items || 0} items)
                </span>
              </div>
              <div className="mt-2 text-xs font-medium flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    selectedList.is_active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedList.is_active ? 'bg-emerald-600' : 'bg-slate-500'
                    }`}
                  />
                  {selectedList.is_active ? 'Active' : 'Paused'}
                </span>

                <button
                  onClick={handleToggleStatus}
                  className="text-brand-navy hover:text-brand-honey text-[11px] font-bold underline transition-colors"
                >
                  {selectedList.is_active ? 'Pause List' : 'Resume List'}
                </button>
              </div>
            </div>

            <button
              onClick={handleToggleStatus}
              title={selectedList.is_active ? 'Pause reminders' : 'Resume reminders'}
              className="p-3 rounded-2xl hover:bg-slate-50 transition-colors"
            >
              {selectedList.is_active ? (
                <PauseCircle className="w-6 h-6 text-emerald-600 hover:text-emerald-700" />
              ) : (
                <PlayCircle className="w-6 h-6 text-slate-400 hover:text-brand-honey" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Items Table / Section */}
      <div className="bg-white rounded-3xl border border-brand-border shadow-card overflow-hidden mb-8">
        {/* Table Header Controls */}
        <div className="p-5 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-brand-navy">
              Essential Items in {selectedList?.name || 'List'}
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Live prices and stock availability computed for {selectedCity} warehouse hub.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAddModalOpen(true)}
              data-testid="add-product-to-essentials-btn"
              className="px-3.5 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-brand-honey" />
              <span>Add Product</span>
            </button>

            <button
              onClick={handleAddAllToCart}
              disabled={addingToCart || !selectedList?.items?.length}
              data-testid="add-all-to-cart-btn"
              className="px-4 py-2 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-black flex items-center gap-2 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{addingToCart ? 'Processing...' : 'Add All to Cart'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-7 h-7 text-brand-honey animate-spin" />
            <span className="text-xs font-semibold text-brand-muted">
              Loading your monthly essentials...
            </span>
          </div>
        ) : !selectedList?.items || selectedList.items.length === 0 ? (
          <div className="py-16 px-4 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-brand-honey flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-brand-navy">No products saved yet</h3>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              Add your everyday pantry items, dairy, staples, and personal care essentials to build your monthly recurring basket.
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              data-testid="empty-state-add-product-btn"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold shadow transition-colors"
            >
              <Plus className="w-4 h-4 text-brand-honey" />
              <span>Add Your First Item</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="essentials-table">
              <thead>
                <tr className="border-b border-brand-border bg-slate-50/80 text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                  <th className="py-3 px-5">Product Details</th>
                  <th className="py-3 px-4">Catalog Price</th>
                  <th className="py-3 px-4">Warehouse Stock</th>
                  <th className="py-3 px-4 text-center">Monthly Qty</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {selectedList.items.map((item) => (
                  <tr
                    key={item.item_id}
                    className="hover:bg-amber-50/30 transition-colors"
                    data-testid={`essential-row-${item.product_id}`}
                  >
                    {/* Product Column */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url || '/placeholder.png'}
                          alt={item.product_name}
                          className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80';
                          }}
                        />
                        <div>
                          <Link
                            to={`/products/${item.product_id}`}
                            className="font-bold text-brand-navy hover:text-brand-honey transition-colors line-clamp-1"
                          >
                            {item.product_name}
                          </Link>
                          <span className="text-[11px] text-brand-muted block mt-0.5">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Price Column */}
                    <td className="py-3.5 px-4 font-bold text-brand-navy">
                      ₹{parseFloat(item.current_price).toFixed(2)}
                    </td>

                    {/* Stock Column */}
                    <td className="py-3.5 px-4">
                      {item.city_stock !== undefined && item.city_stock > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            item.city_stock <= 5
                              ? 'bg-rose-100 text-rose-800'
                              : item.city_stock <= 10
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.city_stock} units left
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                          Out of Stock
                        </span>
                      )}
                    </td>

                    {/* Quantity Spinner */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1 bg-slate-100/80 rounded-xl p-1 w-fit mx-auto border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.item_id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-brand-navy flex items-center justify-center font-bold text-xs shadow-sm transition-colors disabled:opacity-40"
                          title="Decrease quantity"
                        >
                          -
                        </button>
                        <span
                          data-testid={`qty-val-${item.product_id}`}
                          className="w-8 text-center font-extrabold text-brand-navy text-xs"
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.item_id, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-brand-navy flex items-center justify-center font-bold text-xs shadow-sm transition-colors"
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Subtotal Column */}
                    <td className="py-3.5 px-4 text-right font-black text-brand-navy">
                      ₹{parseFloat(item.line_subtotal).toFixed(2)}
                    </td>

                    {/* Actions Column */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.item_id)}
                        data-testid={`remove-item-${item.product_id}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove product from essentials"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary Bar */}
        {selectedList?.items && selectedList.items.length > 0 && (
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-brand-muted">
              Shopping cycle auto-clamps day 29–31 in shorter calendar months (e.g., Feb 28/29).
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[11px] text-brand-muted block">Estimated Total:</span>
                <span className="text-lg font-black text-brand-navy">
                  ₹{selectedList.total_amount}
                </span>
              </div>
              <button
                onClick={handleAddAllToCart}
                disabled={addingToCart}
                data-testid="footer-add-all-cart-btn"
                className="px-5 py-2.5 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-black flex items-center gap-2 shadow transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{addingToCart ? 'Adding to Cart...' : 'Add All to Cart'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Edit Settings Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-brand-border space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-brand-navy flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-honey" />
                <span>Essentials Schedule & Settings</span>
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* List Name */}
              <div>
                <label className="text-xs font-bold text-brand-navy block mb-1">
                  List Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  data-testid="setting-list-name-input"
                  className="w-full px-3.5 py-2 rounded-xl border border-brand-border text-xs focus:ring-2 focus:ring-brand-honey focus:outline-none"
                  placeholder="e.g. My Monthly Essentials"
                />
              </div>

              {/* Shopping Day (1-31) */}
              <div>
                <label className="text-xs font-bold text-brand-navy block mb-1">
                  Preferred Monthly Shopping Day (1 to 31)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formShoppingDay}
                    onChange={(e) => setFormShoppingDay(parseInt(e.target.value, 10))}
                    required
                    data-testid="setting-shopping-day-input"
                    className="w-24 px-3.5 py-2 rounded-xl border border-brand-border text-xs font-bold text-brand-navy focus:ring-2 focus:ring-brand-honey focus:outline-none"
                  />
                  <span className="text-[11px] text-brand-muted">
                    Defaults to last day if month is shorter.
                  </span>
                </div>
              </div>

              {/* Reminder Days Before (1-14) */}
              <div>
                <label className="text-xs font-bold text-brand-navy block mb-1">
                  Reminder Window (Days Before Shopping Day)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={formReminderDays}
                    onChange={(e) => setFormReminderDays(parseInt(e.target.value, 10))}
                    required
                    data-testid="setting-reminder-days-input"
                    className="w-24 px-3.5 py-2 rounded-xl border border-brand-border text-xs font-bold text-brand-navy focus:ring-2 focus:ring-brand-honey focus:outline-none"
                  />
                  <span className="text-[11px] text-brand-muted">
                    Days in advance to trigger in-app notification.
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  data-testid="save-essentials-settings-btn"
                  className="px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Product Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-brand-border space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-brand-navy flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-honey" />
                <span>Add Product to Monthly Essentials</span>
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              {/* Search catalog */}
              <div>
                <label className="text-xs font-bold text-brand-navy block mb-1">
                  Search & Select Catalog Product
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by product name or category..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-border text-xs focus:ring-2 focus:ring-brand-honey focus:outline-none"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-brand-border rounded-xl divide-y divide-slate-100">
                  {filteredCatalog.length === 0 ? (
                    <div className="p-4 text-center text-xs text-brand-muted">
                      No matching products found.
                    </div>
                  ) : (
                    filteredCatalog.slice(0, 15).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProductId(p.id)}
                        className={`w-full text-left p-2.5 text-xs flex items-center justify-between hover:bg-amber-50/50 transition-colors ${
                          selectedProductId === p.id ? 'bg-amber-100/70 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <img
                            src={p.image_url || undefined}
                            alt={p.name}
                            className="w-8 h-8 rounded-lg object-cover bg-slate-100 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80';
                            }}
                          />
                          <div className="truncate">
                            <span className="text-brand-navy block truncate">{p.name}</span>
                            <span className="text-[10px] text-brand-muted">{p.category}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-2">
                          <span className="font-bold text-brand-navy">
                            ₹{(typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-brand-muted block">
                            {p.city_stock !== undefined ? `${p.city_stock} in hub` : 'Available'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Quantity input */}
              <div>
                <label className="text-xs font-bold text-brand-navy block mb-1">
                  Monthly Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(parseInt(e.target.value, 10) || 1)}
                  required
                  data-testid="item-quantity-input"
                  className="w-24 px-3.5 py-2 rounded-xl border border-brand-border text-xs font-bold text-brand-navy focus:ring-2 focus:ring-brand-honey focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingItem || !selectedProductId}
                  data-testid="confirm-add-item-btn"
                  className="px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-deep-navy text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {addingItem ? 'Adding...' : 'Add to List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Cart Result Modal */}
      {cartResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-brand-border space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-brand-navy">
                    Essentials Added to Cart!
                  </h3>
                  <p className="text-[11px] text-brand-muted">
                    {cartResultModal.summary.total_items_in_cart} total items now in your shopping cart.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCartResultModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Breakdown summary */}
            <div className="space-y-3 text-xs">
              {cartResultModal.added_items.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                  <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Added / Updated ({cartResultModal.added_items.length} items):</span>
                  </div>
                  <ul className="space-y-1 text-emerald-900/90 pl-5 list-disc">
                    {cartResultModal.added_items.map((item) => (
                      <li key={item.product_id}>
                        {item.product_name} &mdash; <strong>+{item.added_qty} units</strong> (Cart now: {item.final_qty})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cartResultModal.adjusted_items.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
                  <div className="font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Stock Limited / Adjusted ({cartResultModal.adjusted_items.length} items):</span>
                  </div>
                  <ul className="space-y-1 text-amber-900/90 pl-5 list-disc">
                    {cartResultModal.adjusted_items.map((item) => (
                      <li key={item.product_id}>
                        {item.product_name} &mdash; Capped to {item.available_stock} available units in {selectedCity} (Requested: {item.requested_qty})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {cartResultModal.unavailable_items.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200">
                  <div className="font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Unavailable Items ({cartResultModal.unavailable_items.length} items):</span>
                  </div>
                  <ul className="space-y-1 text-rose-900/90 pl-5 list-disc">
                    {cartResultModal.unavailable_items.map((item) => (
                      <li key={item.product_id}>
                        {item.product_name} &mdash; Currently out of stock in {selectedCity}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCartResultModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Keep Browsing
              </button>

              <button
                type="button"
                onClick={() => navigate('/cart')}
                data-testid="proceed-to-cart-btn"
                className="px-5 py-2.5 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-black flex items-center gap-2 shadow transition-all"
              >
                <span>View Shopping Cart</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyEssentialsPage;
