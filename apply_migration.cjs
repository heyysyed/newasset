require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in .env.local');
    console.error('Please create .env.local and add your Supabase connection string:');
    console.error('DATABASE_URL=postgres://postgres.[project]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Reading migration file (002_maintenance_enterprise.sql)...');
    const sql = fs.readFileSync('002_maintenance_enterprise.sql', 'utf8');

    console.log('Executing migration...');
    await client.query(sql);

    console.log('Migration successfully applied!');
  } catch (error) {
    console.error('Failed to apply migration:', error);
  } finally {
    await client.end();
  }
}

runMigration();
