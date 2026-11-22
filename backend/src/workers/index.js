export { publishOutboxBatch } from '../services/outbox.service.js';
export { runOnce, runContinuous } from './outbox-publisher.js';
export { startConsumer, stopConsumer, CONSUMER_GROUP } from './order-consumer.js';
export { syncProductsToOpenSearch, handleOrderPlacedEvent } from '../services/inventory-search-sync.service.js';
