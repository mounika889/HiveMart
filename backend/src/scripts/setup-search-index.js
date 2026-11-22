import openSearchClient from '../config/opensearch.js';

export const INDEX_NAME = 'hivemart_products_v1';
export const ALIAS_NAME = 'hivemart_products';

export const indexMapping = {
  mappings: {
    properties: {
      product_id: { type: 'keyword' },
      name: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      description: { type: 'text' },
      category: { type: 'keyword' },
      price: { type: 'double' },
      image_url: { type: 'keyword' },
      is_active: { type: 'boolean' },
      inventory: {
        type: 'nested',
        properties: {
          city: { type: 'keyword' },
          quantity: { type: 'integer' },
        },
      },
      updated_at: { type: 'date' },
    },
  },
};

export const setupIndex = async () => {
  if (!openSearchClient) {
    console.error('OpenSearch client is not configured.');
    process.exit(1);
  }

  try {
    console.log(`--- Checking OpenSearch Index: ${INDEX_NAME} ---`);
    const existsRes = await openSearchClient.indices.exists({ index: INDEX_NAME });

    if (existsRes.body) {
      console.log(`[INFO] Index "${INDEX_NAME}" already exists. Verifying configuration...`);
    } else {
      console.log(`[CREATING] Creating index "${INDEX_NAME}" with versioned schema...`);
      await openSearchClient.indices.create({
        index: INDEX_NAME,
        body: indexMapping,
      });
      console.log(`[SUCCESS] Index "${INDEX_NAME}" created successfully.`);

      // Add alias
      console.log(`[ALIAS] Pointing alias "${ALIAS_NAME}" to "${INDEX_NAME}"...`);
      await openSearchClient.indices.putAlias({
        index: INDEX_NAME,
        name: ALIAS_NAME,
      });
      console.log(`[SUCCESS] Alias "${ALIAS_NAME}" configured.`);
    }

    console.log('--- OpenSearch Index Setup Complete ---');
  } catch (error) {
    console.error('Index setup failed:', error.message);
    if (error.meta && error.meta.body) {
      console.error('Details:', JSON.stringify(error.meta.body));
    }
    process.exit(1);
  }
};

if (process.argv[1] && process.argv[1].endsWith('setup-search-index.js')) {
  setupIndex();
}

