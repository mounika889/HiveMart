import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  MapPin,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Printer,
  RotateCcw,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  RetailerDashboardData,
  RetailerInventoryItem,
  OfflineBill,
  OfflineBillItem,
  OfflinePaymentMethod,
} from '../types/index.ts';
import { getRetailerDashboard } from '../services/retailer.ts';
import {
  getActiveDraftBill,
  createDraftBill,
  updateDraftItems,
  cancelDraftBill,
  finalizeBill,
} from '../services/pos.ts';
import { LoadingSpinner } from '../components/common/LoadingSpinner.tsx';

export const PosTerminalPage: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<RetailerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Draft state
  const [activeBill, setActiveBill] = useState<OfflineBill | null>(null);
  const [draftItems, setDraftItems] = useState<OfflineBillItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<OfflinePaymentMethod>('CASH');
  const [notes, setNotes] = useState('');
  const [isUpdatingItems, setIsUpdatingItems] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Finalized Bill Receipt View
  const [finalizedReceipt, setFinalizedReceipt] = useState<{
    bill: OfflineBill;
    items: OfflineBillItem[];
  } | null>(null);

  // Catalog search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Load Retailer details and existing draft
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, draftRes] = await Promise.all([
        getRetailerDashboard(),
        getActiveDraftBill().catch(() => null),
      ]);
      setDashboardData(dash);

      if (draftRes && draftRes.bill) {
        setActiveBill(draftRes.bill);
        setDraftItems(draftRes.items || []);
        if (draftRes.bill.payment_method) {
          setPaymentMethod(draftRes.bill.payment_method);
        }
        if (draftRes.bill.notes) {
          setNotes(draftRes.bill.notes);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize POS terminal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Extract categories from retailer inventory
  const categories = useMemo(() => {
    if (!dashboardData?.inventory) return [];
    const set = new Set<string>();
    dashboardData.inventory.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [dashboardData]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    if (!dashboardData?.inventory) return [];
    return dashboardData.inventory.filter((item: RetailerInventoryItem) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCategory = item.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesCategory) return false;
      }
      return true;
    });
  }, [dashboardData, selectedCategory, searchQuery]);

  // Sync draft items with backend
  const syncItemsToBackend = async (
    itemsList: { productId: string; quantity: number }[],
    updatedNotes?: string,
    updatedMethod?: string
  ) => {
    setIsUpdatingItems(true);
    setError(null);
    try {
      let billId = activeBill?.id;

      // If no active bill exists yet, create draft
      if (!billId) {
        const createRes = await createDraftBill({
          paymentMethod: updatedMethod || paymentMethod,
          notes: updatedNotes !== undefined ? updatedNotes : notes,
          items: itemsList,
        });
        setActiveBill(createRes.bill);
        setDraftItems(createRes.items || []);
        return;
      }

      // Update existing draft
      const updateRes = await updateDraftItems(billId, {
        items: itemsList,
        notes: updatedNotes !== undefined ? updatedNotes : notes,
        paymentMethod: updatedMethod || paymentMethod,
      });
      setActiveBill(updateRes.bill);
      setDraftItems(updateRes.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update draft bill.');
    } finally {
      setIsUpdatingItems(false);
    }
  };

  // Add item or increment quantity
  const handleAddItem = async (product: RetailerInventoryItem) => {
    if (product.city_stock <= 0) {
      setError(`Cannot add "${product.name}": Out of stock in ${dashboardData?.retailer.assigned_city} warehouse.`);
      return;
    }

    const existingIndex = draftItems.findIndex((it) => it.product_id === product.id);
    let nextItems: { productId: string; quantity: number }[] = [];

    if (existingIndex >= 0) {
      const currentQty = draftItems[existingIndex].quantity;
      if (currentQty >= product.city_stock) {
        setError(`Cannot exceed available stock (${product.city_stock}) for "${product.name}".`);
        return;
      }
      nextItems = draftItems.map((it, idx) =>
        idx === existingIndex ? { productId: it.product_id, quantity: it.quantity + 1 } : { productId: it.product_id, quantity: it.quantity }
      );
    } else {
      nextItems = [
        ...draftItems.map((it) => ({ productId: it.product_id, quantity: it.quantity })),
        { productId: product.id, quantity: 1 },
      ];
    }

    await syncItemsToBackend(nextItems);
  };

  // Update item quantity
  const handleUpdateQuantity = async (productId: string, newQty: number) => {
    const invItem = dashboardData?.inventory.find((i) => i.id === productId);
    const maxStock = invItem ? invItem.city_stock : 999;

    if (newQty > maxStock) {
      setError(`Cannot exceed available warehouse stock (${maxStock}).`);
      return;
    }

    let nextItems: { productId: string; quantity: number }[] = [];
    if (newQty <= 0) {
      nextItems = draftItems
        .filter((it) => it.product_id !== productId)
        .map((it) => ({ productId: it.product_id, quantity: it.quantity }));
    } else {
      nextItems = draftItems.map((it) =>
        it.product_id === productId ? { productId: it.product_id, quantity: newQty } : { productId: it.product_id, quantity: it.quantity }
      );
    }

    await syncItemsToBackend(nextItems);
  };

  // Remove item from draft
  const handleRemoveItem = async (productId: string) => {
    const nextItems = draftItems
      .filter((it) => it.product_id !== productId)
      .map((it) => ({ productId: it.product_id, quantity: it.quantity }));
    await syncItemsToBackend(nextItems);
  };

  // Cancel draft bill
  const handleCancelDraft = async () => {
    if (!activeBill?.id) {
      setDraftItems([]);
      return;
    }

    setIsCancelling(true);
    setError(null);
    try {
      await cancelDraftBill(activeBill.id);
      setActiveBill(null);
      setDraftItems([]);
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel draft bill.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Finalize bill
  const handleFinalizeBill = async () => {
    if (!activeBill?.id) return;
    if (draftItems.length === 0) {
      setError('Cannot finalize an empty bill. Please add products first.');
      return;
    }

    setIsFinalizing(true);
    setError(null);
    setShowConfirmModal(false);

    try {
      // Deterministic client idempotency key
      const idempotencyKey = `pos-${activeBill.id}-${Date.now()}`;
      const res = await finalizeBill(activeBill.id, {
        paymentMethod,
        notes,
        idempotencyKey,
      });

      // Save receipt state
      setFinalizedReceipt({
        bill: res.bill,
        items: res.items,
      });

      // Clear active draft
      setActiveBill(null);
      setDraftItems([]);
      setNotes('');

      // Refresh warehouse stock
      const freshDash = await getRetailerDashboard().catch(() => null);
      if (freshDash) {
        setDashboardData(freshDash);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize bill. Transaction was safely rolled back.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Reset receipt view to start new bill
  const handleStartNewBill = () => {
    setFinalizedReceipt(null);
    setActiveBill(null);
    setDraftItems([]);
    setNotes('');
    setError(null);
  };

  // Calculate local draft totals
  const subtotal = useMemo(() => {
    return draftItems.reduce((acc, it) => acc + Number(it.line_total || (Number(it.unit_price_snapshot) * it.quantity)), 0);
  }, [draftItems]);

  const totalUnits = useMemo(() => {
    return draftItems.reduce((acc, it) => acc + it.quantity, 0);
  }, [draftItems]);

  if (loading && !dashboardData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20">
        <LoadingSpinner size="lg" message="Initializing POS Billing Terminal..." />
      </div>
    );
  }

  const retailer = dashboardData?.retailer;

  // Render Finalized Receipt View
  if (finalizedReceipt) {
    const { bill, items } = finalizedReceipt;
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Success Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h2 className="text-sm font-bold">Bill Finalized & Warehouse Stock Deducted</h2>
              <p className="text-xs text-emerald-700 mt-0.5">
                Centralized inventory for {bill.city} warehouse updated and outbox event published.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>

        {/* Printable Receipt Card */}
        <div className="bg-white rounded-3xl border border-brand-border p-6 sm:p-8 shadow-card printable-receipt">
          {/* Header */}
          <div className="border-b border-brand-border pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-brand-navy">
                  Hive<span className="text-brand-honey">Mart</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-brand-deep-navy text-white text-[10px] font-bold uppercase">
                  Retail Store
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-1">
                Regional Hub: <strong className="text-brand-navy">{bill.city}</strong>
              </p>
              <p className="text-xs text-brand-muted">
                Billed by: <strong className="text-brand-navy">{bill.retailer_name || retailer?.name}</strong>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider mb-1">
                {bill.status}
              </span>
              <p className="text-xs font-mono font-bold text-brand-navy">Bill #{bill.bill_number}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {bill.finalized_at ? new Date(bill.finalized_at).toLocaleString('en-IN') : new Date(bill.created_at).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-6 border-b border-brand-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Unit Price</th>
                  <th className="pb-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={it.id || idx} className="py-2.5">
                    <td className="py-2.5 font-medium text-brand-navy">
                      <div>{it.product_name_snapshot}</div>
                      {it.category && <span className="text-[10px] text-brand-muted">{it.category}</span>}
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-700">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono text-slate-600">₹{Number(it.unit_price_snapshot).toFixed(2)}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-brand-navy">
                      ₹{Number(it.line_total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment & Totals */}
          <div className="pt-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="text-xs text-slate-600 max-w-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-bold text-brand-navy">Payment Method:</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-brand-navy text-[11px]">
                  {bill.payment_method}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Payment collected in-person at counter. Offline retail billing record safely synced with centralized warehouse inventory.
              </p>
              {bill.notes && (
                <p className="mt-2 text-[11px] text-slate-700 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                  Notes: {bill.notes}
                </p>
              )}
            </div>

            <div className="w-full sm:w-64 space-y-2 text-right">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Total Items:</span>
                <span className="font-bold text-slate-700">{items.reduce((acc, it) => acc + it.quantity, 0)} units</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-700">₹{Number(bill.subtotal_amount).toFixed(2)}</span>
              </div>
              <div className="border-t border-brand-border pt-2 flex justify-between items-baseline">
                <span className="text-sm font-bold text-brand-navy">Grand Total:</span>
                <span className="text-xl font-extrabold text-brand-navy font-mono">
                  ₹{Number(bill.total_amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            to="/retailer/bills"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all text-center"
          >
            View All Store Bills
          </Link>
          <button
            type="button"
            onClick={handleStartNewBill}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-honey hover:bg-amber-400 text-brand-navy text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Start New Bill</span>
          </button>
        </div>
      </div>
    );
  }

  // Active Terminal View
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-left">
      {/* 1. Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-honey text-brand-navy text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Store className="w-3 h-3" />
              In-Store POS Terminal
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-deep-navy text-white text-[11px] font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-brand-honey" />
              Warehouse: {retailer?.assigned_city}
            </span>
            {activeBill && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-bold">
                Bill #{activeBill.bill_number} (DRAFT)
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-brand-navy tracking-tight">
            Counter Sales & In-Store Billing
          </h1>
          <p className="text-xs text-brand-muted">
            Add items to draft bill. Stock is deducted centrally from <strong className="text-brand-navy">{retailer?.assigned_city}</strong> warehouse upon finalization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/retailer/bills"
            className="px-3.5 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            <span>Bill History</span>
          </Link>
          <Link
            to="/retailer/dashboard"
            className="px-3.5 py-2 rounded-xl bg-white border border-brand-border hover:bg-slate-50 text-brand-navy text-xs font-bold transition-all shadow-sm"
          >
            Inventory Hub
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[11px] font-bold text-red-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main Terminal Grid (Left: Catalog, Right: Current Bill Pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Product Catalog & Search (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Search & Category Filter Controls */}
          <div className="bg-white rounded-2xl border border-brand-border p-4 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search products by title or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-brand-border bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey focus:bg-white"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter catalog by category"
              className="px-3 py-1.5 rounded-xl border border-brand-border bg-slate-50 text-xs font-semibold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-honey"
            >
              <option value="ALL">All Categories ({dashboardData?.inventory.length || 0})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredProducts.map((prod) => {
              const inStock = prod.city_stock > 0;
              const isLowStock = prod.city_stock > 0 && prod.city_stock < 10;
              const draftItem = draftItems.find((it) => it.product_id === prod.id);
              const draftQty = draftItem ? draftItem.quantity : 0;

              return (
                <div
                  key={prod.id}
                  className={`bg-white rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                    inStock ? 'border-brand-border hover:border-brand-honey hover:shadow-card' : 'border-slate-200 opacity-60 bg-slate-50'
                  }`}
                >
                  <div>
                    {/* Image & Stock Badge */}
                    <div className="relative aspect-square w-full rounded-xl bg-slate-100 overflow-hidden mb-2.5">
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Layers className="w-8 h-8" />
                        </div>
                      )}
                      <span
                        className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          !inStock
                            ? 'bg-red-500 text-white'
                            : isLowStock
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {inStock ? `${prod.city_stock} left` : 'Out of Stock'}
                      </span>
                    </div>

                    <h2 className="text-xs font-bold text-brand-navy line-clamp-2 leading-tight">
                      {prod.name}
                    </h2>
                    <p className="text-[10px] text-brand-muted mt-0.5 truncate">{prod.category}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-brand-navy font-mono">
                      ₹{Number(prod.price).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      disabled={!inStock || isUpdatingItems || draftQty >= prod.city_stock}
                      onClick={() => handleAddItem(prod)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                        !inStock || draftQty >= prod.city_stock
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-brand-honey hover:bg-amber-400 text-brand-navy shadow-sm'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>{draftQty > 0 ? `+1 (${draftQty})` : 'Add'}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-brand-muted bg-white rounded-2xl border border-brand-border p-6">
                <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-brand-navy">No products match your criteria.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try a different search term or category filter.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Draft Bill & Checkout Controls (5 Cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-brand-border p-5 shadow-card flex flex-col sticky top-24">
            {/* Bill Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-brand-navy">
                    {activeBill ? `Bill #${activeBill.bill_number}` : 'New Bill Draft'}
                  </h2>
                  <p className="text-[10px] text-brand-muted">
                    {activeBill ? 'In-progress draft' : 'Draft will be created on first item'}
                  </p>
                </div>
              </div>

              {activeBill && draftItems.length > 0 && (
                <button
                  type="button"
                  disabled={isCancelling || isUpdatingItems}
                  onClick={handleCancelDraft}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Cancel Draft</span>
                </button>
              )}
            </div>

            {/* Items List */}
            <div className="my-3 max-h-[300px] overflow-y-auto divide-y divide-slate-100 pr-1">
              {draftItems.map((it) => (
                <div key={it.product_id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-navy truncate">
                      {it.product_name_snapshot}
                    </p>
                    <p className="text-[10px] text-brand-muted font-mono">
                      ₹{Number(it.unit_price_snapshot).toFixed(2)} each
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isUpdatingItems}
                      onClick={() => handleUpdateQuantity(it.product_id, it.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold disabled:opacity-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-brand-navy">
                      {it.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={isUpdatingItems}
                      onClick={() => handleUpdateQuantity(it.product_id, it.quantity + 1)}
                      className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="text-right shrink-0 min-w-[60px]">
                    <p className="text-xs font-bold text-brand-navy font-mono">
                      ₹{Number(it.line_total).toFixed(2)}
                    </p>
                    <button
                      type="button"
                      disabled={isUpdatingItems}
                      onClick={() => handleRemoveItem(it.product_id)}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {draftItems.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">Bill is currently empty</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Click &ldquo;Add&rdquo; on any catalog item on the left.</p>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="pt-3 border-t border-brand-border">
              <label className="block text-[11px] font-bold text-brand-muted uppercase tracking-wider mb-2">
                Payment Method Collected
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'CARD', label: 'Card / POS', icon: CreditCard },
                  { id: 'UPI', label: 'Store UPI QR', icon: Smartphone },
                  { id: 'STORE_TERMINAL', label: 'Terminal', icon: Store },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id as OfflinePaymentMethod);
                        if (activeBill?.id) {
                          syncItemsToBackend(
                            draftItems.map((it) => ({ productId: it.product_id, quantity: it.quantity })),
                            notes,
                            m.id
                          );
                        }
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all ${
                        isSelected
                          ? 'border-brand-navy bg-brand-navy text-white shadow-sm'
                          : 'border-brand-border bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-brand-honey' : 'text-slate-500'}`} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Customer/Invoice Notes */}
            <div className="mt-3">
              <input
                type="text"
                placeholder="Optional customer reference or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (activeBill?.id) {
                    syncItemsToBackend(
                      draftItems.map((it) => ({ productId: it.product_id, quantity: it.quantity })),
                      notes,
                      paymentMethod
                    );
                  }
                }}
                className="w-full px-3 py-1.5 rounded-xl border border-brand-border bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-brand-honey"
              />
            </div>

            {/* Totals Summary */}
            <div className="mt-4 pt-3 border-t border-brand-border space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Items Count:</span>
                <span className="font-bold text-slate-700">{totalUnits} units</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-700">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between items-baseline">
                <span className="text-sm font-extrabold text-brand-navy">Grand Total:</span>
                <span className="text-xl font-black text-brand-navy font-mono">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Finalize Action Button */}
            <button
              type="button"
              disabled={draftItems.length === 0 || isUpdatingItems || isFinalizing}
              onClick={() => setShowConfirmModal(true)}
              className="mt-4 w-full py-3 rounded-2xl bg-brand-honey hover:bg-amber-400 text-brand-navy font-extrabold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-brand-navy" />
              <span>Finalize & Deduct Warehouse Stock</span>
            </button>

            <p className="mt-2 text-[10px] text-center text-slate-400">
              Drafts do not deduct stock. Centralized city inventory is only modified upon finalization.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-brand-border">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-brand-navy text-center">
              Confirm Final Bill Finalization
            </h3>
            <p className="text-xs text-slate-600 mt-2 text-center leading-relaxed">
              You are about to finalize <strong className="text-brand-navy">Bill #{activeBill?.bill_number}</strong> with{' '}
              <strong className="text-brand-navy">{totalUnits} items</strong> totaling{' '}
              <strong className="text-brand-navy font-mono">₹{subtotal.toFixed(2)}</strong>.
            </p>

            <div className="my-4 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                <span>Centralized Warehouse Stock Deduction</span>
              </p>
              <p className="text-amber-800">
                This transaction locks and immediately deducts stock from the{' '}
                <strong>{retailer?.assigned_city}</strong> warehouse. Once finalized, a bill cannot be edited or cancelled.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-brand-border bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={isFinalizing}
                onClick={handleFinalizeBill}
                className="flex-1 py-2.5 rounded-xl bg-brand-navy hover:bg-slate-800 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isFinalizing ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-brand-honey" />
                    <span>Confirm & Finalize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosTerminalPage;
