import pool from '../config/database.js';
import openSearchClient from '../config/opensearch.js';
import { INDEX_NAME } from './setup-search-index.js';

export const indexProducts = async () => {
  if (!openSearchClient) {
    console.error('OpenSearch client is not configured.');
    process.exit(1);
  }

  try {
    console.log('--- Starting PostgreSQL to OpenSearch Bulk Indexing ---');

    // 1. Fetch active products with aggregated city inventory from PostgreSQL
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.category,
        p.price,
        p.image_url,
        p.is_active,
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object('city', inv.city, 'quantity', inv.quantity)
          ) FILTER (WHERE inv.city IS NOT NULL),
          '[]'
        ) AS inventory
      FROM products p
      LEFT JOIN inventory inv ON p.id = inv.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.name ASC;
    `;

    const result = await pool.query(sql);
    const products = result.rows;
    console.log(`[INFO] Retrieved ${products.length} active products from PostgreSQL.`);

    if (products.length === 0) {
      console.warn('No products found to index.');
      return;
    }

    // 2. Build bulk indexing operations
    const bulkBody = [];
    for (const prod of products) {
      bulkBody.push({
        index: {
          _index: INDEX_NAME,
          _id: prod.id, // Deterministic UUID document ID
        },
      });
      bulkBody.push({
        product_id: prod.id,
        name: prod.name,
        description: prod.description,
        category: prod.category,
        price: parseFloat(prod.price),
        image_url: prod.image_url,
        is_active: prod.is_active,
        inventory: prod.inventory,
        updated_at: prod.updated_at,
      });
    }

    // 3. Execute bulk request in OpenSearch
    const bulkResponse = await openSearchClient.bulk({
      refresh: true,
      body: bulkBody,
    });

    if (bulkResponse.body && bulkResponse.body.errors) {
      console.error('[ERROR] Bulk indexing encountered errors:');
      const errorItems = bulkResponse.body.items.filter((item) => item.index && item.index.error);
      errorItems.forEach((item) => console.error(item.index.error));
      throw new Error('Bulk indexing failed with errors.');
    }

    // 4. Force index refresh and verify document count
    await openSearchClient.indices.refresh({ index: INDEX_NAME });
    const countResponse = await openSearchClient.count({ index: INDEX_NAME });
    const count = countResponse.body.count;

    console.log(`[SUCCESS] Bulk indexed ${products.length} products into "${INDEX_NAME}".`);
    console.log(`[VERIFIED] Total documents verified in OpenSearch index: ${count}`);
  } catch (error) {
    console.error('Indexing failed:', error.message);
    if (error.meta && error.meta.body) {
      console.error('Details:', JSON.stringify(error.meta.body));
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (process.argv[1] && process.argv[1].endsWith('index-products.js')) {
  indexProducts();
}

