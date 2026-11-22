# HiveMart Backend

Event-driven e-commerce platform backend designed for the Hack With Bengaluru hackathon.

## Tech Stack
- **Runtime & Framework**: Node.js, Express.js (JavaScript ES Modules)
- **Database**: Aiven PostgreSQL (via `pg` Connection Pool with strict TLS verification)
- **Search Engine**: Aiven OpenSearch 3.6 (via `@opensearch-project/opensearch` with strict HTTPS TLS verification)
- **Message Broker**: Aiven Apache Kafka 4.3 (via `kafkajs` with SASL PLAIN & strict TLS verification)
- **Authentication**: JWT (`jsonwebtoken`) with `bcrypt` password hashing
- **Middleware & Security**: Helmet, CORS, Morgan, Dotenv, Bearer Token Auth
- **Event-Driven Architecture**: Transactional Outbox Pattern (`outbox_events` table) with Apache Kafka (`kafkajs`)
- **Upcoming Integrations (Future Sprints)**:
  - Asynchronous event consumers for inventory and search indexing

---

## Directory Architecture

```
backend/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration (ignored by git)
├── .gitignore                # Git ignore rules
├── package.json              # Project metadata, dependencies, scripts
├── README.md                 # Setup and documentation
├── certs/
│   └── ca.pem                # Aiven Project CA certificate for PostgreSQL TLS verification
├── migrations/
│   ├── 001_initial_schema.sql# Versioned SQL migration for the 9 core tables
│   ├── 002_add_carts_unique_user.sql # Enforce 1:1 persistent cart per user
│   └── 003_add_product_version.sql # Monotonic product version for OpenSearch concurrency safe sync
└── src/
    ├── app.js                # Express application configuration and middleware pipeline
    ├── server.js             # HTTP server lifecycle and graceful shutdown
    ├── config/               # Environment configuration and service settings
    │   ├── database.js       # PostgreSQL connection pool with strict TLS verification
    │   ├── index.js          # App & JWT configuration with fallback warning
    │   ├── kafka.js          # Aiven KafkaJS client and reusable health checker
    │   └── opensearch.js     # OpenSearch client with strict HTTPS verification
    ├── controllers/          # Route controller handlers
    │   ├── auth.controller.js
    │   ├── cart.controller.js
    │   ├── category.controller.js
    │   ├── checkout.controller.js
    │   ├── health.controller.js
    │   ├── inventory.controller.js
    │   ├── order.controller.js
    │   ├── product.controller.js
    │   └── search.controller.js
    ├── middleware/           # Custom Express middlewares
    │   ├── auth.js           # JWT Bearer token authentication & user context
    │   ├── errorHandler.js
    │   └── notFoundHandler.js
    ├── routes/               # API route definitions
    │   ├── auth.routes.js
    │   ├── cart.routes.js
    │   ├── category.routes.js
    │   ├── checkout.routes.js
    │   ├── health.routes.js
    │   ├── inventory.routes.js
    │   ├── order.routes.js
    │   ├── product.routes.js
    │   ├── search.routes.js
    │   └── index.js
    ├── scripts/              # Automation and maintenance scripts
    │   ├── cleanup-temp.js   # Safe cleanup of temporary test data
    │   ├── index-products.js # PostgreSQL-to-OpenSearch bulk indexer
    │   ├── migrate.js        # Transactional migration runner
    │   ├── seed-products.js  # Product catalog and city inventory seed script
    │   ├── setup-kafka-topics.js # Repeatable Kafka topic setup & partition verifier
    │   ├── setup-search-index.js # OpenSearch index & mapping initialization
    │   ├── test-sprint3.js   # Product & inventory test suite (37 tests)
    │   ├── test-sprint4.js   # Auth & persistent cart integration test suite (55 tests)
    │   ├── test-sprint5a.js  # OpenSearch connection & health test suite (13 tests)
    │   ├── test-sprint5b.js  # OpenSearch search & filter test suite (44 tests)
    │   ├── test-sprint6.js   # Checkout, outbox, & concurrency test suite (41 tests)
    │   ├── test-sprint7a.js  # Kafka connection & health test suite (35 tests)
    │   ├── test-sprint7b.js  # Kafka topic & outbox publisher test suite (27 tests)
    │   ├── test-sprint7c.js  # Kafka consumer & OpenSearch inventory sync test suite
    │   └── verify-schema.js  # Schema catalog verifier
    ├── services/             # Core business logic & database interactions
    │   ├── auth.service.js
    │   ├── cart.service.js
    │   ├── checkout.service.js
    │   ├── inventory.service.js
    │   ├── inventory-search-sync.service.js # Authoritative PostgreSQL -> OpenSearch inventory sync
    │   ├── order.service.js
    │   ├── outbox.service.js # Transactional outbox publisher & batch claimer
    │   ├── product.service.js
    │   └── search.service.js
    ├── utils/                # Utility functions and shared helpers
    │   └── validation.js     # UUID, price, inStock, and pagination validators
    └── workers/              # Asynchronous event workers & Kafka consumers
        ├── index.js
        ├── order-consumer.js   # Kafka consumer syncing order.placed to OpenSearch
        └── outbox-publisher.js # Outbox publisher CLI & continuous worker daemon
```

