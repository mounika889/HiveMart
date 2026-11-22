import pool from '../config/database.js';

export const productsData = [
  // 1. Electronics (6 items)
  {
    name: 'boAt Rockerz 450 Bluetooth On-Ear Headphones with Mic',
    description: 'Wireless Bluetooth headphones with 40mm dynamic drivers, up to 15 hours playback, adaptive earcups, and soft ear cushions.',
    category: 'Electronics',
    price: 1499.00,
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 1, // Edge case: exactly 1 unit in Bengaluru (low stock)
      Hyderabad: 15,
      Chennai: 10,
      Mumbai: 20,
      Delhi: 25,
    },
  },
  {
    name: 'Noise ColorFit Pulse 2 Max 1.85" Smart Watch',
    description: 'Smartwatch featuring 1.85-inch TFT display, 550 nits brightness, Bluetooth calling, 100 sports modes, and 10-day battery life.',
    category: 'Electronics',
    price: 1999.00,
    image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 0, // Edge case: exactly 0 units in Bengaluru (out of stock)
      Hyderabad: 8,
      Chennai: 12,
      Mumbai: 18,
      Delhi: 22,
    },
  },
  {
    name: 'Portronics SoundDrum 15W Portable Bluetooth Speaker',
    description: 'High-definition stereo speaker with in-built FM, 15W powerful sound output, IPX6 water resistance, and 7-hour playtime.',
    category: 'Electronics',
    price: 1799.00,
    image_url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 25,
      Hyderabad: 30,
      Chennai: 15,
      Mumbai: 40,
      Delhi: 35,
    },
  },
  {
    name: 'OnePlus Nord Buds 2 TWS in-Ear Earbuds with ANC',
    description: 'True Wireless earbuds with active noise cancellation up to 25dB, BassWave bass enhancement algorithm, and 36-hour total battery.',
    category: 'Electronics',
    price: 2999.00,
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 40,
      Hyderabad: 20,
      Chennai: 25,
      Mumbai: 35,
      Delhi: 45,
    },
  },
  {
    name: 'Mi 10000mAh Power Bank 3i with 18W Fast Charging',
    description: 'Dual USB output, 18W fast charging power bank with 12 layers of advanced circuit protection and Type-C input/output.',
    category: 'Electronics',
    price: 1299.00,
    image_url: 'https://images.unsplash.com/photo-1609592426860-2ffc41865a8e?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 50,
      Hyderabad: 35,
      Chennai: 30,
      Mumbai: 45,
      Delhi: 60,
    },
  },
  {
    name: 'Zebronics Zeb-Transformer Gaming Keyboard & Mouse Combo',
    description: 'Full-size gaming keyboard with multi-color LED lights, integrated media control keys, braided cable, and 3200 DPI ergonomic mouse.',
    category: 'Electronics',
    price: 1399.00,
    image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 18,
      Hyderabad: 14,
      Chennai: 16,
      Mumbai: 22,
      Delhi: 28,
    },
  },

  // 2. Fashion (6 items)
  {
    name: 'FabIndia Men Pure Cotton Indigo Printed Straight Kurta',
    description: 'Traditional long kurta crafted from 100% pure breathable cotton featuring artisanal hand-block indigo print, mandarin collar, and side slits.',
    category: 'Fashion',
    price: 1690.00,
    image_url: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 30,
      Hyderabad: 25,
      Chennai: 20,
      Mumbai: 35,
      Delhi: 40,
    },
  },
  {
    name: 'Biba Women Printed Flared Anarkali Kurta Set',
    description: 'Ethnic festive ensemble including a flared Anarkali kurta with gold foil detailing, matching churidar, and lightweight chiffon dupatta.',
    category: 'Fashion',
    price: 3499.00,
    image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 15,
      Hyderabad: 18,
      Chennai: 14,
      Mumbai: 28,
      Delhi: 32,
    },
  },
  {
    name: 'Manyavar Silk Blend Self-Design Festive Nehru Jacket',
    description: 'Sophisticated mandarin collar sleeveless ethnic jacket made with rich Jacquard woven silk-blend fabric and ornamental buttons.',
    category: 'Fashion',
    price: 2999.00,
    image_url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 20,
      Hyderabad: 16,
      Chennai: 12,
      Mumbai: 24,
      Delhi: 30,
    },
  },
  {
    name: 'W for Woman Geometric Print Straight Fit Kurta',
    description: 'Contemporary daily-wear kurta with modern geometric patterns, round neck with keyhole detail, and three-quarter sleeves in viscose rayon.',
    category: 'Fashion',
    price: 1299.00,
    image_url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 28,
      Hyderabad: 22,
      Chennai: 18,
      Mumbai: 32,
      Delhi: 36,
    },
  },
  {
    name: 'Allen Solly Men Solid Regular Fit Polo T-Shirt',
    description: 'Classic pique polo crafted from pure combed cotton with ribbed collar, two-button placket, and signature embroidered logo.',
    category: 'Fashion',
    price: 899.00,
    image_url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 60,
      Hyderabad: 45,
      Chennai: 40,
      Mumbai: 55,
      Delhi: 65,
    },
  },
  {
    name: 'Raymond Men Navy Blue Slim Fit Casual Chinos',
    description: 'Premium stretch cotton flat-front casual trousers engineered for everyday work and leisure comfort with button-through back pockets.',
    category: 'Fashion',
    price: 1999.00,
    image_url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 35,
      Hyderabad: 28,
      Chennai: 24,
      Mumbai: 42,
      Delhi: 48,
    },
  },

  // 3. Home & Kitchen (6 items)
  {
    name: 'Prestige Iris 750W Mixer Grinder with 4 Stainless Steel Jars',
    description: 'Heavy duty 750-watt motor mixer grinder equipped with 3 versatile stainless steel jars, transparent juicer jar, and overload protection.',
    category: 'Home & Kitchen',
    price: 3199.00,
    image_url: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 22,
      Hyderabad: 18,
      Chennai: 25,
      Mumbai: 30,
      Delhi: 34,
    },
  },
  {
    name: 'Hawkins Futura Hard Anodized 3 Litre Pressure Cooker',
    description: 'Induction and gas compatible hard anodized cooker with stay-cool handles, pressure-locked safety lid, and scratch-resistant black finish.',
    category: 'Home & Kitchen',
    price: 2250.00,
    image_url: 'https://images.unsplash.com/photo-1584990347449-30df2944b2fa?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 18,
      Hyderabad: 15,
      Chennai: 20,
      Mumbai: 26,
      Delhi: 30,
    },
  },
  {
    name: 'Milton Thermosteel Flip Lid 1000ml Insulated Flask',
    description: 'Double-walled vacuum insulated stainless steel water bottle keeping beverages hot or cold for over 24 hours with leak-proof flip lid.',
    category: 'Home & Kitchen',
    price: 949.00,
    image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 70,
      Hyderabad: 50,
      Chennai: 45,
      Mumbai: 65,
      Delhi: 80,
    },
  },
  {
    name: 'Pigeon by Stovekraft Cruise 1800W Induction Cooktop',
    description: 'Energy-saving induction cooktop featuring 7 pre-set Indian cooking menus, LED display, touch buttons, and auto shut-off protection.',
    category: 'Home & Kitchen',
    price: 1599.00,
    image_url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 26,
      Hyderabad: 20,
      Chennai: 24,
      Mumbai: 32,
      Delhi: 38,
    },
  },
  {
    name: 'Borosil Glass Mixing Bowl with Lid Set of 3',
    description: '100% borosilicate glass prep bowls (500ml, 900ml, 1.3L) that are microwave, oven, dishwasher, and freezer safe with airtight silicone lids.',
    category: 'Home & Kitchen',
    price: 899.00,
    image_url: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 45,
      Hyderabad: 32,
      Chennai: 28,
      Mumbai: 40,
      Delhi: 52,
    },
  },
  {
    name: 'Solimo Microfiber Reversible Comforter Single Bed',
    description: 'All-season soft microfiber lightweight duvet with 200 GSM hypoallergenic hollow polyester filling and diamond quilt stitching.',
    category: 'Home & Kitchen',
    price: 1199.00,
    image_url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 30,
      Hyderabad: 24,
      Chennai: 20,
      Mumbai: 36,
      Delhi: 42,
    },
  },

  // 4. Beauty & Personal Care (6 items)
  {
    name: 'Mamaearth Onion Hair Oil with Redensyl for Hair Fall Control 250ml',
    description: 'Ayurvedic enriched hair oil with sulfur-rich red onion seed oil and Redensyl, proven to boost hair density and curb breakage.',
    category: 'Beauty & Personal Care',
    price: 499.00,
    image_url: 'https://images.unsplash.com/photo-1608248597359-543503f167e4?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 55,
      Hyderabad: 40,
      Chennai: 35,
      Mumbai: 50,
      Delhi: 60,
    },
  },
  {
    name: 'WOW Skin Science Moroccan Argan Oil Shampoo 300ml',
    description: 'Deep hydrating sulfate-free & paraben-free shampoo formulated with pure Moroccan argan oil, vitamin B5, and sweet almond oil.',
    category: 'Beauty & Personal Care',
    price: 399.00,
    image_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 48,
      Hyderabad: 38,
      Chennai: 32,
      Mumbai: 44,
      Delhi: 56,
    },
  },
  {
    name: 'Plum Green Tea Pore Cleansing Face Wash 120ml',
    description: 'Soap-free foaming gel face wash packed with green tea extracts and gentle cellulose scrub beads for acne-prone skin care.',
    category: 'Beauty & Personal Care',
    price: 345.00,
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 65,
      Hyderabad: 42,
      Chennai: 38,
      Mumbai: 58,
      Delhi: 70,
    },
  },
  {
    name: 'Forest Essentials Delicate Facial Cleanser Kashmiri Saffron 200ml',
    description: 'Luxurious Ayurvedic face cleanser infused with Kashmiri saffron, neem oil, and kewda water for glowing, nourished complexion.',
    category: 'Beauty & Personal Care',
    price: 1475.00,
    image_url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 16,
      Hyderabad: 12,
      Chennai: 10,
      Mumbai: 22,
      Delhi: 25,
    },
  },
  {
    name: 'mCaffeine Naked & Raw Exfoliating Coffee Body Scrub 100g',
    description: 'Pure Arabica coffee scrub loaded with coconut oil to buff away dead skin cells, reduce cellulite, and reveal smooth moisturized skin.',
    category: 'Beauty & Personal Care',
    price: 449.00,
    image_url: 'https://images.unsplash.com/photo-1567928815104-b7980ee5032e?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 42,
      Hyderabad: 35,
      Chennai: 30,
      Mumbai: 48,
      Delhi: 54,
    },
  },
  {
    name: 'Biotique Bio Dandelion Ageless Lightening Serum 40ml',
    description: 'Botanical skin serum combining pure dandelion extracts and nutmeg oil rich in vitamin E to ease dark spots and rejuvenate skin.',
    category: 'Beauty & Personal Care',
    price: 230.00,
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 80,
      Hyderabad: 60,
      Chennai: 50,
      Mumbai: 75,
      Delhi: 90,
    },
  },

  // 5. Groceries (6 items)
  {
    name: 'Tata Tea Gold Assam Orthodox Long Leaves Rich Tea 1kg',
    description: 'Exquisite blend of fine CTC teas gently rolled with 15% long orthodox Assam leaves for irresistible aroma and rich taste.',
    category: 'Groceries',
    price: 575.00,
    image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 90,
      Hyderabad: 75,
      Chennai: 80,
      Mumbai: 85,
      Delhi: 100,
    },
  },
  {
    name: 'Fortune Sunlite Refined Sunflower Cooking Oil 5 Litre Pouch',
    description: 'Enriched with vitamins A, D, and E, light and easily digestible sunflower cooking oil with high smoke point for crispy frying.',
    category: 'Groceries',
    price: 720.00,
    image_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 60,
      Hyderabad: 50,
      Chennai: 55,
      Mumbai: 65,
      Delhi: 70,
    },
  },
  {
    name: 'Aashirvaad Superior MP Whole Wheat Sharbati Atta 10kg',
    description: '100% pure Madhya Pradesh Sharbati wheat grains ground with traditional chakki process for softer and fluffier rotis.',
    category: 'Groceries',
    price: 490.00,
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 85,
      Hyderabad: 70,
      Chennai: 65,
      Mumbai: 90,
      Delhi: 110,
    },
  },
  {
    name: 'Daawat Rozana Super Basmati Rice 5kg',
    description: 'Aged long grain aromatic Basmati rice ideal for everyday cooking, biryanis, and pulav with delightful texture and fluffiness.',
    category: 'Groceries',
    price: 425.00,
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 70,
      Hyderabad: 60,
      Chennai: 50,
      Mumbai: 75,
      Delhi: 95,
    },
  },
  {
    name: '24 Mantra Organic Natural Turmeric Powder Haldi 200g',
    description: 'Sustainably farmed organic turmeric powder packed with potent curcumin, completely pesticide-free and non-irradiated.',
    category: 'Groceries',
    price: 75.00,
    image_url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 110,
      Hyderabad: 90,
      Chennai: 80,
      Mumbai: 100,
      Delhi: 120,
    },
  },
  {
    name: 'Dabur 100% Pure Squeezy Honey 500g',
    description: 'NMR tested 100% pure natural honey naturally rich in antioxidants and enzymes, sourced directly from pristine Himalayan apiaries.',
    category: 'Groceries',
    price: 245.00,
    image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 95,
      Hyderabad: 80,
      Chennai: 70,
      Mumbai: 85,
      Delhi: 105,
    },
  },

  // 6. Sports & Fitness (6 items)
  {
    name: 'Nivia Storm Rubber Moulded Football Size 5',
    description: 'Durable 32-panel rubber moulded match football designed for hard and wet outdoor ground conditions with superior air retention.',
    category: 'Sports & Fitness',
    price: 499.00,
    image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 35,
      Hyderabad: 28,
      Chennai: 30,
      Mumbai: 40,
      Delhi: 45,
    },
  },
  {
    name: 'Cosco Light Tennis Cricket Ball Pack of 6 Yellow',
    description: 'High-visibility light tennis balls engineered for gully and tournament cricket with consistent bounce and heavy-duty felt cover.',
    category: 'Sports & Fitness',
    price: 390.00,
    image_url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 120,
      Hyderabad: 95,
      Chennai: 90,
      Mumbai: 110,
      Delhi: 130,
    },
  },
  {
    name: 'Yonex ZR 100 Aluminium Isometric Badminton Racquet with Full Cover',
    description: 'Lightweight aluminium racquet featuring an isometric frame shape for enlarged sweet spot and tempered steel shaft for power smashes.',
    category: 'Sports & Fitness',
    price: 649.00,
    image_url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 45,
      Hyderabad: 35,
      Chennai: 40,
      Mumbai: 50,
      Delhi: 55,
    },
  },
  {
    name: 'Boldfit Resistance Bands Exercise Loop Bands Set of 5',
    description: 'Durable 100% natural latex resistance loop bands with 5 varying resistance levels (X-Light to X-Heavy) for home workouts and rehabilitation.',
    category: 'Sports & Fitness',
    price: 449.00,
    image_url: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 50,
      Hyderabad: 40,
      Chennai: 35,
      Mumbai: 45,
      Delhi: 60,
    },
  },
  {
    name: 'Strauss Anti-Skid Dual Color TPE Yoga Mat 6mm with Carry Bag',
    description: 'Eco-friendly recyclable TPE yoga mat with textured grip surface, optimal 6mm joint cushioning, and moisture-resistant material.',
    category: 'Sports & Fitness',
    price: 999.00,
    image_url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 30,
      Hyderabad: 22,
      Chennai: 25,
      Mumbai: 35,
      Delhi: 40,
    },
  },
  {
    name: 'Kobo Steel Wire High Speed Crossfit Skipping Rope',
    description: 'Adjustable 360-degree ball-bearing speed skipping rope with tangle-free steel wire cable and anti-slip aluminium alloy handles.',
    category: 'Sports & Fitness',
    price: 299.00,
    image_url: 'https://images.unsplash.com/photo-1544033527-b192daee1f5b?auto=format&fit=crop&w=800&q=80',
    inventory: {
      Bengaluru: 65,
      Hyderabad: 50,
      Chennai: 45,
      Mumbai: 60,
      Delhi: 75,
    },
  },
];

