import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.resolve(__dirname, '../../migrations');

export const runMigrations = async () => {
  const client = await pool.connect();
  try {
    console.log('--- Starting Database Migrations ---');

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch applied migrations
    const appliedResult = await client.query('SELECT name FROM schema_migrations ORDER BY id ASC;');
    const appliedSet = new Set(appliedResult.rows.map((r) => r.name));

    // 3. Read migration files
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('No SQL migration files found.');
      return;
    }

    let newlyAppliedCount = 0;

    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`[SKIP] Already applied: ${file}`);
        continue;
      }

      console.log(`[APPLYING] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Execute within transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
        await client.query('COMMIT');
        console.log(`[SUCCESS] Applied: ${file}`);
        newlyAppliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[ERROR] Failed to apply ${file}:`, err.message);
        throw err;
      }
    }

    if (newlyAppliedCount === 0) {
      console.log('Schema is already up to date. No new migrations.');
    } else {
      console.log(`Successfully applied ${newlyAppliedCount} migration(s).`);
    }
  } catch (error) {
    console.error('Migration execution failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations();

