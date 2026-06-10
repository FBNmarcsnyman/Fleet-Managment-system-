// Bulk-loads matched fuel entries into Supabase fuel_entries.
// Reads FBN_FUEL_ENTRIES.json directly (no transcription) and inserts via supabase-js.
// Requires a temporary anon INSERT policy on fuel_entries (added/removed around this run).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const url = get('VITE_SUPABASE_URL');
const anon = get('VITE_SUPABASE_ANON_KEY');
if (!url || !anon) { console.error('Missing Supabase env'); process.exit(1); }

const supabase = createClient(url, anon, { auth: { persistSession: false } });

const entries = JSON.parse(readFileSync(new URL('../FBN_FUEL_ENTRIES.json', import.meta.url), 'utf8'))
  .map(({ organization_id, vehicle_id, date, odometer, liters, trip_distance_km, notes }) =>
    ({ organization_id, vehicle_id, date, odometer, liters, trip_distance_km, notes }));

console.log('Loading', entries.length, 'fuel entries...');
let inserted = 0;
const batch = 500;
for (let i = 0; i < entries.length; i += batch) {
  const slice = entries.slice(i, i + batch);
  const { error, count } = await supabase.from('fuel_entries').insert(slice, { count: 'exact' });
  if (error) { console.error('Batch', i / batch, 'FAILED:', error.message, error.details || ''); process.exit(2); }
  inserted += count ?? slice.length;
  console.log('  batch', i / batch, 'ok (+' + slice.length + ')');
}
console.log('DONE. Inserted', inserted, 'rows.');
