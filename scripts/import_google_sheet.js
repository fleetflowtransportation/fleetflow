const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://gcpeiwucgeocfghwkscn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcGVpd3VjZ2VvY2ZnaHdrc2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTc3MTYsImV4cCI6MjEwNTE5MzcxNn0.SG7WofPedJcehC6jk863cQK4fBH7PRsk9_fCnKdZ6Ic'
);

// Map vehicle name from sheet to vehicle ID in DB
function getVehicleId(vName) {
  if (!vName || vName === '-' || vName === 'None') return null;
  const lower = vName.toLowerCase();
  if (lower.includes('alza')) return 'alza-1';
  if (lower.includes('hiace') || lower.includes('toyota')) return 'van-1';
  if (lower.includes('urvan') || lower.includes('nissan')) return 'van-2';
  if (lower.includes('foton') || lower.includes('transit') || lower.includes('ford')) return 'van-3';
  return null;
}

// Map driver name from sheet to driver ID in DB
function getDriverId(dName) {
  if (!dName || dName === '-' || dName.toLowerCase().includes('self-drive')) return null;
  const lower = dName.toLowerCase();
  if (lower.includes('syafiq')) return 'driver-syafiq';
  if (lower.includes('saiful')) return 'driver-saiful';
  if (lower.includes('aziz')) return 'driver-aziz';
  return null;
}

function parseDate(dateStr, timeStr) {
  try {
    // Format in sheet: DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const time = timeStr && timeStr.trim() ? timeStr.trim() : '00:00:00';
      return `${year}-${month}-${day}T${time}`;
    }
  } catch (e) {
    console.error('Error parse date:', dateStr, timeStr);
  }
  return new Date().toISOString();
}

// Minimal CSV Parser handling quoted fields with commas and newlines
function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let curVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        curVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(curVal);
      curVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(curVal);
      if (row.length > 1 || row[0] !== '') {
        lines.push(row);
      }
      row = [];
      curVal = '';
    } else {
      curVal += char;
    }
  }
  if (curVal || row.length > 0) {
    row.push(curVal);
    lines.push(row);
  }
  return lines;
}

async function run() {
  const csvContent = fs.readFileSync('./data/bookings.csv', 'utf-8');
  const rows = parseCSV(csvContent);
  const header = rows[0];
  const dataRows = rows.slice(1);

  console.log(`Parsed ${dataRows.length} booking rows from CSV.`);

  const bookingsToInsert = [];

  for (const r of dataRows) {
    if (r.length < 5) continue;
    const [
      timestamp, email, requesterName, department, useDate, startTime, finishTime,
      purpose, destination, pickupPoint, pickupAddress, staffCount, kidsCount,
      serviceType, icNumber, vehiclePref, remarks, statusCol, vehicleAssigned,
      driverAssigned, calendarId, adminNotes
    ] = r;

    if (!useDate || !destination) continue;

    const dt = parseDate(useDate, startTime);
    const finishDt = finishTime ? parseDate(useDate, finishTime) : null;

    const passengers = [];
    if (staffCount && parseInt(staffCount)) {
      passengers.push({ category: 'Staff', count: parseInt(staffCount) });
    }
    if (kidsCount) {
      const matchNum = kidsCount.match(/\d+/);
      const count = matchNum ? parseInt(matchNum[0]) : 1;
      passengers.push({ category: 'Kids', count });
    }

    let status = 'Pending';
    const stUpper = (statusCol || '').toUpperCase();
    if (stUpper.includes('CONFIRM')) status = 'Confirmed';
    else if (stUpper.includes('CONFLICT')) status = 'Conflict';
    else if (stUpper.includes('CANCEL')) status = 'Cancelled';
    else if (stUpper.includes('ASSIGN')) status = 'Assigned';
    else if (stUpper.includes('COMPLET')) status = 'Completed';

    const bookingRow = {
      destination: destination || '-',
      purpose: purpose || '-',
      date_time: dt,
      finish_date_time: finishDt,
      pickup_point: pickupPoint || 'YCK',
      address: pickupAddress && pickupAddress.trim() ? pickupAddress : (destination || '-'),
      passengers: passengers,
      escort: '',
      should_wait: (remarks || '').toLowerCase().includes('tunggu') || (remarks || '').toLowerCase().includes('menunggu'),
      return_trip: (remarks || '').toLowerCase().includes('balik') || (remarks || '').toLowerCase().includes('return'),
      status: status,
      driver_id: getDriverId(driverAssigned),
      vehicle_id: getVehicleId(vehicleAssigned || vehiclePref),
      remarks: remarks || null,
      requester_name: requesterName || 'Pemohon',
      requester_email: email || 'user@yck.org.my',
      department: department || 'General',
      service_type: (serviceType && serviceType.toLowerCase().includes('self-drive')) ? 'Self-Drive' : 'Perlu Driver',
      vehicle_preference: vehiclePref || 'Bebas',
      ic_number: icNumber || null,
      calendar_event_id: calendarId && calendarId !== '-' ? calendarId : null,
      admin_notes: adminNotes && adminNotes !== '-' ? adminNotes : null,
      conflict_reason: status === 'Conflict' ? (adminNotes || 'Pertindihan jadual') : null
    };

    bookingsToInsert.push(bookingRow);
  }

  console.log(`Inserting ${bookingsToInsert.length} bookings into Supabase...`);

  // Insert in batches of 25
  const batchSize = 25;
  for (let i = 0; i < bookingsToInsert.length; i += batchSize) {
    const batch = bookingsToInsert.slice(i, i + batchSize);
    const { data, error } = await supabase.from('bookings').insert(batch);
    if (error) {
      console.error(`Batch ${i / batchSize + 1} error:`, error.message);
    } else {
      console.log(`Batch ${i / batchSize + 1} inserted successfully (${batch.length} rows)`);
    }
  }

  console.log('Migration completed successfully!');
}

run().catch(console.error);
