import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
  await client.connect();
  console.log('Connected. Reloading schema...');
  await client.query("NOTIFY pgrst, 'reload schema'");
  
  // also check if the column exists
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='client_commercial_profiles' 
      AND column_name='annual_interest_rate';
  `);
  console.log('Column check:', res.rows);
  
  await client.end();
}
run().catch(console.error);
