# HiveMart Frontend (Sprints 9A, 9B, 9C, 9D, 9E, 9F, 9G, 9H & 9I)

Modern, responsive Indian e-commerce and retail POS billing platform built for the **Hack With Bengaluru** hackathon.

**Brand Tagline**: *"Your City. Your Cart. Your Hive."*

---

## Tech Stack
* **Framework**: React 18 with TypeScript
* **Build Tool**: Vite 6
* **Styling**: Tailwind CSS 3 with custom HiveMart design tokens
* **Routing**: React Router DOM 6
* **Icons**: Lucide React
* **Backend Connection**: Express REST API (`http://localhost:5000/api`) with Aiven PostgreSQL, OpenSearch, and Kafka

---

## HiveMart Design System

| Color Role | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Primary Navy** | `#14213D` | Headers, navbar, primary branding, strong text accents |
| **Deep Navy** | `#0B1730` | Footer, secondary nav, dark container surfaces |
| **Honey Yellow** | `#F5B700` | Highlights, badges, active controls, hero CTAs |
| **Soft Honey** | `#FFF4CC` | Category pills, subtle badge backgrounds, hover states |
| **Background** | `#F8FAFC` | Page body background (clean Slate 50) |
| **White** | `#FFFFFF` | Card surfaces, modals, popovers |
| **Primary Text** | `#172033` | Headings, high-contrast product titles |
| **Muted Text** | `#64748B` | Secondary details, metadata, inventory counts |
| **Borders** | `#E2E8F0` | Dividers, card borders, subtle separators |

---

## Directory Architecture

```
frontend/
├── .env.example              # Frontend environment variables template
├── .env                      # Local environment configuration (ignored by git)
├── .gitignore                # Git ignore rules
├── index.html                # HTML5 entry with Google Fonts (Inter) and SVG Hive icon
├── package.json              # Dependencies and build scripts
├── postcss.config.js         # PostCSS configuration for Tailwind CSS
├── tailwind.config.js        # Design tokens and custom theme extension
├── tsconfig.json             # TypeScript compiler settings for frontend app
├── tsconfig.node.json        # TypeScript compiler settings for Vite config
├── vite.config.ts            # Vite bundler configuration with API reverse proxy
├── public/
│   └── hive-icon.svg         # Stylized hexagon honeycomb brand icon
└── src/
    ├── App.tsx               # App router, CityProvider context, navbar, footer layout
    ├── index.css             # Tailwind base layers and custom utility styles
    ├── main.tsx              # React DOM root initialization
    ├── vite-env.d.ts         # Vite client type definitions
    ├── types/
    │   └── index.ts          # TypeScript interfaces for Product, Category, City, User, Auth
    ├── context/
    │   ├── CityContext.tsx   # Global city selector context with localStorage persistence
    │   ├── AuthContext.tsx   # Customer JWT authentication context & session management
    │   └── CartContext.tsx   # PostgreSQL persistent cart context & stock synchronization
    ├── hooks/
    │   ├── useAuth.ts        # Custom hook for authentication state & actions
    │   └── useCart.ts        # Custom hook for shopping cart state & mutations
    ├── services/
    │   ├── api.ts            # Reusable client for /categories, /products, /health, /search
    │   ├── auth.ts           # Customer auth client for /auth/register, /auth/login, /auth/me
    │   ├── cart.ts           # Customer cart client for /cart, /cart/items, /cart
    │   ├── order.ts          # Order & checkout client for /checkout, /orders
    │   ├── retailer.ts       # Sprint 9F Retailer & Admin client for /retailer, /admin
    │   ├── pos.ts            # Sprint 9G POS Billing terminal client for /retailer/pos, /admin/offline
    │   └── notifications.ts  # Sprint 9H Smart Inventory Alerts & Bestseller Analytics client
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx # Route guard redirecting unauthenticated users to /login
    │   ├── layout/
    │   │   ├── Navbar.tsx    # Responsive header with city selector, search, user & cart badges
    │   │   └── Footer.tsx    # Multi-column footer with hub coverage and tech stack
    │   └── common/
    │       ├── Badge.tsx     # Reusable status and category pill badge
    │       ├── ErrorState.tsx# Network / API error card with retry control
    │       ├── LoadingSpinner.tsx # Animated loading indicator
    │       └── ProductCard.tsx    # Product card with INR price, city stock badge, Add to Cart
    └── pages/
        ├── HomePage.tsx      # Sprint 9A Hero, trust benefits, categories, featured items
        ├── ProductsPage.tsx  # Sprint 9B complete catalog & OpenSearch smart search
        ├── ProductDetailPage.tsx # Real product details, 5-city stock breakdown, Add to Cart
        ├── LoginPage.tsx     # Sprint 9C interactive login with validation & deep link return
        ├── RegisterPage.tsx  # Sprint 9C customer registration with password match validation
        ├── AccountPage.tsx   # Sprint 9C protected customer profile with city & logout
        ├── CartPage.tsx      # Sprint 9D complete shopping cart with quantity controls & stock alerts
        ├── CheckoutPage.tsx  # Sprint 9D atomic checkout with row locking & idempotency protection
        ├── OrdersPage.tsx    # Sprint 9D customer order history with status tracking
        ├── OrderDetailPage.tsx # Sprint 9D order confirmation & receipt drilldown
        ├── RetailerDashboardPage.tsx # Sprint 9F/9H Retailer portal with inventory, POS, stock alerts & bestsellers
        ├── AdminDashboardPage.tsx    # Sprint 9F/9G/9H Admin platform metrics, multi-city stock alerts matrix & thresholds
        ├── RetailerNotificationsPage.tsx # Sprint 9H Smart Warehouse Notification Center & alert actions
        ├── PosTerminalPage.tsx       # Sprint 9G Offline retail POS terminal & atomic finalization
        ├── RetailerBillsPage.tsx     # Sprint 9G Retailer bill history & status filtering
        ├── BillDetailPage.tsx        # Sprint 9G Printable bill receipt view
        └── NotFoundPage.tsx  # 404 Error page
```

