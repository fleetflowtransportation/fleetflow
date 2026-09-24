import { createClient } from '@supabase/supabase-js';

const oldClient = createClient(
  'https://gcpeiwucgeocfghwkscn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcGVpd3VjZ2VvY2ZnaHdrc2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTc3MTYsImV4cCI6MjEwNTE5MzcxNn0.SG7WofPedJcehC6jk863cQK4fBH7PRsk9_fCnKdZ6Ic'
);

const newClient = createClient(
  'https://ydmeokfmsfgwrpbgmarv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbWVva2Ztc2Znd3JwYmdtYXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzI4NzgsImV4cCI6MjEwNTgwODg3OH0.3sxjdlS9b3bPwTJ81uTkHvm6MHXJR4b_adURNE4qrn0'
);

const tables = [
  'tenants',
  'fleet_users',
  'vehicles',
  'bookings',
  'fuel_logs',
  'odometer_logs',
  'issue_logs',
  'driver_schedules',
  'self_drive_staff',
  'maintenance_intervals',
  'maintenance_logs'
];

async function migrate() {
  console.log('=== STARTING AUTOMATED MIGRATION FROM SEOUL TO SINGAPORE ===');
  let totalSuccess = 0;

  for (const table of tables) {
    try {
      const { data, error } = await oldClient.from(table).select('*');
      if (error) {
        console.error(`[Error Fetching ${table}]:`, error.message);
        continue;
      }
      if (!data || data.length === 0) {
        console.log(`[${table}]: 0 records found in Seoul.`);
        continue;
      }

      console.log(`[${table}]: Transferring ${data.length} records...`);
      
      // Batch inserts of 40 records to avoid payload limits
      let tableTransferred = 0;
      for (let i = 0; i < data.length; i += 40) {
        let batch = data.slice(i, i + 40);
        
        // Ensure passengers and date columns are formatted properly
        if (table === 'bookings') {
          batch = batch.map(b => {
            let p = b.passengers;
            if (typeof p === 'string') {
              try { p = JSON.parse(p); } catch { p = []; }
            }
            const sDate = b.date_time ? b.date_time.split('T')[0] : '2026-09-01';
            const sTime = (b.date_time && b.date_time.includes('T')) ? b.date_time.split('T')[1].substring(0, 5) : '09:00';
            const eDate = b.finish_date_time ? b.finish_date_time.split('T')[0] : sDate;
            const eTime = (b.finish_date_time && b.finish_date_time.includes('T')) ? b.finish_date_time.split('T')[1].substring(0, 5) : '17:00';

            return {
              ...b,
              start_date: b.start_date || sDate,
              start_time: b.start_time || sTime,
              end_date: b.end_date || eDate,
              end_time: b.end_time || eTime,
              passengers: Array.isArray(p) ? p : []
            };
          });
        }

        if (table === 'driver_schedules') {
          batch = batch.map(s => ({
            ...s,
            shift_date: s.shift_date || s.date || '2026-09-01',
            shift_type: s.shift_type || 'Custom'
          }));
        }

        const { error: insertError } = await newClient.from(table).upsert(batch, { onConflict: 'id' });
        if (insertError) {
          console.error(`[Error in ${table} batch ${i}]:`, insertError.message);
        } else {
          tableTransferred += batch.length;
        }
      }
      console.log(`[${table}]: Successfully migrated ${tableTransferred}/${data.length} records.`);
      totalSuccess += tableTransferred;
    } catch (err: any) {
      console.error(`[Exception in ${table}]:`, err?.message || err);
    }
  }

  console.log(`\n=== MIGRATION COMPLETE: ${totalSuccess} total records copied to Singapore! ===`);
}

migrate();
