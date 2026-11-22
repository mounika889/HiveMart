# HiveMart — Live Hackathon Demonstration Checklist

This document provides a verified, step-by-step demonstration walkthrough for presenting the **HiveMart** multi-city retail e-commerce platform during hackathon evaluations.

---

## 1. Pre-Demo Environment Verification

Before presenting, ensure all core services and background workers are active:

```powershell
# Terminal 1 — Backend API (Port 5000)
Set-Location C:\Users\ADMIN\Desktop\Hivemart\backend
npm.cmd run dev

# Terminal 2 — Frontend Application (Port 3000)
Set-Location C:\Users\ADMIN\Desktop\Hivemart\frontend
npm.cmd run dev

# Terminal 3 — Transactional Outbox Publisher
Set-Location C:\Users\ADMIN\Desktop\Hivemart\backend
npm.cmd run outbox:worker

# Terminal 4 — Kafka Search Sync Consumer
Set-Location C:\Users\ADMIN\Desktop\Hivemart\backend
npm.cmd run kafka:consume
```

**Health Check Quick Command**:
```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
Invoke-RestMethod http://127.0.0.1:5000/api/health/kafka
Invoke-RestMethod http://127.0.0.1:5000/api/health/search
Invoke-RestMethod http://127.0.0.1:5000/api/health/db
```

---

## 2. Live Demo Script (18-Step Walkthrough)

### Step 1: Open Homepage
- Navigate to `http://127.0.0.1:3000`.
- Highlight HiveMart brand identity, hero title (*"Everything You Love, All in One Hive."*), trust metrics (36+ products, 5 cities, 100% atomic checkout), and live category tiles.

### Step 2: Select Delivery City
- In the top navigation bar, open the city selector.
- Select **Bengaluru**.
- Notice how warehouse badges and catalog availability immediately lock into the Bengaluru hub context.

### Step 3: Search for a Product
- In the top search bar, type `headphones` and press enter.
- Observe instant OpenSearch results returning boAt Rockerz 450.

### Step 4: Demonstrate Typo-Tolerant Search
- Type `headfones` or `shampo` into the search bar.
- Highlight **Aiven OpenSearch fuzzy matching (fuzziness: AUTO)** resolving `headfones` to boAt Rockerz headphones seamlessly without 0-result dead ends.

### Step 5: Filter by Category
- Click **Electronics** under the category pill filters.
- Observe strict category filtering with real-time product count (6 products).

### Step 6: Open Product Details
- Click on **boAt Rockerz 450 Bluetooth On-Ear Headphones with Mic**.
- The page routes to `/products/:id`.

### Step 7: Show City Inventory Availability
- Highlight the warehouse stock indicator: shows live units available in Bengaluru.

### Step 8: Dynamically Switch City to Hyderabad
- Use the navbar city selector to change from **Bengaluru** to **Hyderabad**.
- Observe the product stock indicator update in real time from Bengaluru quantity to Hyderabad quantity without a full page reload.

### Step 9: Register or Log In with Demo Account
- Click **Sign In** in the top navigation.
- If registering a new user:
  - Name: `Demo Customer`
  - Email: `demo_eval@hivemart.test`
  - Password: `Password123!`
- Confirm customer initials badge appears in the top navigation bar.

### Step 10: Add Products to Cart
- Select quantity (e.g. `1`) on the product detail page.
- Click **Add to Cart**.
- Observe:
  - Interactive button animation (*"Added to Cart!"*).
  - Amber cart badge in navbar increments immediately.

### Step 11: Review Cart Page
- Navigate to `/cart`.
- Review itemized table, price per unit, delivery city hub projection, and total amount.
- Test the quantity stepper (`+` and `-`) showing optimistic UI updates backed by PostgreSQL `cart_items`.

### Step 12: Proceed to Checkout
- Click **Proceed to Checkout**.
- Page routes to protected `/checkout` route.

### Step 13: Highlight Checkout Reliability & Idempotency
- Show the **Request Key** (UUID v4) displayed in the summary card.
- Explain the **Idempotency Lifecycle**:
  - The client generates one stable key per logical order.
  - If network disconnects or times out, the user retries with the *exact same key*.
  - The backend PostgreSQL checkout recheck catches existing orders and returns `HTTP 200` with the confirmed order instead of duplicating orders or re-deducting stock.

### Step 14: Place Order (Pay on Delivery)
- Click **Place Order**.
- Observe the button disables to prevent double-clicks while the backend executes a single atomic transaction:
  - Locks user cart with `SELECT FOR UPDATE`.
  - Locks inventory rows in deterministic order with `SELECT FOR UPDATE`.
  - Verifies city warehouse stock.
  - Inserts `orders` and `order_items`.
  - Deducts stock.
  - Emits `order.placed` to `outbox_events`.
  - Clears purchased items from `cart_items`.
  - Commits transaction.

### Step 15: Order Confirmation Receipt
- Application redirects to `/orders/:id`.
- Review the confirmed receipt:
  - Genuine status badge: `CONFIRMED`.
  - Warehouse hub location: e.g. `Bengaluru Hub`.
  - Itemized table with product details and verified total amount in INR.
  - Transactional outbox confirmation.

### Step 16: View Order History
- Click **View All Orders** or navigate to `/orders`.
- Show that past orders are persisted in PostgreSQL, sorted newest first, and strictly isolated per customer.

### Step 17: Observe Kafka & OpenSearch Event Sync
- In Terminal 3 (Outbox Worker), observe `Published event -> hivemart.orders`.
- In Terminal 4 (Kafka Consumer), observe `[SEARCH_SYNC] Successfully synced product(s) to OpenSearch`.
- Refresh search results to show that OpenSearch inventory reflects the new stock decrement without manual intervention.

### Step 18: Explain Concurrency & Overselling Safeguards
- Conclude by explaining how HiveMart guarantees zero overselling:
  - PostgreSQL is the single source of truth for stock and orders.
  - Simultaneous checkouts on the final available unit are handled deterministically via PostgreSQL row-level locks.
  - OpenSearch is eventually consistent via Aiven Kafka event streaming.

---

## 3. Demo Troubleshooting & Quick Fixes

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Search returns 0 results** | OpenSearch index alias not found | Run `npm.cmd run search:setup` in `backend` |
| **Cart badge doesn't increment** | User unauthenticated | Log in or register via `/login` |
| **Checkout shows "Insufficient stock"** | Product out of stock in chosen city | Switch to a city with stock or pick another product |
| **Kafka consumer idle** | Outbox worker not started | Run `npm.cmd run outbox:worker` in `backend` |

