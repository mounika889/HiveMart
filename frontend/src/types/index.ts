export type SupportedCity = 'Bengaluru' | 'Hyderabad' | 'Chennai' | 'Mumbai' | 'Delhi';

export const SUPPORTED_CITIES: SupportedCity[] = [
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Mumbai',
  'Delhi',
];

export type Role = 'customer' | 'retailer' | 'admin';

export type RetailerApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface RetailerProfile {
  id?: string;
  profile_id?: string;
  user_id: string;
  assigned_city: SupportedCity;
  approval_status: RetailerApprovalStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CityInventory {
  city: SupportedCity;
  quantity: number;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string | number;
  image_url: string | null;
  is_active: boolean;
  version?: number;
  created_at?: string;
  updated_at?: string;
  score?: number;
  // Selected city stock when city query parameter is passed
  city_stock?: number;
  city?: string;
  // Fallback total stock when no city is passed
  total_stock?: number;
  // Full inventory breakdown when single product is fetched
  inventory?: CityInventory[];
}

export interface CategoryInfo {
  category: string;
  product_count: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  status: 'ok' | 'error';
  data: T;
  message?: string;
  pagination?: PaginationMetadata;
}

export type ProductSortOption =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'name_desc'
  | 'newest'
  | 'oldest';

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSortOption;
}

