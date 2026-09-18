import type { Booking, DriverSchedule, User, Vehicle } from '../types';
import { getPickupLocationDisplay } from '../utils';

export interface AutoAssignResult {
  status: 'Confirmed' | 'Conflict';
  driverId: string | null;
  vehicleId: string | null;
  calendarEventTitle: string;
  calendarColor: 'blue' | 'green' | 'grey' | 'purple' | 'amber' | 'teal';
  calendarEventId: string;
  adminNotes: string;
  conflictReason?: string;
  isPreWorkingHour?: boolean;
  warningNotes?: string;
  assignedDriverName?: string;
  assignedVehicleName?: string;
  newLastDriverAssignedId?: string;
  emailNotifications: {
    requester: {
      to: string;
      subject: string;
      body: string;
    };
    driver?: {
      to: string;
      subject: string;
      body: string;
    };
    admin?: {
      to: string;
      subject: string;
      body: string;
    };
  };
}

export interface BookingInput {
  requesterName: string;
  requesterEmail: string;
  department: string;
  bookingDate: string; // 'YYYY-MM-DD'
  startTime: string;   // 'HH:mm'
  endTime: string;     // 'HH:mm'
  purpose: string;
  destination: string;
  pickupPoint: string;
  address?: string;
  staffCount?: number;
  kidsCount?: number;
  teenagersCount?: number;
  serviceType: 'Perlu Driver' | 'Self-Drive';
  vehiclePreference?: string;
  shouldWait?: boolean;
  remarks?: string;
  icNumber?: string;
}

// Normalize helpers
const pad2 = (n: number) => String(n).padStart(2, '0');

export const normalizeDate = (raw: string | Date | undefined): string => {
  if (!raw) return '';
  if (raw instanceof Date) {
    return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`;
  }
  const rawStr = String(raw).trim();
  // Check if it's yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(rawStr)) {
    return rawStr.slice(0, 10);
  }
  // Check if it's dd/mm/yyyy or d/m/yyyy
  const dmyMatch = rawStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${pad2(Number(dmyMatch[2]))}-${pad2(Number(dmyMatch[1]))}`;
  }
  const d = new Date(rawStr);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return rawStr.slice(0, 10);
};

export const normalizeTime = (raw: string | Date | undefined): string => {
  if (!raw) return '00:00';
  if (raw instanceof Date) {
    return `${pad2(raw.getHours())}:${pad2(raw.getMinutes())}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':');
    return `${pad2(Number(h))}:${m}`;
  }
  const match = String(raw).match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return '00:00';
};

export const formatTime12H = (time24: string): string => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length >= 2) {
    let h = Number(parts[0]);
    const m = parts[1];
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m} ${ampm}`;
    }
  }
  return time24;
};

// Check if two time intervals overlap on the same day: [startA, endA] and [startB, endB]
export const isTimeOverlap = (startA: string, endA: string, startB: string, endB: string): boolean => {
  const sA = normalizeTime(startA);
  const eA = normalizeTime(endA);
  const sB = normalizeTime(startB);
  const eB = normalizeTime(endB);
  // Overlap if max(sA, sB) < min(eA, eB)
  return sA < eB && eA > sB;
};

// Get Driver color based on project rules
export const getDriverCalendarColor = (driverName: string = '', serviceType?: string): 'blue' | 'green' | 'grey' | 'purple' | 'amber' | 'teal' => {
  if (serviceType === 'Self-Drive') return 'grey';
  const name = driverName.toLowerCase();
  if (name.includes('syafiq')) return 'blue';
  if (name.includes('saiful')) return 'green';
  if (name.includes('aziz')) return 'teal';
  if (name.includes('john')) return 'purple';
  if (name.includes('jane')) return 'amber';
  return 'blue';
};

/**
 * Full Flow Engine based on FleetFlow Project Context
 */
