import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runDailyAnalyticsWorker } from '../services/bestseller.service.js';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isOnce = process.argv.includes('--once');
const INTERVAL_MS = parseInt(process.env.ANALYTICS_INTERVAL_MS || '3600000', 10); // default 1 hour

async function main() {
  console.log(`[ANALYTICS_WORKER] Starting Sales Analytics & Bestseller Replenishment Worker (Mode: ${isOnce ? 'ONCE' : 'DAEMON'})...`);

  const runJob = async () => {
    try {
      const res = await runDailyAnalyticsWorker();
      console.log(`[ANALYTICS_WORKER] Run complete at ${new Date().toISOString()}:`, res);
    } catch (err) {
      console.error(`[ANALYTICS_WORKER] Error executing analytics job:`, err.message);
    }
  };

  await runJob();

  if (isOnce) {
    await pool.end();
    process.exit(0);
  }

  const timer = setInterval(runJob, INTERVAL_MS);

  const shutdown = async (signal) => {
    console.log(`\n[ANALYTICS_WORKER] Received ${signal}. Shutting down worker...`);
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[ANALYTICS_WORKER] Fatal startup error:', err);
  process.exit(1);
});