---

## Local Development Instructions (Windows PowerShell)

Run backend and frontend in two separate terminal windows:

### Terminal 1: Backend API
```powershell
cd C:\Users\ADMIN\Desktop\Hivemart\backend
npm.cmd run dev
```
*Backend runs on `http://localhost:5000`.*

### Terminal 2: Frontend Web App
```powershell
cd C:\Users\ADMIN\Desktop\Hivemart\frontend
npm.cmd run dev
```
*Frontend runs on `http://localhost:3000` (or the next available port assigned by Vite).*

---

## Environment Configuration

Copy `.env.example` to `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

> **Security Note**: Never place backend database credentials, Kafka SASL passwords, OpenSearch URLs, or JWT secrets in the frontend environment files. The frontend only talks to the Express API.

---

## Key Features Implemented in Sprint 9A
1. **Dynamic Real-Time City Context**:
   - Supported cities: Bengaluru, Hyderabad, Chennai, Mumbai, Delhi.
   - Defaults to **Bengaluru** and persists automatically in browser `localStorage`.
   - Modifying the city instantly refreshes featured products with city-specific warehouse quantities.
2. **Backend Catalog Integration**:
   - `GET /api/categories` dynamically populates the secondary navbar and category cards.
   - `GET /api/products?city=[city]&limit=8` renders real PostgreSQL products with city stock.
   - Live price formatting in Indian Rupees (`₹`).
   - Visual stock indicator: "In Stock", "Low Stock (X left)", or "Out of Stock" per city.
3. **Resilient Failure Handling**:
   - Loading skeletons and animated spinners.
   - Clean error banner with one-click retry if backend is unavailable.
   - Fallback vector illustration if external product image fails to load.
4. **Responsive Mobile-First Navigation**:
   - Desktop: Full search bar, city dropdown, category rail, login, orders, cart counter.
   - Mobile: Hamburger drawer, compact search, mobile city switcher.

---

## Key Features Implemented in Sprint 9B
1. **Complete Product Catalog (`/products`)**:
   - Desktop 4-column filter sidebar and responsive 3-column product grid.
   - Mobile slide-over filter drawer with active filter badges.
   - Real-time results count ("Showing X of Y products").
   - Filter chips bar with one-click individual dismiss and "Reset All" buttons.
2. **Aiven OpenSearch Integration (`GET /api/search`)**:
   - Full-text BM25 search with exact phrase and term boosting.
   - Smart typo-tolerant fuzzy matching (e.g. `headfones` -> `headphones`, `shampo` -> `shampoo`).
   - 350ms input debounce and `AbortController` cancellation to eliminate stale response races.
3. **Multi-Faceted Filtering & Sorting**:
   - **Category Filter**: Dynamically fetched from `GET /api/categories`.
   - **City Warehouse Stock**: Filter products by city inventory in Bengaluru, Hyderabad, Chennai, Mumbai, Delhi.
   - **In-Stock Only**: Exclude out-of-stock items in the active city with real-time toggle.
   - **Price Range**: Min and Max price inputs with validation (`min <= max`) and quick price tier chips (Under ₹500, ₹500–₹1,500, etc.).
   - **Sorting**: Relevance, Price: Low to High (`price_asc`), Price: High to Low (`price_desc`), Name: A to Z (`name_asc`), Name: Z to A (`name_desc`), and Newest.
4. **Backend-Driven Pagination**:
   - 12 products per page with server-calculated page counts, previous/next controls, and page number buttons.
   - Automatic reset to page 1 on filter or search updates.
5. **Bidirectional URL Query Parameter Synchronization**:
   - Query string (`?q=...&category=...&city=...&minPrice=...&maxPrice=...&inStock=...&sort=...&page=...`) reflects all active filters.
   - Browser back/forward buttons seamlessly restore previous search states.
   - Shareable URLs persist filtered catalog views.
6. **Enhanced Product Detail Page (`/products/:id`)**:
   - Large product image with fallback.
   - Comprehensive description, category, and INR price.
   - Active city stock badge (In Stock / Low Stock / Out of Stock).
   - 5-City National Hub Availability Grid (Bengaluru, Hyderabad, Chennai, Mumbai, Delhi).
   - In-page city switcher allowing direct stock comparisons across cities.
   - "Related in [Category]" carousel fetching real products from the same category.
   - "Share Product" button with clipboard link copy feedback.
7. **Verification Suites**:
   - `npm.cmd run test:sprint9a` (33 tests passed, 0 failed)
   - `npm.cmd run test:sprint9b` (80 tests passed, 0 failed)

---

## Key Features Implemented in Sprint 9C
1. **Customer Registration (`/register`)**:
   - Form fields: Full Name, Email Address, Password, Confirm Password.
   - Client-side validation: Name >= 2 chars, valid email pattern, password >= 6 chars, password matching confirmation.
   - Toggleable password visibility (show/hide toggle).
   - Server error banner handling (e.g. HTTP 409 "Email is already registered.", HTTP 400 validation).
   - Real-time submission state with loading spinner and disabled submit during requests.
   - On success: establishes session, persists token, and redirects to requested destination or `/account`.
2. **Customer Sign In (`/login`)**:
   - Form fields: Email Address, Password with show/hide password toggle.
   - Client-side validation and server error banner for invalid credentials (HTTP 401 "Invalid email or password.").
   - Deep link redirection: preserves and returns to original destination via `location.state.from` upon successful authentication.
   - Navigation links to `/register` and homepage.
3. **Session Management & Architecture (`AuthContext`, `useAuth`)**:
   - Centralized authentication context managing `user`, `token`, `isAuthenticated`, `loading`, and `error`.
   - Token persistence via standard Bearer token in `localStorage` under `hivemart_token`.
   - Session restoration on application startup: validates token with backend `GET /api/auth/me`. If valid, hydrates user profile; if expired/invalid, automatically clears token and prompts sign in.
   - Complete client logout: invalidates client session, clears token, and redirects to `/login`.
4. **Protected Route & Route Guards (`ProtectedRoute`)**:
   - Reusable `ProtectedRoute` component wrapping authenticated routes.
   - Checks `isAuthenticated` and `loading`.
   - Renders a clean loading spinner (`LoadingSpinner`) during session verification.
   - Automatically redirects unauthenticated guests to `/login`, preserving `state: { from: location }` for post-login return.
   - Catalog (`/products`), product details (`/products/:id`), search, and homepage remain 100% accessible to unauthenticated guests.
5. **Customer Profile Page (`/account`)**:
   - Displays real authenticated customer information from backend: Name, Email, Customer UUID, Role (`customer`), Member Since date.
   - Current delivery city indicator linked with global `CityContext`.
   - Quick navigation action cards to My Orders (`/orders`), Cart (`/cart`), and Catalog (`/products`).
   - One-click Sign Out button with automatic session cleanup and redirect.
6. **Responsive Navbar Account Integration**:
   - When unauthenticated: displays clean "Sign In" link to `/login`.
   - When authenticated: renders customer first name and user avatar badge with initials.
   - Desktop user dropdown menu: customer name & email header, "My Account" (`/account`), "My Orders" (`/orders`), and "Sign Out".
   - Mobile navigation drawer: displays signed-in user status, account links, and sign-out button.
7. **Security & Data Isolation**:
   - Cross-user data isolation verified: tokens strictly access and isolate each customer's own profile.
   - No sensitive passwords stored in state longer than required; no passwords in web storage.
   - No JWT secrets or signing keys present in frontend source or build artifacts.
   - Tokens never transmitted in URL query strings.
8. **Verification Suites**:
   - `npm.cmd run test:sprint9a` (33 tests passed, 0 failed)
   - `npm.cmd run test:sprint9b` (80 tests passed, 0 failed)
   - `npm.cmd run test:sprint9c` (94 tests passed, 0 failed)
   - `npm.cmd run build` (Clean production bundle built with 0 TypeScript errors)

---

## Key Features Implemented in Sprint 9D
1. **Persistent PostgreSQL Shopping Cart**:
   - Backend-authoritative persistent cart synchronized via `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`, and `DELETE /api/cart`.
   - Automatic merge on duplicate adds (increments quantity instead of throwing 409 conflict).
   - Dynamic city-wise inventory projection: `GET /api/cart?city=[city]` automatically joins `inventory` table to compute `city_stock` and `is_available_in_city` per item.
2. **Real Add to Cart & Navbar Cart Badge**:
   - Add to Cart enabled on Product Detail Page (`/products/:id`) and Product Cards (`ProductCard`).
   - Quantity controls with live city stock limits.
   - Navbar cart badge (`navbar-cart-badge`) tracks the cumulative sum of items across cart lines (e.g., 2 + 3 = 5 items).
   - Unauthenticated visitors clicking "Add to Cart" are redirected to `/login` with `state: { from: location }` to return after authentication.
3. **Complete Shopping Cart View (`/cart`)**:
   - Itemized product list with image, category, unit price in INR, quantity stepper (`-`/`+`), line totals, and remove button.
   - Prominent insufficient stock alert banner if any item exceeds available stock in the selected delivery city.
   - Clear Cart action with confirmation modal to prevent accidental loss.
   - Order summary sidebar with total amount and "Proceed to Checkout" button.
4. **Atomic PostgreSQL Checkout (`POST /api/checkout`)**:
   - Multi-phase transaction with PostgreSQL row locking (`SELECT FOR UPDATE` on user cart and `SELECT FOR UPDATE` on inventory rows sorted by product UUID to avoid deadlocks).
   - Server-side active product validation and real stock availability verification.
   - Atomic stock deduction and product version increment.
   - Immediate cart clearing and atomic transactional outbox event emission (`order.placed`).
5. **Idempotency & Double-Click Safety**:
   - Unique `idempotencyKey` generated via `crypto.randomUUID()` per logical checkout attempt.
   - Double-click prevention: disables submit button while request is in flight.
   - Safe retry: retains the identical idempotency key on network interruptions, allowing transparent safe re-submission.
   - Backend recognizes replay and returns HTTP 200 without creating a duplicate order or deducting additional stock.
6. **Order Confirmation & Order Details (`/orders/:id`)**:
   - Protected view mounted at `/orders/:id`.
   - Displays confirmed order status, date, fulfillment hub, itemized product snapshot with unit prices, and grand total.
7. **Customer Order History (`/orders`)**:
   - Protected view mounted at `/orders`.
   - Lists past orders sorted newest first with status badges and link to drill down into order receipts.
8. **Customer Data Isolation**:
   - Customer A cannot see or mutate Customer B's cart.
   - Customer B cannot view Customer A's orders by ID (`GET /api/orders/:id` returns 404).
   - Logging out immediately purges cart state and resets navbar badge to 0.

---

## Key Features Implemented in Sprint 9E
1. **End-to-End Real Browser Automation (Playwright)**:
   - Configured Playwright with Google Chrome channel (`channel: 'chrome'`) testing real user journeys.
   - 11 browser test scenarios across 8 spec files in `frontend/e2e/`:
     - `01-homepage.spec.ts`: Branding, hero, category cards, search input, city selector, footer.
     - `02-catalog.spec.ts`: Keyword search, typo-tolerant OpenSearch (`headfones`), category pills, city switcher.
     - `03-auth.spec.ts`: Form validation, registration, session persistence, user badge, logout, login.
     - `04-cart.spec.ts`: Add to cart, navbar badge increment, quantity stepper, clear cart modal, empty state.
     - `05-checkout.spec.ts`: Atomic checkout on isolated fixture, double-click protection, order receipt, cart clearing.
     - `06-orders.spec.ts`: Order history listing, sorting newest first, order receipt drill-down.
     - `07-responsive.spec.ts`: Verified zero horizontal scroll on Mobile (375x812), Tablet (768x1024), Laptop (1366x768), and Desktop (1920x1080).
     - `08-accessibility.spec.ts`: Semantic headings, accessible input IDs and labels, button accessible names, modal escape key dismissal.
2. **Safe Test Data Isolation**:
   - Strict test fixture isolation pattern in `frontend/e2e/test-helpers.ts`: all destructive tests create temporary products and users (`E2E_%`, `qa9e_%`) and clean them up from PostgreSQL and OpenSearch without touching the original 36 catalog products or their 180 city inventory rows.
3. **Checkout Idempotency & Retry Safety**:
   - Persistent user-scoped checkout attempt storage (`hivemart_pending_checkout_${userId}`) tracking `idempotencyKey`, `city`, and deterministic `cartFingerprint`.
   - Reuses key for uncertain network retries; invalidates key and generates fresh UUID v4 if cart or city changes.
   - Safely removes retry metadata on confirmed order completion.
4. **Payment & Shipping Claim Integrity**:
   - Audited PostgreSQL `orders` schema: confirmed no fabricated `payment_method`, `payment_status`, or `shipping_charge` columns exist.
   - Removed all unsupported claims ("FREE Delivery", "Estimated GST", "Pay on Delivery") across `CheckoutPage.tsx`, `CartPage.tsx`, and `OrderDetailPage.tsx`.
5. **Mobile Viewport & Overflow Optimization**:
   - Resolved mobile header crowding on 375px screens: moved desktop profile buttons into mobile drawer on `< sm`, ensuring zero horizontal overflow on iPhones.
   - Added `overflow-x-hidden max-w-full` to root layout.
6. **Live Hackathon Demonstration Checklist**:
   - Complete 18-step demo script in `DEMO_CHECKLIST.md` covering search, typo tolerance, dynamic city inventory, registration, cart, atomic checkout, order receipt, and Kafka/OpenSearch event synchronization.

---

## Key Features Implemented in Sprint 9F
1. **Three-Role Role-Based Access Control (RBAC)**:
   - Native roles in PostgreSQL: `customer`, `retailer`, `admin`.
   - Public self-registration (`/register`) is strictly locked to `role = 'customer'`. Admin role injection attempts return 201 with role downgraded to customer.
   - Retailer accounts can only be provisioned by an authenticated Administrator (`POST /api/admin/retailers`).
2. **Retailer Store Portal (`/retailer/dashboard`)**:
   - Access restricted to authenticated users with `role = 'retailer'` and `approval_status = 'APPROVED'`.
   - Delivers real-time regional warehouse inventory scoped exclusively to the retailer's assigned city hub (e.g. Bengaluru).
   - Dynamic metrics: Catalog Products, Total Warehouse Units, Low Stock Alert, Zero Stock Alert.
   - In-store POS Terminal Launch banner for rapid counter checkout access.
   - Profile status guards: automatically blocks access with HTTP 403 if retailer status is `PENDING` or `SUSPENDED`.
3. **Administrator Governance Dashboard (`/admin/dashboard`)**:
   - Access restricted strictly to `role = 'admin'`.
   - Comprehensive platform overview: Total Registered Customers, Active Retailer Partners, Active Catalog Products (36), and 5-City Warehouse Total Stock Breakdown.
   - Retailer Management Hub: Provision new retailers with assigned regional hubs, dynamically update approval status (`APPROVED` / `SUSPENDED`), reassign city warehouses, and toggle account activation.
   - Centralized Recent Orders Feed across all five metropolitan hubs.
4. **Verification Suites**:
   - `npm.cmd run test:sprint9f` (73 tests passed, 0 failed)
   - `npx.cmd playwright test e2e/09-rbac.spec.ts` (3 tests passed, 0 failed)

---

## Key Features Implemented in Sprint 9G
1. **Offline Retail POS Billing Terminal (`/retailer/pos`)**:
   - In-store counter billing workflow designed for retail partners in their assigned warehouse city.
   - Interactive product selection catalog with real-time city stock badges, category filters, and search.
   - Multi-item draft bill cart with quantity adjustment, removal, subtotal, and grand total calculations.
   - Payment method recording: truth-based counter collection (`CASH`, `CARD`, `UPI`, `STORE_TERMINAL`) without claiming third-party payment gateways.
   - Optional customer/counter reference notes.
2. **Centralized City Warehouse Stock Deduction & Concurrency**:
   - Draft creation does NOT deduct warehouse stock.
   - Draft cancellation releases draft without touching inventory.
   - Mandatory bill finalization atomically deducts inventory using PostgreSQL row locking (`SELECT ... FOR UPDATE` ordered by `product_id ASC`) directly on the city warehouse row.
   - Online/offline concurrency protection: simultaneous online checkout and offline POS counter billing competing for the final stock unit serialize cleanly — exactly one transaction succeeds, and the other is safely rejected with HTTP 409 Conflict. Warehouse inventory never drops below 0.
3. **Deterministic Sequential Bill Numbering**:
   - Atomic sequence `offline_bill_seq` generates structured bill numbers: `HVM-{CITY_3_LETTER}-{YYYYMMDD}-{SEQ_6_DIGITS}` (e.g., `HVM-BLR-20261122-001024`).
4. **Idempotency & Duplicate Prevention**:
   - Client sends unique `idempotencyKey` per logical finalization attempt.
   - Replaying with the same key returns HTTP 200 with cached bill data without re-deducting stock (`is_idempotent_replay: true`).
   - Finalizing an already finalized bill with a different key is rejected with HTTP 400 Bad Request.
5. **Printable Bill Receipt & Bill History**:
   - Finalized receipt view (`/retailer/bills/:id`) with printable layout (`window.print()`), cashier details, line items, and payment breakdown.
   - Store Bills History (`/retailer/bills`) with status filtering (`ALL`, `FINALIZED`, `DRAFT`, `CANCELLED`) and pagination.
   - Administrator audit drill-down at `/admin/bills/:id`.
6. **Transactional Outbox, Kafka & OpenSearch Synchronization**:
   - Bill finalization atomically inserts `offline.sale.completed` event into `outbox_events` within the same PostgreSQL transaction.
   - Outbox publisher service safely claims and publishes `offline.sale.completed` to Kafka topic `hivemart.orders`.
   - Consumer worker processes `offline.sale.completed` with duplicate prevention and updates OpenSearch document stock quantities.
7. **Admin Offline Oversight & Inventory Movements Audit Trail**:
   - Integrated Offline Retail Overview in `/admin/dashboard` reporting Total Offline Bills, Finalized Bills, Total In-Store Revenue, and Offline Sales by City.
   - Centralized Inventory Movements table logging `OFFLINE_SALE`, `ONLINE_ORDER`, and initial stock adjustments with delta, source references, and timestamps.
8. **Verification Suites**:
   - `npm.cmd run test:sprint9g` (63 assertions passed, 0 failed)
   - `npx.cmd playwright test e2e/10-pos.spec.ts` (2 tests passed, 0 failed)

---

## Key Features Implemented in Sprint 9H
1. **Smart Warehouse Inventory Alert Engine**:
   - Automated threshold evaluation: `HEALTHY` -> `REORDER_SOON` (INFO, <= 20 default) -> `LOW_STOCK` (WARNING, <= 10 default) -> `CRITICAL_STOCK` (CRITICAL, <= 5 default) -> `OUT_OF_STOCK` (URGENT, 0 units).
   - Dynamic restock resolution: restocked warehouses transition active alerts to `RESOLVED` with resolution timestamps.
   - Partial unique index `uq_active_alert_prod_city_type` prevents duplicate active alerts across all 5 warehouse cities.
   - Integrated hooks in Online Checkout (`checkout.service.js`), POS Finalization (`pos.service.js`), and Kafka Consumer (`inventory-search-sync.service.js`).
2. **Monthly Bestseller Analytics & Replenishment Warnings**:
   - Strict `Asia/Kolkata` calendar month boundary aggregation.
   - Combines online customer orders (`orders` + `order_items`) and offline counter bills (`offline_bills` + `offline_bill_items`).
   - Computes daily sales velocity (`units/day`) and estimated days of stock remaining (`currentStock / salesVelocity`).
   - Automatically generates `BESTSELLER_REPLENISHMENT` demand warnings when stock coverage drops below 7 days.
   - PostgreSQL advisory lock (`987654321`) protects scheduled background analytics runs from concurrent execution collisions.
3. **Retailer Notification Center (`/retailer/notifications`) & Navbar Bell**:
   - Live unread notification counter badge in Navbar.
   - Retailer Notification Center with severity-colored badges, category/unread filtering, mark single/all as read, and inline alert acknowledgment.
   - Retailer Dashboard embeds active Regional Stock Alerts cards and Monthly Bestseller Velocity table with run-out warning indicators.
4. **Administrator Multi-City Governance & Threshold Customization**:
   - Cross-City Bestseller Leaderboard and Multi-City Stock Alerts matrix across Bengaluru, Hyderabad, Chennai, Mumbai, and Delhi.
   - Global and city-specific stock threshold configuration table (`GET/PUT /api/admin/inventory/thresholds`).
   - Strict hierarchy validation: `out_of_stock (0) < critical <= minimum <= early_warning` enforced client- and server-side.
5. **Verification Suites**:
   - `npm.cmd run test:sprint9h` (48 frontend assertions passed, 0 failed)
   - `cd ../backend; npm.cmd run test:sprint9h` (56 backend assertions passed, 0 failed)
   - `npx.cmd playwright test e2e/11-stock-alerts.spec.ts` (2 tests passed, 0 failed)

---

## Key Features Implemented in Sprint 9I
1. **Personalized Customer Monthly Essentials (`/monthly-essentials`)**:
   - Customer dashboard for creating and managing recurring monthly grocery and household essentials baskets.
   - Shopping day picker (1-31) and configurable reminder window (1-14 days before, default 3).
   - Dynamic month-end date clamping: automatically clamps days 29-31 in shorter months (e.g. Feb 28/29, Nov 30) using strict `Asia/Kolkata` calendar calculations.
   - Interactive item management: add products with instant live catalog prices, city warehouse stock indicators, quantity adjustment steppers, and item deletion.
   - Pause / Resume toggle for temporary suspension of recurring reminders.
2. **Monthly Reminder Engine & Background Worker**:
   - Automated evaluation of active customer lists and next shopping dates.
   - Generates in-app notifications in `notifications` table and cycle records in `monthly_reminders`.
   - Guaranteed deduplication via PostgreSQL unique constraint `uq_monthly_reminders_list_due`.
   - Concurrency protection via PostgreSQL advisory lock (`987654322`).
   - Run worker daemon via `npm run reminders:worker` or on-demand via `npm run reminders:run`.
3. **One-Click "Add All to Cart" Integration**:
   - Validates live city warehouse inventory across the delivery hub.
   - Applies authoritative catalog prices (zero stale saved prices).
   - Merges items into existing customer cart without overwriting pre-existing items.
   - Intelligently caps quantities if requested amount exceeds remaining city warehouse stock.
   - Returns structured breakdown of added, adjusted (stock-limited), and unavailable (out of stock) items.
4. **Security, IDOR Protection & RBAC**:
   - Strict customer ownership enforcement on all list, item, reminder, and cart replenishment endpoints.
   - Cross-customer access attempts strictly blocked with HTTP 403 Forbidden.
   - Retailer and Admin roles prohibited from accessing customer monthly essentials endpoints with HTTP 403.
5. **Verification Suites**:
   - `npm.cmd run test:sprint9i` (33 frontend integration assertions passed, 0 failed)
   - `cd ../backend; npm.cmd run test:sprint9i` (55 backend assertions passed, 0 failed)
   - `npx.cmd playwright test e2e/12-monthly-essentials.spec.ts` (2 tests passed, 0 failed)

---

## Complete Verification Test Matrix

| Test Suite | Command | Assertions | Status |
| :--- | :--- | :---: | :---: |
| **Sprint 9A: Setup & Catalog** | `npm.cmd run test:sprint9a` | 33 | **33 Passed, 0 Failed** |
| **Sprint 9B: OpenSearch & Filters** | `npm.cmd run test:sprint9b` | 80 | **80 Passed, 0 Failed** |
| **Sprint 9C: Customer Auth & JWT** | `npm.cmd run test:sprint9c` | 94 | **94 Passed, 0 Failed** |
| **Sprint 9D: Persistent Cart & Checkout**| `npm.cmd run test:sprint9d` | 86 | **86 Passed, 0 Failed** |
| **Sprint 9E: QA, Audit & Pipeline** | `npm.cmd run test:sprint9e` | 56 | **56 Passed, 0 Failed** |
| **Sprint 9F: RBAC & Multi-Role Dashboards**| `npm.cmd run test:sprint9f` | 73 | **73 Passed, 0 Failed** |
| **Sprint 9G: Offline POS & Concurrency** | `npm.cmd run test:sprint9g` | 63 | **63 Passed, 0 Failed** |
| **Sprint 9H: Smart Alerts & Analytics** | `npm.cmd run test:sprint9h` | 48 | **48 Passed, 0 Failed** |
| **Sprint 9I: Monthly Essentials & Reminders** | `npm.cmd run test:sprint9i` | 33 | **33 Passed, 0 Failed** |
| **Backend Sprint 9I Test Suite** | `cd ../backend; npm.cmd run test:sprint9i` | 55 | **55 Passed, 0 Failed** |
| **Backend Sprint 9H Test Suite** | `cd ../backend; npm.cmd run test:sprint9h` | 56 | **56 Passed, 0 Failed** |
| **Backend Integration (Sprint 8)** | `cd ../backend; npm.cmd run test:sprint8` | 60 | **60 Passed, 0 Failed** |
| **Playwright All E2E Suites (01-12)** | `npx.cmd playwright test` | 21 specs | **21 Passed, 0 Failed** |
| **Production Build** | `npm.cmd run build` | — | **Compiled cleanly (0 errors)** |
| **Total Verified Assertions** | | **740+** | **740+ Passed, 0 Failed (100%)** |