export function evaluateBookingAssignment({
  booking,
  existingBookings,
  driverSchedules,
  users,
  vehicles,
  lastDriverAssignedId,
}: {
  booking: BookingInput;
  existingBookings: Booking[];
  driverSchedules: DriverSchedule[];
  users: User[];
  vehicles: Vehicle[];
  lastDriverAssignedId: string | null;
}): AutoAssignResult {
  const {
    requesterName,
    requesterEmail,
    department,
    bookingDate,
    startTime: rawStartTime,
    endTime: rawEndTime,
    purpose,
    destination,
    pickupPoint,
    address,
    staffCount = 0,
    kidsCount = 0,
    teenagersCount = 0,
    serviceType,
    vehiclePreference,
    shouldWait = false,
    remarks,
  } = booking;

  const startTime = normalizeTime(rawStartTime);
  let endTime = normalizeTime(rawEndTime);
  if (endTime <= startTime) {
    // Default finish time +2 hours if not specified or invalid
    const [h, m] = startTime.split(':').map(Number);
    endTime = `${pad2(Math.min(h + 2, 23))}:${pad2(m)}`;
  }

  const startTime12 = formatTime12H(startTime);
  const endTime12 = formatTime12H(endTime);

  const dateObj = new Date(bookingDate + 'T' + startTime);
  const dayOfWeek = isNaN(dateObj.getTime()) ? new Date().getDay() : dateObj.getDay();

  // Find Admin contact (Ain)
  const adminAin = users.find(u => u.role === 'admin' && u.name.toLowerCase().includes('ain')) ||
    users.find(u => u.role === 'admin') ||
    { name: 'Ain (Admin Transport)', email: 'ain@yck.org.my' };

  // ==========================================
  // STEP 3: CEK LUNCH BREAK DULU
  // ==========================================
  // Isnin–Khamis/Ahad: 12:00–13:00
  // Jumaat: 12:30–14:30
  // Exception: kalau booking start SEBELUM waktu rehat bermula, dibenarkan
  // Kalau clash → terus REJECT, tak proceed ke assignment
  const isFriday = dayOfWeek === 5;
  const lunchStart = isFriday ? '12:30' : '12:00';
  const lunchEnd = isFriday ? '14:30' : '13:00';

  const startsDuringLunch = startTime >= lunchStart && startTime < lunchEnd;

  if (startsDuringLunch) {
    const reason = `Waktu mula tempahan (${startTime12}) bertindih dengan waktu rehat ${isFriday ? 'Jumaat' : 'kakitangan'} (${formatTime12H(lunchStart)} - ${formatTime12H(lunchEnd)}).`;
    return {
      status: 'Conflict',
      driverId: null,
      vehicleId: null,
      calendarEventTitle: `[REJECT] ${requesterName} → ${destination} (Lunch Break Clash)`,
      calendarColor: 'grey',
      calendarEventId: `evt-clash-lunch-${Date.now()}`,
      conflictReason: reason,
      adminNotes: `REJECT (Step 3): ${reason}`,
      emailNotifications: {
        requester: {
          to: requesterEmail,
          subject: `[CONFLICT] Tempahan Van FleetFlow: ${destination} (${bookingDate})`,
          body: `Salam ${requesterName},\n\nTempahan anda ke ${destination} pada ${bookingDate} (${startTime12} - ${endTime12}) TIDAK DAPAT DISAHKAN kerana bertindih dengan waktu rehat rasmi (${formatTime12H(lunchStart)} - ${formatTime12H(lunchEnd)}).\n\nSila pilih masa sebelum ${formatTime12H(lunchStart)} atau selepas ${formatTime12H(lunchEnd)}, atau hubungi Admin (${adminAin.name} di ${adminAin.email}) untuk bantuan manual.\n\nTerima kasih,\nFleetFlow System`,
        },
        admin: {
          to: adminAin.email,
          subject: `[PERLU TINDAKAN MANUAL] Konflik Waktu Rehat: ${requesterName} - ${destination}`,
          body: `Perhatian Admin,\n\nTempahan baru dari ${requesterName} (${department}) ke ${destination} pada ${bookingDate} (${startTime12} - ${endTime12}) telah ditandakan sebagai CONFLICT kerana masa mula berada dalam waktu rehat (${formatTime12H(lunchStart)} - ${formatTime12H(lunchEnd)}).\n\nSila semak di dashboard untuk tindakan lanjut.`,
        },
      },
    };
  }

  // ==========================================
  // STEP 4: KALAU SELF-DRIVE
  // ==========================================
  // Check sama ada Perodua Alza free pada slot tu (check existing calendar events / bookings dengan tag [ALZA])
  // Free → confirm, create calendar event, warna grey, no driver assign
  // Tak free → CONFLICT
  if (serviceType === 'Self-Drive') {
    // Cari kenderaan Perodua Alza
    const alzaVehicle = vehicles.find(v => v.name.toLowerCase().includes('alza') || v.plateNumber.toLowerCase().includes('alza')) ||
      vehicles[0] ||
      { id: 'alza-1', name: 'Perodua Alza', plateNumber: 'VAA 8821' };

    // Check existing active bookings for this vehicle on this date
    const vehicleClash = existingBookings.find(b => {
      if (b.status === 'Cancelled') return false;
      const bDate = normalizeDate(b.dateTime);
      if (bDate !== bookingDate) return false;
      // Either assigned vehicle matches OR self-drive Alza
      const isSameVehicle = b.vehicleId === alzaVehicle.id || (b.serviceType === 'Self-Drive');
      if (!isSameVehicle) return false;

      const bStart = normalizeTime(b.dateTime);
      const bEnd = normalizeTime(b.finishDateTime || b.dateTime);
      return isTimeOverlap(startTime, endTime, bStart, bEnd);
    });

    if (vehicleClash) {
      const reason = `Kenderaan Perodua Alza telah ditempah oleh pemohon lain (${vehicleClash.requesterName}) pada slot masa ini (${startTime12} - ${endTime12}).`;
      return {
        status: 'Conflict',
        driverId: null,
        vehicleId: null,
        calendarEventTitle: `[CONFLICT] [ALZA] (SELF-DRIVE) ${requesterName} → ${destination}`,
        calendarColor: 'grey',
        calendarEventId: `evt-conflict-alza-${Date.now()}`,
        conflictReason: reason,
        adminNotes: `CONFLICT (Step 4): ${reason}`,
        emailNotifications: {
          requester: {
            to: requesterEmail,
            subject: `[CONFLICT] Tempahan Self-Drive Alza: ${destination} (${bookingDate})`,
            body: `Salam ${requesterName},\n\nTempahan Self-Drive anda ke ${destination} pada ${bookingDate} (${startTime12} - ${endTime12}) TIDAK DAPAT DISAHKAN kerana Perodua Alza telah ditempah pada slot ini.\n\nSila hubungi Admin (${adminAin.name} di ${adminAin.email}) untuk semakan kenderaan lain atau pertukaran masa.\n\nFleetFlow`,
          },
          admin: {
            to: adminAin.email,
            subject: `[PERLU TINDAKAN MANUAL] Alza Clash: Self-Drive ${requesterName}`,
            body: `Admin Ain,\n\nTempahan Self-Drive oleh ${requesterName} pada ${bookingDate} (${startTime12} - ${endTime12}) bertindih dengan tempahan Alza sedia ada.\nSila uruskan kenderaan alternatif jika ada.`,
          },
        },
      };
    }

    // Alza Free! Confirmed!
    const deptStr = department ? ` (${department})` : '';
    const calendarTitle = `[ALZA] (SELF-DRIVE) ${requesterName}${deptStr} → ${destination}`;
    return {
      status: 'Confirmed',
      driverId: null,
      vehicleId: alzaVehicle.id,
      assignedVehicleName: `${alzaVehicle.name} (${alzaVehicle.plateNumber})`,
      calendarEventTitle: calendarTitle,
      calendarColor: 'grey',
      calendarEventId: `evt-alza-${Date.now()}`,
      adminNotes: `CONFIRMED (Step 4): Self-Drive disahkan. Perodua Alza (${alzaVehicle.plateNumber}) diperuntukkan. Tiada pemandu ditugaskan.`,
      emailNotifications: {
        requester: {
          to: requesterEmail,
          subject: `[CONFIRMED] Tempahan Self-Drive Disahkan: ${destination}`,
          body: `Salam ${requesterName},\n\nTempahan Self-Drive anda BERJAYA DISAHKAN!\n\n📅 Tarikh: ${bookingDate}\n⏰ Masa: ${startTime12} - ${endTime12}\n📍 Lokasi Pickup: ${getPickupLocationDisplay(pickupPoint, address)}\n🎯 Destinasi: ${destination}\n🚗 Kenderaan: ${alzaVehicle.name} (${alzaVehicle.plateNumber})\n👤 Servis: Self-Drive\n\nSila ambil kunci kenderaan di pejabat pentadbiran sebelum bertolak.\n\nFleetFlow`,
        },
      },
    };
  }

  // ==========================================
  // STEP 5: KALAU PERLUKAN DRIVER — AUTO-ASSIGN LOGIC
  // ==========================================
  const activeDrivers = users.filter(u => u.role === 'driver' && u.status === 'active');

  // a. Tarik jadual driver dari tab Jadual Pemandu untuk tarikh tu
  const schedulesOnDate = driverSchedules.filter(s => normalizeDate(s.Date) === bookingDate);

  // Padankan driver aktif dengan jadual
  interface WorkingDriverInfo {
    driver: User;
    shiftStart: string;
    shiftEnd: string;
  }

  let workingDrivers: WorkingDriverInfo[] = activeDrivers
    .map(driver => {
      const sched = schedulesOnDate.find(s => s.DriverId === driver.id);
      if (!sched) return null;
      return {
        driver,
        shiftStart: normalizeTime(sched.Mula),
        shiftEnd: normalizeTime(sched.Tamat),
      };
    })
    .filter((w): w is WorkingDriverInfo => w !== null);

  // Sekiranya tiada driver berjadual dalam sistem pada tarikh ini:
  // Semak jika ada jadual langsung. Kalau tiada satu pun driver bekerja pada tarikh itu -> CONFLICT!
  if (workingDrivers.length === 0) {
    const reason = `Tiada pemandu bertugas pada tarikh ini (${bookingDate}).`;
    return {
      status: 'Conflict',
      driverId: null,
      vehicleId: null,
      calendarEventTitle: `[CONFLICT] ${requesterName} → ${destination} (Tiada Pemandu)`,
      calendarColor: 'grey',
      calendarEventId: `evt-no-driver-${Date.now()}`,
      conflictReason: reason,
      adminNotes: `CONFLICT (Step 6b): ${reason}`,
      emailNotifications: {
        requester: {
          to: requesterEmail,
          subject: `[CONFLICT] Tiada Pemandu Bertugas: ${destination} (${bookingDate})`,
          body: `Salam ${requesterName},\n\nTempahan anda ke ${destination} pada ${bookingDate} tidak dapat disahkan kerana tiada pemandu yang berjadual bertugas pada tarikh tersebut.\n\nSila hubungi Admin (${adminAin.name} di ${adminAin.email}) untuk semakan manual.\n\nFleetFlow`,
        },
        admin: {
          to: adminAin.email,
          subject: `[PERLU TINDAKAN MANUAL] Tiada Pemandu Bertugas: ${requesterName}`,
          body: `Admin Ain,\n\nTempahan dari ${requesterName} pada ${bookingDate} gagal di-assign kerana tiada jadual pemandu aktif untuk tarikh ini. Sila semak tab Jadual Pemandu.`,
        },
      },
    };
  }

  // b. Filter driver yang shift MEMANG dah start pada waktu booking tu (shift-eligibility check)
  // Kalau tiada driver yang shift dah start, fallback pakai driver paling awal punya shift
  let eligible = workingDrivers.filter(w => w.shiftStart <= startTime && w.shiftEnd > startTime);
  let isPreWorkingHour = false;

  if (eligible.length === 0) {
    // Cari driver yang shift paling awal
    const sortedByEarliestShift = [...workingDrivers].sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
    const earliestShiftTime = sortedByEarliestShift[0].shiftStart;

    if (startTime < earliestShiftTime) {
      isPreWorkingHour = true;
    }

    // Fallback pakai driver paling awal punya shift
    eligible = sortedByEarliestShift.filter(w => w.shiftStart === earliestShiftTime);
  }

  // c. Dari list eligible tu, check calendar — driver mana yang TAK ada booking lain clash dengan slot ni (isDriverBusy)
  const availableDrivers = eligible.filter(w => {
    const driverActiveBookings = existingBookings.filter(b => {
      if (b.status === 'Cancelled') return false;
      if (b.driverId !== w.driver.id) return false;
      if (normalizeDate(b.dateTime) !== bookingDate) return false;
      return true;
    });

    const hasClash = driverActiveBookings.some(b => {
      const bStart = normalizeTime(b.dateTime);
      const bEnd = normalizeTime(b.finishDateTime || b.dateTime);
      return isTimeOverlap(startTime, endTime, bStart, bEnd);
    });

    return !hasClash;
  });

  // d. Kalau tiada satu pun driver available → CONFLICT ("semua driver ada booking lain")
  if (availableDrivers.length === 0) {
    const reason = `Semua pemandu yang bertugas mempunyai tempahan lain pada slot masa ini (${startTime12} - ${endTime12}).`;
    return {
      status: 'Conflict',
      driverId: null,
      vehicleId: null,
      calendarEventTitle: `[CONFLICT] ${requesterName} → ${destination} (Semua Pemandu Sibuk)`,
      calendarColor: 'grey',
      calendarEventId: `evt-all-busy-${Date.now()}`,
      conflictReason: reason,
      adminNotes: `CONFLICT (Step 5d): ${reason}`,
      emailNotifications: {
        requester: {
          to: requesterEmail,
          subject: `[CONFLICT] Semua Pemandu Sibuk: ${destination} (${bookingDate})`,
          body: `Salam ${requesterName},\n\nSemua pemandu bertugas mempunyai jadual perjalanan lain pada slot ${startTime12} - ${endTime12} pada ${bookingDate}.\n\nPermohonan anda telah dihantar kepada Admin (${adminAin.name} di ${adminAin.email}) untuk penyelarasan manual.\n\nFleetFlow`,
        },
        admin: {
          to: adminAin.email,
          subject: `[PERLU TINDAKAN MANUAL] Pertindihan Tempahan Pemandu: ${requesterName}`,
          body: `Admin Ain,\n\nSemua pemandu bertugas pada ${bookingDate} (${startTime12} - ${endTime12}) sibuk dengan tempahan sedia ada. Sila semak jadual untuk membuat penyesuaian atau carpooling.`,
        },
      },
    };
  }

  // e. Kalau ada lebih dari satu driver available:
  // - Kalau booking sebelum waktu kerja semua driver (pre-working-hour) → pilih driver yang shift paling awal, round-robin di-ignore
  // - Kalau dalam waktu kerja normal → round-robin: check driver terakhir yang dapat assignment (Last Driver Assigned), pilih driver lain (bukan yang last tu) dari list available
  let chosen: WorkingDriverInfo;

  if (isPreWorkingHour) {
    // Pilih driver yang shift paling awal, round-robin di-ignore
    availableDrivers.sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
    chosen = availableDrivers[0];
  } else {
    // Normal working hours: round-robin check
    if (availableDrivers.length === 1) {
      chosen = availableDrivers[0];
    } else {
      // Pilih driver yang bukan lastDriverAssignedId
      const otherDrivers = availableDrivers.filter(w => w.driver.id !== lastDriverAssignedId);
      if (otherDrivers.length > 0) {
        chosen = otherDrivers[0];
      } else {
        chosen = availableDrivers[0];
      }
    }
  }

  // Peruntukkan kenderaan (Vehicle Allocation)
  // Syarat: Jika pemohon pilih Bebas/tiada keutamaan, sistem jangan assign kenderaan (biarkan null).
  // Kenderaan akan diambil daripada rekod lapor meter pemandu apabila selesai tugasan.
  let allocatedVehicle: Vehicle | null = null;
  const isFreeChoice = !vehiclePreference || vehiclePreference === 'Bebas';

  if (!isFreeChoice) {
    const preferred = vehicles.find(v => v.name === vehiclePreference);
    if (preferred) {
      const clash = existingBookings.find(b => {
        if (b.status === 'Cancelled') return false;
        if (b.vehicleId !== preferred.id) return false;
        if (normalizeDate(b.dateTime) !== bookingDate) return false;
        return isTimeOverlap(startTime, endTime, normalizeTime(b.dateTime), normalizeTime(b.finishDateTime || b.dateTime));
      });
      if (!clash) {
        allocatedVehicle = preferred;
      }
    }
  }

  // STEP 7: Google Calendar Event formatting
  // Title format: (NamaDriver) Pemohon (Jabatan) → Destinasi
  const deptStr = department ? ` (${department})` : '';
  const calendarEventTitle = `(${chosen.driver.name}) ${requesterName}${deptStr} → ${destination}`;
  const calendarColor = getDriverCalendarColor(chosen.driver.name);

  const preWorkingWarning = isPreWorkingHour
    ? '⚠️ PERHATIAN: Booking sebelum waktu kerja pemandu bermula. Sila buat pengesahan manual dengan pemandu & Head of Transportation.'
    : '';

  const vehicleNotice = allocatedVehicle
    ? `Kenderaan: ${allocatedVehicle.name} (${allocatedVehicle.plateNumber}).`
    : `Kenderaan: Bebas (Belum di-assign. Pemandu akan pilih kenderaan semasa lapor meter/selesai trip).`;

  const adminNotes = isPreWorkingHour
    ? `CONFIRMED (Pre-working-hour): Auto-assigned kepada ${chosen.driver.name} (Shift paling awal mula: ${formatTime12H(chosen.shiftStart)}). ${preWorkingWarning}`
    : `CONFIRMED: Auto-assigned kepada ${chosen.driver.name} melalui kaedah ${availableDrivers.length > 1 ? 'Round-Robin' : 'Pemandu Tunggal Berkelayakan'}. ${vehicleNotice}`;

  const totalPassengers = staffCount + kidsCount + teenagersCount;
  const passengerDetails = [
    staffCount > 0 ? `Staff: ${staffCount}` : '',
    kidsCount > 0 ? `Kanak-kanak: ${kidsCount}` : '',
    teenagersCount > 0 ? `Remaja: ${teenagersCount}` : '',
  ].filter(Boolean).join(', ') || 'Tiada maklumat';

  const vehicleDisplay = allocatedVehicle
    ? `${allocatedVehicle.name} (${allocatedVehicle.plateNumber})`
    : `Bebas (Akan ditentukan oleh pemandu semasa perjalanan)`;

  return {
    status: 'Confirmed',
    driverId: chosen.driver.id,
    vehicleId: allocatedVehicle ? allocatedVehicle.id : null,
    assignedDriverName: chosen.driver.name,
    assignedVehicleName: allocatedVehicle ? `${allocatedVehicle.name} (${allocatedVehicle.plateNumber})` : undefined,
    calendarEventTitle,
    calendarColor,
    calendarEventId: `evt-${chosen.driver.id}-${Date.now()}`,
    adminNotes,
    isPreWorkingHour,
    warningNotes: preWorkingWarning || undefined,
    newLastDriverAssignedId: chosen.driver.id,
    emailNotifications: {
      requester: {
        to: requesterEmail,
        subject: `[CONFIRMED] Tempahan Pengangkutan Disahkan: ${destination}`,
        body: `Salam ${requesterName},\n\nTempahan pengangkutan anda telah BERJAYA DISAHKAN!\n\n📅 Tarikh: ${bookingDate}\n⏰ Masa: ${startTime12} - ${endTime12}\n📍 Lokasi Pickup: ${getPickupLocationDisplay(pickupPoint, address)}\n🎯 Destinasi: ${destination}\n👥 Penumpang: ${totalPassengers} orang (${passengerDetails})\n👤 Pemandu Ditugaskan: ${chosen.driver.name} (No Tel: ${chosen.driver.phone})\n🚐 Kenderaan: ${vehicleDisplay}\n${shouldWait ? '⏳ Status: Pemandu dikehendaki menunggu di destinasi\n' : ''}${remarks ? '📝 Nota: ' + remarks + '\n' : ''}${isPreWorkingHour ? '\n' + preWorkingWarning + '\n' : ''}\nEvent telah dimasukkan ke dalam Google Calendar YCK dan emel anda dijemput sebagai tetamu.\n\nFleetFlow`,
      },
      driver: {
        to: chosen.driver.email,
        subject: `[TUGASAN BARU] Perjalanan ke ${destination} (${bookingDate})`,
        body: `Salam ${chosen.driver.name},\n\nAnda telah ditugaskan untuk perjalanan berikut:\n\n📅 Tarikh: ${bookingDate}\n⏰ Masa: ${startTime12} - ${endTime12}\n👤 Pemohon: ${requesterName} (${department})\n📞 Emel Pemohon: ${requesterEmail}\n📍 Pickup: ${getPickupLocationDisplay(pickupPoint, address)}\n🎯 Destinasi: ${destination}\n👥 Bilangan Penumpang: ${totalPassengers} (${passengerDetails})\n🚐 Kenderaan: ${vehicleDisplay}\n${shouldWait ? '⏳ Perlu Tunggu: YA (Sila tunggu penumpang sehingga urusan selesai)\n' : ''}${remarks ? '📝 Nota: ' + remarks : ''}\n${isPreWorkingHour ? '\n' + preWorkingWarning : ''}\n\nSila pastikan kenderaan berada dalam keadaan baik sebelum bertolak.\n\nFleetFlow`,
      },
    },
  };
}
