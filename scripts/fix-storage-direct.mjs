/**
 * Direct PostgreSQL connection to fix storage permissions
 * Run: node scripts/fix-storage-direct.mjs
 */
import pg from 'pg';
const { Client } = pg;

// ⚠️ Replace YOUR_PASSWORD with the password from Supabase Dashboard → Connect → Direct connection
const CONNECTION_STRING = 'postgresql://postgres:YOUR_PASSWORD@db.odaandtvfdsezmrcxqpc.supabase.co:5432/postgres';

const client = new Client({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('✅ Connected as:', (await client.query('SELECT current_user, session_user')).rows[0]);

  const tests = [
    {
      name: '1. GRANT on storage.buckets to service_role',
      sql: `GRANT ALL PRIVILEGES ON storage.buckets TO service_role;`,
    },
    {
      name: '2. GRANT on storage.objects to service_role',
      sql: `GRANT ALL PRIVILEGES ON storage.objects TO service_role;`,
    },
    {
      name: '3. GRANT on storage.migrations to service_role',
      sql: `GRANT ALL PRIVILEGES ON storage.migrations TO service_role;`,
    },
    {
      name: '4. CREATE POLICY on buckets_analytics',
      sql: `CREATE POLICY "allow all on buckets_analytics"
            ON storage.buckets_analytics FOR ALL USING (true) WITH CHECK (true);`,
    },
    {
      name: '5. CREATE POLICY on migrations',
      sql: `CREATE POLICY "allow all on migrations"
            ON storage.migrations FOR ALL USING (true) WITH CHECK (true);`,
    },
    {
      name: '6. CREATE POLICY on s3_multipart_uploads',
      sql: `CREATE POLICY "allow all on s3_multipart_uploads"
            ON storage.s3_multipart_uploads FOR ALL USING (true) WITH CHECK (true);`,
    },
    {
      name: '7. CREATE POLICY on s3_multipart_uploads_parts',
      sql: `CREATE POLICY "allow all on s3_multipart_uploads_parts"
            ON storage.s3_multipart_uploads_parts FOR ALL USING (true) WITH CHECK (true);`,
    },
    {
      name: '8. INSERT test bucket into storage.buckets',
      sql: `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
            VALUES ('item-images', 'item-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
            ON CONFLICT (id) DO UPDATE SET public = true;`,
    },
  ];

  for (const test of tests) {
    try {
      await client.query(test.sql);
      console.log(`✅ ${test.name}`);
    } catch (err) {
      console.log(`❌ ${test.name}: ${err.message}`);
    }
  }

  // Final check
  const buckets = await client.query('SELECT * FROM storage.buckets');
  console.log('\n📦 Buckets now:', buckets.rows);

  await client.end();
}

run().catch(console.error);
