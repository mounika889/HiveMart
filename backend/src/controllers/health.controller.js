import { query } from '../config/database.js';
import { openSearchClient } from '../config/opensearch.js';
import { checkKafkaHealth } from '../config/kafka.js';

export const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'HiveMart API',
  });
};

export const getDbHealth = async (req, res) => {
  try {
    const result = await query('SELECT NOW() AS current_time');
    return res.status(200).json({
      status: 'ok',
      service: 'HiveMart PostgreSQL',
      database: 'connected',
      timestamp: result.rows[0].current_time,
    });
  } catch (error) {
    console.error('Database health check failure:', error.message);
    return res.status(503).json({
      status: 'error',
      service: 'HiveMart PostgreSQL',
      database: 'disconnected',
      message: 'Database health check failed',
    });
  }
};

export const getSearchHealth = async (req, res) => {
  if (!openSearchClient) {
    return res.status(503).json({
      status: 'error',
      service: 'HiveMart OpenSearch',
      search: 'disconnected',
      message: 'OPENSEARCH_URL is not configured',
    });
  }

  try {
    const info = await openSearchClient.info();
    return res.status(200).json({
      status: 'ok',
      service: 'HiveMart OpenSearch',
      search: 'connected',
      cluster_name: info.body?.cluster_name,
      version: info.body?.version?.number,
      distribution: info.body?.version?.distribution,
    });
  } catch (error) {
    console.error('OpenSearch health check failure:', error.message);
    return res.status(503).json({
      status: 'error',
      service: 'HiveMart OpenSearch',
      search: 'disconnected',
      message: 'OpenSearch health check failed',
    });
  }
};

export const getKafkaHealth = async (req, res) => {
  try {
    const health = await checkKafkaHealth(10000);
    if (health.connected) {
      return res.status(200).json({
        status: 'ok',
        service: 'HiveMart Kafka',
        kafka: 'connected',
        cluster_id: health.clusterId,
        brokers_count: health.brokersCount,
      });
    }

    console.error('Kafka health check failure:', health.error);
    return res.status(503).json({
      status: 'error',
      service: 'HiveMart Kafka',
      kafka: 'disconnected',
      message: 'Kafka health check failed',
    });
  } catch (error) {
    console.error('Kafka health check unexpected error:', error.message);
    return res.status(503).json({
      status: 'error',
      service: 'HiveMart Kafka',
      kafka: 'disconnected',
      message: 'Kafka health check failed',
    });
  }
};