export const seedProducts = async () => {
  const client = await pool.connect();
  try {
    console.log('--- Starting HiveMart Product & Inventory Seed ---');
    console.log(`Preparing to seed ${productsData.length} Indian retail products across 6 categories...`);

    let productsCount = 0;
    let inventoryCount = 0;

    for (const item of productsData) {
      // 1. Check if product already exists by name
      const existingRes = await client.query('SELECT id FROM products WHERE name = $1', [item.name]);
      let productId;

      if (existingRes.rows.length > 0) {
        productId = existingRes.rows[0].id;
        await client.query(
          `UPDATE products 
           SET description = $1, category = $2, price = $3, image_url = $4, is_active = $5, updated_at = NOW() 
           WHERE id = $6`,
          [item.description, item.category, item.price, item.image_url, true, productId]
        );
      } else {
        const insertRes = await client.query(
          `INSERT INTO products (name, description, category, price, image_url, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [item.name, item.description, item.category, item.price, item.image_url, true]
        );
        productId = insertRes.rows[0].id;
      }
      productsCount++;

      // 2. Upsert inventory for all specified cities
      for (const [city, qty] of Object.entries(item.inventory)) {
        await client.query(
          `INSERT INTO inventory (product_id, city, quantity, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (product_id, city)
           DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
          [productId, city, qty]
        );
        inventoryCount++;
      }
    }

    console.log(`[SUCCESS] Seeded/updated ${productsCount} products successfully.`);
    console.log(`[SUCCESS] Seeded/updated ${inventoryCount} city inventory records across 5 cities.`);
  } catch (error) {
    console.error('Seed execution failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('seed-products.js')) {
  seedProducts();
}

