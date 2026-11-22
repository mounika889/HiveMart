import dotenv from 'dotenv';
import { Client } from '@opensearch-project/opensearch';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Resolves optional custom CA certificate specifically for OpenSearch if provided.
 * If not provided or if Aiven OpenSearch is issued by a public root CA (e.g. Let's Encrypt / ISRG Root X1),
 * Node.js's built-in secure CA trust store is utilized with strict verification.
 */
export const resolveOpenSearchCa = () => {
  try {
    if (process.env.OPENSEARCH_CA_CERT) {
      if (process.env.OPENSEARCH_CA_CERT.includes('-----BEGIN CERTIFICATE-----')) {
        return process.env.OPENSEARCH_CA_CERT;
      }
      const resolvedPath = path.resolve(process.env.OPENSEARCH_CA_CERT);
      if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath, 'utf-8');
      }
    }
  } catch (err) {
    console.error('Error reading OpenSearch CA certificate:', err.message);
  }
  return null;
};

const opensearchUrl = process.env.OPENSEARCH_URL;

if (!opensearchUrl) {
  console.warn('OPENSEARCH_URL is not defined in environment variables.');
}

const buildOpenSearchClient = () => {
  if (!opensearchUrl) {
    return null;
  }

  const customCa = resolveOpenSearchCa();

  return new Client({
    node: opensearchUrl,
    ssl: {
      rejectUnauthorized: true, // Strict HTTPS certificate verification
      ...(customCa ? { ca: customCa } : {}),
    },
    maxRetries: 3,
    requestTimeout: 10000,
  });
};

export const openSearchClient = buildOpenSearchClient();

export default openSearchClient;