---

## Transactional Checkout & Outbox Pattern

### Guarantees
1. **Single Client & Transaction**: Entire checkout executes inside a single `BEGIN ... COMMIT` block using one PostgreSQL client from the pool. Any error triggers an immediate `ROLLBACK`.
2. **Deadlock Prevention**: Inventory rows are locked using `SELECT ... FOR UPDATE` ordered deterministically by `product_id ASC`.
3. **Cart & Idempotency Locking**: User cart is locked with `SELECT FOR UPDATE` and the idempotency key is re-verified to prevent duplicate order generation.
4. **Transactional Outbox**: The `order.placed` event is inserted into `outbox_events` within the same transaction that inserts the order and deducts inventory stock.
5. **Zero Negative Stock**: Concurrency tested under heavy simultaneous customer race conditions for a single available unit.

### Outbox Publisher Architecture & Tradeoffs
1. **Concurrent Worker Safety**: Events are claimed in bounded batches using `SELECT ... FOR UPDATE SKIP LOCKED`. Multiple worker processes claim non-overlapping sets of outbox events without blocking or deadlocking.
2. **Acknowledgment-Based Publishing**: Rows are updated with `published_at = NOW()` strictly after Kafka broker send acknowledgment. On failure, `published_at` remains `NULL` and `retry_count` is incremented.
3. **Bounded Lock Timeouts**: External network calls to Kafka are wrapped with strict timeouts (e.g. 5000ms) to ensure database locks are not held indefinitely during Kafka outages.
4. **At-Least-Once Delivery**: Because Kafka send and PostgreSQL commit are two separate systems, network drops between Kafka acknowledgment and database commit can leave an event marked unpublished. Consumers must deduplicate incoming events by `event_id` (e.g. via the `processed_events` table). Exactly-once Kafka delivery is never promised.
5. **Standalone Operation**: The publisher worker runs independently from the HTTP server via `npm run kafka:publish-once` or `npm run outbox:worker`, and is never automatically launched on server startup.

### Kafka Consumer & OpenSearch Search Synchronization
1. **Event Reception**: Consumer group `hivemart-search-sync-v1` subscribes to `hivemart.orders` and listens for `order.placed` events.
2. **Authoritative Stock Synchronization**:
   - The consumer **never** deducts stock or subtracts event quantities.
   - It always queries authoritative current inventory from PostgreSQL across all five cities (`Bengaluru`, `Hyderabad`, `Chennai`, `Mumbai`, `Delhi`).
   - Syncs the refreshed stock to OpenSearch document matching the product UUID (`hivemart_products`).
3. **Deduplication (`processed_events`)**:
   - Before processing, checks `(event_id, consumer_name)`. Duplicate event replays are acknowledged without repeating OpenSearch sync or duplicating effects.
   - Upon successful OpenSearch sync, inserts `(event_id, consumer_name)` into `processed_events`.
4. **Stale Update Protection**:
   - Before updating OpenSearch, compares document `updated_at` timestamps.
   - If an out-of-order or delayed event arrives with an older timestamp than what OpenSearch already contains, the update is safely ignored (`STALE_GUARD`), preventing stale overwrites.
5. **Offset Management & Error Recovery**:
   - `autoCommit` is disabled. Offsets are committed manually only after successful sync.
   - Transient failures trigger up to 3 retries with bounded exponential backoff.
   - If retries fail, offset is left uncommitted, allowing clean replay on consumer restart.

---

## Running the Backend Services

To run the full event-driven backend ecosystem:

```powershell
# 1. Start the Express API Server (Port 5000)
cd backend
npm.cmd run dev

# 2. Start the Transactional Outbox Publisher Daemon
cd backend
npm.cmd run outbox:worker
# (Or publish a single batch manually: npm.cmd run kafka:publish-once)

# 3. Start the Kafka OpenSearch Sync Consumer Daemon
cd backend
npm.cmd run kafka:consume
```

---

## API Endpoints

