import { pathToFileURL } from 'url';
import path from 'path';

const backendEnvPath = path.resolve('..', 'backend', '.env');
const dotenvModule = await import(pathToFileURL(path.resolve('..', 'backend', 'node_modules', 'dotenv', 'lib', 'main.js')).href);
dotenvModule.config({ path: backendEnvPath });

const dbModule = await import(pathToFileURL(path.resolve('..', 'backend', 'src', 'config', 'database.js')).href);
const pool = dbModule.default;

const osModule = await import(pathToFileURL(path.resolve('..', 'backend', 'src', 'config', 'opensearch.js')).href);
const openSearchClient = osModule.default;
const PRODUCT_ALIAS = 'hivemart_products';

export interface TestFixtureProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  inventory: Record<string, number>;
}

export async function createIsolatedTestProduct(customName?: string): Promise<TestFixtureProduct> {
  const uniqueId = `e2e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const name = customName || `E2E Test Isolated Product ${uniqueId}`;
  const category = 'Electronics';
  const price = 499.00;
  const inventory: Record<string, number> = {
    Bengaluru: 25,
    Hyderabad: 20,
    Chennai: 15,
    Mumbai: 30,
    Delhi: 35,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prodRes = await client.query(
      `INSERT INTO products (name, description, category, price, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, category, price`,
      [name, 'Isolated E2E Test Fixture Item', category, price, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', true]
    );
    const prodId = prodRes.rows[0].id;

    for (const [city, qty] of Object.entries(inventory)) {
      await client.query(
        `INSERT INTO inventory (product_id, city, quantity)
         VALUES ($1, $2, $3)`,
        [prodId, city, qty]
      );
    }
    await client.query('COMMIT');

    // Index into OpenSearch for catalog and search visibility using correct nested mapping
    if (openSearchClient) {
      await openSearchClient.index({
        index: PRODUCT_ALIAS,
        id: prodId,
        body: {
          product_id: prodId,
          name,
          description: 'Isolated E2E Test Fixture Item',
          category,
          price,
          image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
          is_active: true,
          updated_at: new Date().toISOString(),
          inventory: Object.entries(inventory).map(([city, quantity]) => ({ city, quantity })),
        },
        refresh: true,
      });
    }

    return {
      id: prodId,
      name,
      category,
      price,
      inventory,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteIsolatedTestProduct(productId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove foreign references cleanly
    await client.query('DELETE FROM monthly_essential_items WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM offline_bill_items WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM cart_items WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM order_items WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM inventory WHERE product_id = $1', [productId]);
    await client.query('DELETE FROM products WHERE id = $1', [productId]);
    await client.query('COMMIT');

    // Remove from OpenSearch
    if (openSearchClient) {
      try {
        await openSearchClient.delete({
          index: PRODUCT_ALIAS,
          id: productId,
          refresh: true,
        });
      } catch {
        // Ignore 404 if not found in OpenSearch
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cleanupTestUsersAndOrders(emailPrefix: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const usersRes = await client.query(
      `SELECT id FROM users WHERE email LIKE $1`,
      [`${emailPrefix}%`]
    );

    for (const row of usersRes.rows) {
      const uId = row.id;
      // Find orders to delete
      const ordersRes = await client.query('SELECT id FROM orders WHERE user_id = $1', [uId]);
      for (const oRow of ordersRes.rows) {
        await client.query('DELETE FROM outbox_events WHERE aggregate_id = $1', [oRow.id]);
        await client.query('DELETE FROM order_items WHERE order_id = $1', [oRow.id]);
      }
      await client.query('DELETE FROM orders WHERE user_id = $1', [uId]);
      await client.query('DELETE FROM carts WHERE user_id = $1', [uId]);
      await client.query('DELETE FROM users WHERE id = $1', [uId]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { pool, openSearchClient, PRODUCT_ALIAS };
