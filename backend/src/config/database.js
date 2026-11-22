import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves the Aiven CA certificate for TLS verification:
 * 1. Checks AIVEN_CA_CERT environment variable (either direct PEM string or file path).
 * 2. Checks PGSSLROOTCERT environment variable (standard PostgreSQL root CA path).
 * 3. Checks the project's certs directory (certs/ca.pem).
 * @returns {string|null} PEM certificate content or null
 */
export const resolveCaCert = () => {
  try {
    // 1. AIVEN_CA_CERT env variable
    if (process.env.AIVEN_CA_CERT) {
      if (process.env.AIVEN_CA_CERT.includes('-----BEGIN CERTIFICATE-----')) {
        return process.env.AIVEN_CA_CERT;
      }
      const resolvedPath = path.resolve(process.env.AIVEN_CA_CERT);
      if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath, 'utf-8');
      }
    }

    // 2. PGSSLROOTCERT env variable
    if (process.env.PGSSLROOTCERT && fs.existsSync(process.env.PGSSLROOTCERT)) {
      return fs.readFileSync(process.env.PGSSLROOTCERT, 'utf-8');
    }

    // 3. Project default certs/ca.pem
    const defaultCertPath = path.resolve(__dirname, '../../certs/ca.pem');
    if (fs.existsSync(defaultCertPath)) {
      return fs.readFileSync(defaultCertPath, 'utf-8');
    }
  } catch (err) {
    console.error('Error reading CA certificate:', err.message);
  }

  return null;
};

const databaseUrl = process.env.DATABASE_URL;

const buildPoolConfig = () => {
  if (!databaseUrl) {
    console.warn('DATABASE_URL is not set in environment variables.');
    return {};
  }

  const caCert = resolveCaCert();

  try {
    const parsedUrl = new URL(databaseUrl);
    return {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port || '5432', 10),
      user: decodeURIComponent(parsedUrl.username),
      password: decodeURIComponent(parsedUrl.password),
      database: parsedUrl.pathname.slice(1),
      max: 10,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: true,
        ...(caCert ? { ca: caCert } : {}),
      },
    };
  } catch (err) {
    console.error('Failed to parse DATABASE_URL:', err.message);
    return {
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: true,
        ...(caCert ? { ca: caCert } : {}),
      },
    };
  }
};

export const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

export const query = (text, params) => pool.query(text, params);

export default pool;

