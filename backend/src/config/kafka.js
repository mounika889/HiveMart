import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves CA certificate for Kafka TLS verification:
 * 1. Checks KAFKA_CA_CERT (file path or inline PEM).
 * 2. Checks AIVEN_CA_CERT (file path or inline PEM).
 * 3. Falls back to default certs/ca.pem if present.
 * @returns {string|null} PEM certificate string or null
 */
export const resolveKafkaCaCert = () => {
  try {
    if (process.env.KAFKA_CA_CERT) {
      if (process.env.KAFKA_CA_CERT.includes('-----BEGIN CERTIFICATE-----')) {
        return process.env.KAFKA_CA_CERT;
      }
      const resolvedPath = path.resolve(process.env.KAFKA_CA_CERT);
      if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath, 'utf-8');
      }
    }

    if (process.env.AIVEN_CA_CERT) {
      if (process.env.AIVEN_CA_CERT.includes('-----BEGIN CERTIFICATE-----')) {
        return process.env.AIVEN_CA_CERT;
      }
      const resolvedPath = path.resolve(process.env.AIVEN_CA_CERT);
      if (fs.existsSync(resolvedPath)) {
        return fs.readFileSync(resolvedPath, 'utf-8');
      }
    }

    const defaultCertPath = path.resolve(__dirname, '../../certs/ca.pem');
    if (fs.existsSync(defaultCertPath)) {
      return fs.readFileSync(defaultCertPath, 'utf-8');
    }
  } catch (err) {
    console.error('Error resolving Kafka CA certificate:', err.message);
  }
  return null;
};

/**
 * Parses and returns list of Kafka brokers.
 * Supports comma-separated string or array.
 */
export const getBrokers = () => {
  const brokersEnv = process.env.KAFKA_BROKERS;
  if (!brokersEnv) {
    return ['kafka-47e4e14-project-4042.e.aivencloud.com:27641'];
  }
  return brokersEnv
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
};

/**
 * Builds Kafka client configuration with strict TLS and SASL PLAIN credentials.
 */
export const buildKafkaConfig = () => {
  const brokers = getBrokers();
  const clientId = process.env.KAFKA_CLIENT_ID || 'hivemart-backend';
  const caCert = resolveKafkaCaCert();

  const sslOptions = {
    rejectUnauthorized: true, // Strict certificate verification
    ca: caCert ? [caCert, ...tls.rootCertificates] : tls.rootCertificates,
  };

  const saslUsername = process.env.KAFKA_USERNAME || 'avnadmin';
  const saslPassword = process.env.KAFKA_PASSWORD;

  const saslOptions =
    saslUsername && saslPassword
      ? {
          mechanism: 'plain',
          username: saslUsername,
          password: saslPassword,
        }
      : undefined;

  return {
    clientId,
    brokers,
    ssl: sslOptions,
    sasl: saslOptions,
    connectionTimeout: 10000,
    requestTimeout: 10000,
    logLevel: logLevel.NOTHING,
  };
};

export const kafka = new Kafka(buildKafkaConfig());

// Reusable KafkaJS Admin client for connection reuse during health checks
let cachedAdmin = null;
let connectionPromise = null;

/**
 * Returns a cached, connected KafkaJS Admin client.
 * Reuses the existing connection to prevent per-request TLS/SASL handshake latency.
 */
export const getKafkaAdmin = async () => {
  if (cachedAdmin) {
    return cachedAdmin;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const admin = kafka.admin();
    await admin.connect();
    cachedAdmin = admin;
    connectionPromise = null;
    return admin;
  })();

  try {
    return await connectionPromise;
  } catch (err) {
    connectionPromise = null;
    cachedAdmin = null;
    throw err;
  }
};

/**
 * Safely disconnects and resets the cached KafkaJS Admin client.
 */
export const disconnectKafkaAdmin = async () => {
  if (cachedAdmin) {
    try {
      await cachedAdmin.disconnect();
    } catch {
      // Ignore disconnect error during shutdown / reset
    } finally {
      cachedAdmin = null;
      connectionPromise = null;
    }
  }
};

/**
 * Health check helper that queries the Kafka cluster description with a timeout.
 * Reuses the cached admin connection and safely resets it upon any connection failure.
 *
 * @param {number} timeoutMs
 * @returns {Promise<{ connected: boolean, clusterId?: string, brokersCount?: number, error?: string }>}
 */
export const checkKafkaHealth = async (timeoutMs = 10000) => {
  if (!process.env.KAFKA_BROKERS && !process.env.KAFKA_PASSWORD) {
    return {
      connected: false,
      error: 'Kafka credentials or brokers not configured',
    };
  }

  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Kafka health check timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    if (timer.unref) timer.unref();
  });

  try {
    const cluster = await Promise.race([
      (async () => {
        const admin = await getKafkaAdmin();
        return await admin.describeCluster();
      })(),
      timeoutPromise,
    ]);

    return {
      connected: true,
      clusterId: cluster.clusterId,
      brokersCount: Array.isArray(cluster.brokers) ? cluster.brokers.length : 0,
    };
  } catch (err) {
    // If the check fails, reset the cached admin so the next attempt can reconnect cleanly
    await disconnectKafkaAdmin();
    return {
      connected: false,
      error: err.message,
    };
  }
};

// Reusable KafkaJS Producer client
let cachedProducer = null;
let producerConnectingPromise = null;

/**
 * Returns a cached, connected KafkaJS Producer client.
 * Reuses connection across publication cycles to maximize throughput and minimize TLS/SASL handshakes.
 */
export const getKafkaProducer = async () => {
  if (cachedProducer) {
    return cachedProducer;
  }

  if (producerConnectingPromise) {
    return producerConnectingPromise;
  }

  producerConnectingPromise = (async () => {
    const producer = kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
    await producer.connect();
    cachedProducer = producer;
    producerConnectingPromise = null;
    return producer;
  })();

  try {
    return await producerConnectingPromise;
  } catch (err) {
    producerConnectingPromise = null;
    cachedProducer = null;
    throw err;
  }
};

/**
 * Safely disconnects and resets the cached KafkaJS Producer client.
 */
export const disconnectKafkaProducer = async () => {
  if (cachedProducer) {
    try {
      await cachedProducer.disconnect();
    } catch {
      // Ignore disconnect errors during shutdown
    } finally {
      cachedProducer = null;
      producerConnectingPromise = null;
    }
  }
};

export default kafka;