export interface SearchParams {
  q?: string;
  category?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSortOption;
  page?: number;
  limit?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'retailer' | 'admin' | string;
  is_active?: boolean;
  retailerProfile?: RetailerProfile;
  assigned_city?: SupportedCity;
  approval_status?: RetailerApprovalStatus;
  created_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<User | void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export interface CartItem {
  item_id: number;
  product_id: string;
  quantity: number;
  product_name: string;
  unit_price: string | number;
  image_url: string | null;
  category: string;
  is_active: boolean;
  subtotal: string | number;
  city_stock?: number;
  is_available_in_city?: boolean;
}

export interface Cart {
  cart_id: string;
  user_id: string;
  items: CartItem[];
  total_items: number;
  total_amount: string;
  city?: string;
}

export interface OrderItem {
  id?: number;
  order_item_id?: number;
  order_id?: string;
  product_id: string;
  quantity: number;
  unit_price: string | number;
  subtotal: string | number;
  product_name: string;
  image_url?: string | null;
  category?: string;
}

export interface Order {
  id: string;
  user_id: string;
  city: string;
  total_amount: string;
  status: 'CONFIRMED' | string;
  idempotency_key: string;
  created_at: string;
  items: OrderItem[];
  total_items?: number;
}

export interface OrderSummary {
  id: string;
  city: string;
  total_amount: string;
  status: string;
  idempotency_key: string;
  created_at: string;
  total_items: number;
}

export interface CheckoutPayload {
  city: string;
  idempotencyKey: string;
}

export interface CartContextType {
  cart: Cart | null;
  totalItems: number;
  totalAmount: string;
  loading: boolean;
  mutationPending: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  refreshCart: () => Promise<void>;
  clearError: () => void;
}

/* ============================================================
   ADMIN & RETAILER DASHBOARD TYPES
   ============================================================ */

export interface CityInventoryOverview {
  city: SupportedCity;
  total_stock: number;
  product_count: number;
  low_stock_count: number;
}

export interface AdminRecentOrder {
  id: string;
  user_id: string;
  city: string;
  total_amount: string;
  status: string;
  created_at: string;
  total_items: number;
}

export interface AdminRetailerItem {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  profile_id?: string;
  assigned_city: SupportedCity;
  approval_status: RetailerApprovalStatus;
  updated_at?: string;
}

export interface AdminOverviewData {
  total_customers: number;
  total_retailers: number;
  pending_retailers: number;
  total_products: number;
  city_inventory: CityInventoryOverview[];
  recent_orders: AdminRecentOrder[];
  offline_stats?: {
    total_offline_bills: number;
    finalized_offline_bills: number;
    total_offline_revenue: string | number;
  };
  alerts_overview?: {
    total_active: number;
    out_of_stock: number;
    critical_stock: number;
    low_stock: number;
    reorder_soon: number;
    bestseller_warnings: number;
  };
}

export interface CreateRetailerPayload {
  name: string;
  email: string;
  password: string;
  assignedCity: SupportedCity;
  approvalStatus?: RetailerApprovalStatus;
}

export interface RetailerInventoryItem {
  id: string;
  name: string;
  category: string;
  price: string | number;
  image_url: string | null;
  is_active: boolean;
  city_stock: number;
  inventory_updated_at?: string;
}

export interface RetailerDashboardData {
  retailer: {
    id: string;
    name: string;
    email: string;
    role: string;
    profile_id?: string;
    assigned_city: SupportedCity;
    approval_status: RetailerApprovalStatus;
    updated_at?: string;
  };
  metrics: {
    total_products: number;
    total_units: number;
    low_stock_count: number;
    out_of_stock_count: number;
    today_finalized_bills?: number;
    today_sales_total?: string | number;
    stock_alerts?: {
      active_alerts: number;
      out_of_stock: number;
      critical_stock: number;
      low_stock: number;
      reorder_soon: number;
      bestseller_warnings: number;
    };
  };
  top_bestsellers?: BestsellerItem[];
  inventory: RetailerInventoryItem[];
  recent_bills?: {
    id: string;
    bill_number: string;
    city: SupportedCity;
    status: string;
    total_amount: string | number;
    created_at: string;
    finalized_at?: string | null;
    item_count: number;
  }[];
}

/* ============================================================
   SPRINT 9G: OFFLINE POS BILLING & INVENTORY AUDIT TYPES
   ============================================================ */

export type OfflineBillStatus = 'DRAFT' | 'FINALIZED' | 'CANCELLED';
export type OfflinePaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'STORE_TERMINAL';

export interface OfflineBillItem {
  id?: string;
  bill_id?: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price_snapshot: string | number;
  quantity: number;
  line_total: string | number;
  image_url?: string | null;
  category?: string;
  current_stock?: number;
}

export interface OfflineBill {
  id: string;
  bill_number: string;
  retailer_id: string;
  city: SupportedCity;
  status: OfflineBillStatus;
  payment_method: OfflinePaymentMethod;
  subtotal_amount: string | number;
  total_amount: string | number;
  idempotency_key?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  finalized_at?: string | null;
  item_count?: number;
  total_units?: number;
  retailer_name?: string;
  retailer_email?: string;
}

export interface OfflineSale {
  id: string;
  bill_id: string;
  retailer_id: string;
  city: SupportedCity;
  total_amount: string | number;
  created_at: string;
}

export interface FinalizeBillResponse {
  bill: OfflineBill;
  sale: OfflineSale;
  items: OfflineBillItem[];
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  product_category?: string;
  city: SupportedCity;
  movement_type: 'ONLINE_SALE' | 'OFFLINE_SALE' | 'ADJUSTMENT';
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  source_type: string;
  source_id: string;
  performed_by?: string | null;
  performed_by_name?: string | null;
  performed_by_email?: string | null;
  created_at: string;
}

export interface AdminOfflineOverviewData {
  totals: {
    total_bills: number;
    finalized_bills: number;
    draft_bills: number;
    total_offline_revenue: string | number;
  };
  city_sales: {
    city: SupportedCity;
    finalized_sales_count: number;
    total_revenue: string | number;
  }[];
  recent_bills: {
    id: string;
    bill_number: string;
    city: SupportedCity;
    status: string;
    total_amount: string | number;
    finalized_at: string;
    retailer_name: string;
    item_count: number;
  }[];
  total_inventory_movements: number;
}

// ============================================================
// Sprint 9H: Smart Inventory Notifications & Bestsellers
// ============================================================

export type StockAlertType =
  | 'REORDER_SOON'
  | 'LOW_STOCK'
  | 'CRITICAL_STOCK'
  | 'OUT_OF_STOCK'
  | 'BESTSELLER_REPLENISHMENT';

export type StockAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'URGENT';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  alert_id?: string;
  alert_type?: StockAlertType;
  severity?: StockAlertSeverity;
  current_stock?: number;
  threshold_value?: number;
  alert_status?: AlertStatus;
  product_id?: string;
  product_name?: string;
  product_category?: string;
  image_url?: string | null;
  city?: SupportedCity;
}

