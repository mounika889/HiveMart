import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { disconnectKafkaProducer } from '../config/kafka.js';
import { publishOutboxBatch } from '../services/outbox.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const POLL_INTERVAL_MS = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '2000', 10);
const BATCH_SIZE = parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10);

let isRunning = false;
let isShuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a single batch execution of outbox publishing.
 */
export const runOnce = async () => {
  console.log('[OUTBOX_WORKER] Executing single-batch outbox publication...');
  try {
    const result = await publishOutboxBatch({ batchSize: BATCH_SIZE });
    console.log(`[OUTBOX_WORKER] Batch summary: Claimed=${result.claimed}, Published=${result.published}, Failed=${result.failed}`);
    return result;
  } catch (err) {
    console.error('[OUTBOX_WORKER] Single-batch execution encountered error:', err.message);
    throw err;
  } finally {
    await disconnectKafkaProducer();
    await pool.end();
  }
};

/**
 * Runs continuous polling worker with graceful shutdown handling.
 */
export const runContinuous = async () => {
  console.log(`[OUTBOX_WORKER] Starting continuous outbox publisher worker (pollInterval=${POLL_INTERVAL_MS}ms, batchSize=${BATCH_SIZE})...`);
  isRunning = true;

  const handleShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[OUTBOX_WORKER] Received ${signal}. Shutting down gracefully...`);
    isRunning = false;
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  try {
    while (isRunning) {
      try {
        const result = await publishOutboxBatch({ batchSize: BATCH_SIZE });
        if (result.claimed > 0) {
          console.log(`[OUTBOX_WORKER] Batch completed: ${result.published} published, ${result.failed} failed.`);
          // If there were events claimed, yield briefly before next batch
          await sleep(100);
        } else {
          // If no events were waiting, sleep for configured polling interval
          await sleep(POLL_INTERVAL_MS);
        }
      } catch (loopErr) {
        console.error('[OUTBOX_WORKER] Error in polling loop, backing off before retry:', loopErr.message);
        await sleep(Math.max(POLL_INTERVAL_MS, 3000));
      }
    }
  } finally {
    console.log('[OUTBOX_WORKER] Cleaning up connections on shutdown...');
    await disconnectKafkaProducer();
    await pool.end();
    console.log('[OUTBOX_WORKER] Shutdown complete.');
  }
};

// CLI entrypoint
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const args = process.argv.slice(2);
  const isOnce = args.includes('--once') || args.includes('-1');

  if (isOnce) {
    runOnce()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    runContinuous()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

export default {
  runOnce,
  runContinuous,
};