### 1. Health Endpoints (`/api/health`)
- **GET `/api/health`**: Base API service status.
- **GET `/api/health/db`**: Live PostgreSQL connection test via `SELECT NOW()`.
- **GET `/api/health/search`**: Live OpenSearch cluster ping and metadata check.
- **GET `/api/health/kafka`**: Live Aiven Kafka 4.3 cluster connectivity check via reusable KafkaJS Admin client (`describeCluster`).

### 2. Full-Text Search Endpoint (`/api/search`)
- **GET `/api/search`**: Powered by OpenSearch 3.6 with full-text fuzzy matching, exact/phrase score boosting, nested inventory filtering, and pagination:
  - `q`, `category`, `city`, `inStock`, `minPrice`, `maxPrice`, `sort`, `page`, `limit`.

### 3. Authentication Endpoints (`/api/auth`)
- **POST `/api/auth/register`**: Customer registration with bcrypt hashing.
- **POST `/api/auth/login`**: Customer login with JWT token issuance.
- **GET `/api/auth/me`**: Protected profile endpoint.

### 4. Persistent Cart Endpoints (`/api/cart`)
*All cart endpoints require `Authorization: Bearer <token>`.*
- **GET `/api/cart`**: User's persistent cart with server-side totals.
- **POST `/api/cart/items`**: Add item (rejects duplicates).
- **PATCH `/api/cart/items/:productId`**: Update quantity.
- **DELETE `/api/cart/items/:productId`**: Remove item.
- **DELETE `/api/cart`**: Clear cart.

### 5. Checkout & Orders Endpoints
*Requires `Authorization: Bearer <token>`.*
- **POST `/api/checkout`**:
  - Body: `{ "city": "Bengaluru", "idempotencyKey": "unique-uuid-or-key" }`
  - Atomically locks cart & inventory, validates stock, deducts inventory, creates order and order items, inserts `order.placed` into `outbox_events`, and clears cart.
  - Idempotent: re-submitting with the same key returns the existing order (`HTTP 200`) without re-deducting stock.
- **GET `/api/orders`**:
  - Returns authenticated user's order history with item counts.
- **GET `/api/orders/:id`**:
  - Returns order details and line items with strict cross-user isolation.

### 6. Product Catalog & Inventory Endpoints
- **GET `/api/categories`**: Distinct categories with counts.
- **GET `/api/products`**: Filtered & paginated catalog (PostgreSQL).
- **GET `/api/products/:id`**: Product details with city inventory.
- **GET `/api/inventory/:productId`**: Stock per city.

---

## Independent Runtime Services

In production / live operation, HiveMart runs 3 decoupled services:

1. **API Web Server**:
   ```bash
   npm run dev      # Development with nodemon
   npm start        # Production Node.js server
   ```
2. **Transactional Outbox Publisher Worker**:
   ```bash
   npm run outbox:worker           # Continuously polls and publishes unpublished events
   npm run kafka:publish-once      # Single-batch publication cycle
   ```
3. **Kafka Search Sync Consumer Worker**:
   ```bash
   npm run kafka:consume           # Consumes order.placed events from Aiven Kafka & updates OpenSearch
   ```

---

## Automated Verification Suites

The backend includes comprehensive test suites covering all architectural layers from unit validation to multi-system integration:

```powershell
cd backend
$job = Start-Process -FilePath "node" -ArgumentList "src/server.js" -PassThru
Start-Sleep -Seconds 3
try {
    # Sprint 3: Catalog & Inventory (37 tests)
    node src/scripts/test-sprint3.js
    
    # Sprint 4: Auth & Persistent Cart (55 tests)
    node src/scripts/test-sprint4.js
    
    # Sprint 5A: OpenSearch Health (13 tests)
    node src/scripts/test-sprint5a.js
    
    # Sprint 5B: OpenSearch Search & Filters (44 tests)
    node src/scripts/test-sprint5b.js
    
    # Sprint 6: Transactional Checkout, Outbox & Concurrency (41 tests)
    node src/scripts/test-sprint6.js

    # Sprint 7A: Live Aiven Kafka 4.3 Connectivity & Health (35 tests)
    node src/scripts/test-sprint7a.js

    # Sprint 7B: Kafka Topic & Outbox Publisher (27 tests)
    node src/scripts/test-sprint7b.js

    # Sprint 7C: Kafka Consumer & OpenSearch Search Sync (33 tests)
    node src/scripts/test-sprint7c.js

    # Sprint 8: Full End-to-End Integration, Concurrency & Reliability (60 tests)
    node src/scripts/test-sprint8.js
} finally {
    Stop-Process -Id $job.Id -Force
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
}
```

**Total Regression Test Suite**: 345 Passed, 0 Failed (100% Pass Rate).

