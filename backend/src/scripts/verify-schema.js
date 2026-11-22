import pool from '../config/database.js';

async function verify() {
  console.log('=== VERIFYING HIVEMART POSTGRESQL SCHEMA ===\n');

  // 1. Tables
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log('1. TABLES IN DATABASE:');
  tablesRes.rows.forEach(r => console.log(`   - ${r.table_name}`));

  // 2. Columns for each table
  console.log('\n2. COLUMNS & DATA TYPES:');
  const colsRes = await pool.query(`
    SELECT table_name, column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);
  let curTable = '';
  colsRes.rows.forEach(col => {
    if (col.table_name !== curTable) {
      curTable = col.table_name;
      console.log(`\n  [Table: ${curTable}]`);
    }
    console.log(`    * ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
  });

  // 3. Constraints
  console.log('\n3. CONSTRAINTS (PK, FK, UNIQUE, CHECK):');
  const constraintsRes = await pool.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `);
  constraintsRes.rows.forEach(c => {
    console.log(`   - [${c.table_name}] ${c.constraint_type}: ${c.constraint_name}`);
  });

  // 4. Foreign Keys details
  console.log('\n4. FOREIGN KEY REFERENCES:');
  const fkRes = await pool.query(`
    SELECT
      kcu.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY kcu.table_name, kcu.column_name;
  `);
  fkRes.rows.forEach(fk => {
    console.log(`   - [${fk.table_name}.${fk.column_name}] -> [${fk.foreign_table_name}.${fk.foreign_column_name}] (ON DELETE ${fk.delete_rule})`);
  });

  // 5. Indexes
  console.log('\n5. INDEXES:');
  const indexesRes = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  indexesRes.rows.forEach(i => {
    console.log(`   - [${i.tablename}] ${i.indexname} => ${i.indexdef}`);
  });

  await pool.end();
}

verify().catch((err) => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});

