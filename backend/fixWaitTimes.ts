import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: patients, error } = await supabase.from('patients').select('id, status');
  if (error) {
    console.error(error);
    return;
  }
  if (!patients) return;

  const now = Date.now();
  let updated = 0;
  for (const p of patients) {
    // Random arrival time in the last 120 minutes for EVERYONE
    const newArrival = new Date(now - Math.floor(Math.random() * 120 * 60000)).toISOString();
    await supabase.from('patients').update({ arrival_time: newArrival }).eq('id', p.id);
    updated++;
  }
  console.log(`Updated arrival times for ${updated} patients.`);
}
run();
