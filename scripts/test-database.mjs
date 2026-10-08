import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const name = `assetpro-test-${process.pid}`
function run(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || result.stdout)
  return result.stdout
}
try {
  run(['run', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'])
  for (let attempt = 0; ; attempt++) {
    try { run(['exec', name, 'pg_isready', '-U', 'postgres']); break }
    catch (error) { if (attempt === 30) throw error; await new Promise(r => setTimeout(r, 250)) }
  }
  const sql = input => run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],input)
  // pg_isready can briefly succeed while the container's init process is
  // restarting PostgreSQL. Require a real query before applying migrations.
  for (let attempt = 0; ; attempt++) {
    try { sql('SELECT 1;'); break }
    catch (error) { if (attempt === 30) throw error; await new Promise(r => setTimeout(r, 250)) }
  }
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;`)
  // Use the repository's real baseline table definitions, before legacy policies.
  const baseline = readFileSync('supabase-setup.sql','utf8').split('-- ROLE HELPER FUNCTIONS')[0]
  sql(baseline)
  sql('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anon,authenticated;')
  const migration = readFileSync('supabase/migrations/202610080001_core_security.sql','utf8')
  sql(migration)
  sql(migration) // Idempotence on the existing schema.
  console.log(sql(readFileSync('tests/database/security.sql','utf8')))
  // A real PostgreSQL dump/restore drill on synthetic data, not production.
  run(['exec',name,'sh','-c','pg_dump -U postgres -Fc -f /tmp/restore-test.dump postgres && createdb -U postgres recovery && pg_restore -U postgres --exit-on-error -d recovery /tmp/restore-test.dump'])
  const restored = run(['exec',name,'psql','-U','postgres','-d','recovery','-Atc',"SELECT (SELECT count(*) FROM public.assets) || ':' || (SELECT count(*) FROM public.asset_photos) || ':' || (SELECT count(*) FROM public.security_events)"]).trim()
  if (restored !== '3:2:2') throw new Error(`Restore mismatch: ${restored}`)
  console.log('PASS: PostgreSQL archive dump restored assets, dependent photos, and security events.')
  const stockMigration=readFileSync('supabase/migrations/202610080002_stock_reconciliation.sql','utf8')
  sql(stockMigration);sql(stockMigration)
  console.log(sql(readFileSync('tests/database/stock.sql','utf8')))
  const reportMigration=readFileSync('supabase/migrations/202610080003_report_delivery.sql','utf8')
  sql(reportMigration);sql(reportMigration)
} finally {
  // Only the uniquely named disposable fixture created by this process.
  spawnSync('docker',['rm','-f',name],{stdio:'ignore'})
}
