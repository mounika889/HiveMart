import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateCycleReminders } from '../services/monthly-essentials.service.js';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isOnce = process.argv.includes('--once');
const INTERVAL_MS = parseInt(process.env.REMINDERS_INTERVAL_MS || '3600000', 10); // default 1 hour

async function main() {
  console.log(`[REMINDERS_WORKER] Starting Monthly Essentials Reminder Engine (Mode: ${isOnce ? 'ONCE' : 'DAEMON'})...`);

  const runJob = async () => {
    try {
      const res = await generateCycleReminders();
      console.log(`[REMINDERS_WORKER] Run complete at ${new Date().toISOString()}:`, res);
    } catch (err) {
      console.error(`[REMINDERS_WORKER] Error executing reminder job:`, err.message);
    }
  };

  await runJob();

  if (isOnce) {
    await pool.end();
    process.exit(0);
  }

  const timer = setInterval(runJob, INTERVAL_MS);

  const shutdown = async (signal) => {
    console.log(`\n[REMINDERS_WORKER] Received ${signal}. Shutting down worker...`);
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[REMINDERS_WORKER] Fatal startup error:', err);
  process.exit(1);
});