export interface StockAlert {
  id: string;
  product_id: string;
  city: SupportedCity;
  alert_type: StockAlertType;
  severity: StockAlertSeverity;
  current_stock: number;
  threshold_value: number;
  status: AlertStatus;
  details?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  acknowledged_at?: string | null;
  product_name: string;
  product_category: string;
  image_url?: string | null;
  price: string | number;
}

export interface BestsellerItem {
  rank: number;
  productId: string;
  productName: string;
  category: string;
  price: string | number;
  imageUrl?: string | null;
  currentStock: number;
  onlineUnits: number;
  offlineUnits: number;
  totalUnits: number;
  avgDailySales: number;
  daysOfStockRemaining: number | null;
  replenishmentWarning: boolean;
}

export interface BestsellerReport {
  city: SupportedCity;
  monthStart: string;
  daysObserved: number;
  hasSufficientHistory: boolean;
  totalBestsellers: number;
  coverageThresholdDays: number;
  bestsellers: BestsellerItem[];
}

export interface StockAlertSetting {
  product_id: string;
  product_name: string;
  product_category: string;
  city: SupportedCity;
  current_stock: number;
  setting_id?: string;
  early_warning_threshold: number;
  minimum_stock_threshold: number;
  critical_stock_threshold: number;
  enabled: boolean;
  setting_updated_at?: string;
}

export interface RetailerAlertsSummary {
  active_alerts: number;
  out_of_stock: number;
  critical_stock: number;
  low_stock: number;
  reorder_soon: number;
  bestseller_warnings: number;
}

/* ============================================================
   SPRINT 9I: MONTHLY ESSENTIALS & REMINDERS TYPES
   ============================================================ */

export interface MonthlyEssentialItem {
  item_id: string;
  product_id: string;
  quantity: number;
  product_name: string;
  current_price: string;
  category: string;
  image_url: string;
  is_active: boolean;
  city_stock?: number;
  is_available_in_city?: boolean;
  line_subtotal: string;
  created_at: string;
}

export interface MonthlyEssentialList {
  id: string;
  user_id: string;
  name: string;
  shopping_day: number;
  reminder_days_before: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items_count?: number;
  total_units?: number;
  total_items?: number;
  total_amount?: string;
  city?: string;
  items?: MonthlyEssentialItem[];
  next_shopping_date?: string;
  reminder_date?: string;
  is_reminder_due?: boolean;
}

export interface MonthlyReminder {
  reminder_id: string;
  list_id: string;
  due_date: string;
  reminder_date: string;
  status: 'PENDING' | 'SENT' | 'READ' | 'DISMISSED';
  read_at: string | null;
  created_at: string;
  list_name: string;
  shopping_day: number;
  list_active: boolean;
  items_count: number;
}

export interface AddEssentialsToCartResult {
  status: string;
  message: string;
  summary: {
    added_count: number;
    adjusted_count: number;
    unavailable_count: number;
    total_items_in_cart: number;
    total_cart_amount: string;
  };
  added_items: Array<{
    product_id: string;
    product_name: string;
    requested_qty: number;
    already_in_cart: number;
    added_qty: number;
    final_qty: number;
    current_price?: string;
  }>;
  adjusted_items: Array<{
    product_id: string;
    product_name: string;
    requested_qty: number;
    already_in_cart: number;
    added_qty: number;
    final_qty: number;
    available_stock: number;
    reason: string;
  }>;
  unavailable_items: Array<{
    product_id: string;
    product_name: string;
    requested_qty: number;
    available_stock?: number;
    reason: string;
  }>;
  cart: Cart;
}


