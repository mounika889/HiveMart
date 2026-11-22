import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getKafkaAdmin, disconnectKafkaAdmin } from '../config/kafka.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TOPIC_NAME = process.env.KAFKA_ORDERS_TOPIC || 'hivemart.orders';
const DEFAULT_PARTITIONS = 3;

/**
 * Repeatable Kafka topic setup script:
 * - Inspects Kafka cluster broker topology
 * - Selects replication factor supported by the cluster (e.g. 2 for a 2-broker cluster)
 * - Checks if topic already exists; creates if missing
 * - Inspects and logs topic metadata (partitions, leaders, replicas, ISR)
 * - Safely disconnects admin client
 */
export const setupKafkaTopics = async () => {
  console.log('=== HIVEMART KAFKA TOPIC SETUP ===\n');

  let admin = null;
  try {
    admin = await getKafkaAdmin();

    // 1. Describe cluster to detect broker count
    console.log('[1/4] Describing Kafka cluster topology...');
    const cluster = await admin.describeCluster();
    const brokers = cluster.brokers || [];
    const brokerCount = brokers.length;
    console.log(`  Cluster ID: ${cluster.clusterId}`);
    console.log(`  Brokers detected (${brokerCount}):`, brokers.map((b) => `${b.host}:${b.port} (nodeId: ${b.nodeId})`).join(', '));

    if (brokerCount === 0) {
      throw new Error('No active brokers found in Kafka cluster.');
    }

    // Determine partitions and replication factor supported by cluster topology
    // In a 2-broker cluster on Aiven, partition count and RF cannot exceed broker capacity (2)
    const numPartitions = Math.min(3, brokerCount);
    const replicationFactor = Math.min(brokerCount, 2);
    console.log(`  Target configuration: partitions=${numPartitions}, replicationFactor=${replicationFactor}`);

    // 2. Check existing topics
    console.log(`\n[2/4] Checking if topic "${TOPIC_NAME}" exists...`);
    const existingTopics = await admin.listTopics();
    const topicExists = existingTopics.includes(TOPIC_NAME);

    if (topicExists) {
      console.log(`  Topic "${TOPIC_NAME}" already exists. Skipping creation to preserve data.`);
    } else {
      console.log(`  Topic "${TOPIC_NAME}" not found. Creating with ${numPartitions} partitions and RF=${replicationFactor}...`);
      const created = await admin.createTopics({
        waitForLeaders: true,
        topics: [
          {
            topic: TOPIC_NAME,
            numPartitions,
            replicationFactor,
          },
        ],
      });
      console.log(`  Topic creation status: ${created ? 'Created' : 'Already created concurrently'}`);
    }

    // 3. Verify topic metadata
    console.log(`\n[3/4] Verifying topic metadata for "${TOPIC_NAME}"...`);
    const metadata = await admin.fetchTopicMetadata({ topics: [TOPIC_NAME] });
    const topicMeta = metadata.topics.find((t) => t.name === TOPIC_NAME);

    if (!topicMeta) {
      throw new Error(`Topic "${TOPIC_NAME}" not found in metadata response.`);
    }

    console.log(`  Topic Name: ${topicMeta.name}`);
    console.log(`  Partition Count: ${topicMeta.partitions.length}`);
    topicMeta.partitions.forEach((partition) => {
      console.log(
        `    - Partition ${partition.partitionId}: Leader=${partition.leader}, Replicas=[${partition.replicas.join(', ')}], ISR=[${partition.isr.join(', ')}]`
      );
    });

    console.log('\n[4/4] Topic setup completed successfully.');
    return {
      topic: TOPIC_NAME,
      partitions: topicMeta.partitions.length,
      replicationFactor,
      clusterId: cluster.clusterId,
    };
  } catch (error) {
    console.error('Fatal error during Kafka topic setup:', error.message);
    throw error;
  } finally {
    await disconnectKafkaAdmin();
  }
};

// Execute if run directly from CLI
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  setupKafkaTopics()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default setupKafkaTopics;
