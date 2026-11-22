import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function bootstrapAdmin() {
  console.log('=== HIVEMART ADMINISTRATOR BOOTSTRAP ===');

  const { default: pool } = await import('../config/database.js');

  const name = (process.env.ADMIN_NAME || process.argv[4] || 'HiveMart Administrator').trim();
  const email = (process.env.ADMIN_EMAIL || process.argv[2] || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.argv[3] || '';

  if (!email || !EMAIL_REGEX.test(email)) {
    console.error('Error: A valid ADMIN_EMAIL environment variable is required.');
    console.error('Usage: ADMIN_EMAIL=admin@hivemart.local ADMIN_PASSWORD=SecretPassword123 npm run admin:bootstrap');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('Error: ADMIN_PASSWORD must be at least 6 characters long.');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const existingUserRes = await pool.query(
      'SELECT id, email, role, is_active FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    let resultUser;
    if (existingUserRes.rows.length > 0) {
      const updateRes = await pool.query(
        `UPDATE users
         SET name = $1, password_hash = $2, role = 'admin', is_active = true
         WHERE LOWER(email) = LOWER($3)
         RETURNING id, name, email, role, is_active, created_at`,
        [name, passwordHash, email]
      );
      resultUser = updateRes.rows[0];
      console.log(`Successfully updated existing user to Administrator: ${resultUser.email} (id: ${resultUser.id})`);
    } else {
      const insertRes = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'admin', true)
         RETURNING id, name, email, role, is_active, created_at`,
        [name, email, passwordHash]
      );
      resultUser = insertRes.rows[0];
      console.log(`Successfully created new Administrator: ${resultUser.email} (id: ${resultUser.id})`);
    }

    console.log(`Admin status: active = ${resultUser.is_active}, role = ${resultUser.role}`);
    console.log('Bootstrap completed successfully.');
  } catch (err) {
    console.error('Admin bootstrap failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

bootstrapAdmin();
