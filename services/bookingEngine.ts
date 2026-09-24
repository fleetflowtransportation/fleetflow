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
    const reason = `Booking start time (${startTime12}) overlaps with official ${isFriday ? 'Friday ' : ''}lunch break (${formatTime12H(lunchStart)} - ${formatTime12H(lunchEnd)}).`;
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
          subject: `[CONFLICT] FleetFlow Vehicle Booking: ${destination} (${bookingDate})`,
          body: `Hello ${requesterName},\n\nYour booking request to ${destination} on ${bookingDate} (${startTime12} - ${endTime12}) COULD NOT BE CONFIRMED because it overlaps with the official break time (${formatTime12H(lunchStart)} - ${formatTime12H(lunchEnd)}).\n\nPlease choose a start time before ${formatTime12H(lunchStart)} or after ${formatTime12H(lunchEnd)}, or contact the Admin team (${adminAin.name} at ${adminAin.email}) for manual assistance.\n\nThank you,\nFleetFlow System`,
        },
        admin: {
          to: adminAin.email,
          subject: `[MANUAL ACTION REQUIRED] Break Time Conflict: ${requesterName} - ${destination}`,
          body: `Attention Admin,\n\nA new booking request from ${requesterName} (${department}) to ${destination} on ${bookingDate} (${startTime12} - ${endTime12}) has been flagged as a CONFLICT due to start time falling within lunch break hours (${formatTime12H(lunchStart)} - ${formatTime12H(lunchEnd)}).\n\nPlease review on the dashboard for manual action.`,
        },
      },
    };
  }

  // ==========================================
  // STEP 4: IF SELF-DRIVE
  // ==========================================
  // Check if Perodua Alza is free during this slot
  if (serviceType === 'Self-Drive') {
    // Find Perodua Alza vehicle
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
      const reason = `The Perodua Alza vehicle is already booked by another requester (${vehicleClash.requesterName}) during this time slot (${startTime12} - ${endTime12}).`;
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
            subject: `[CONFLICT] Self-Drive Booking: ${destination} (${bookingDate})`,
            body: `Hello ${requesterName},\n\nYour Self-Drive booking request to ${destination} on ${bookingDate} (${startTime12} - ${endTime12}) COULD NOT BE CONFIRMED because the Perodua Alza is already booked during this time slot.\n\nPlease contact Admin (${adminAin.name} at ${adminAin.email}) for an alternative vehicle or to reschedule.\n\nFleetFlow`,
          },
          admin: {
            to: adminAin.email,
            subject: `[MANUAL ACTION REQUIRED] Self-Drive Conflict: ${requesterName}`,
            body: `Admin,\n\nSelf-Drive booking request by ${requesterName} on ${bookingDate} (${startTime12} - ${endTime12}) conflicts with an existing reservation.\nPlease coordinate an alternative vehicle if available.`,
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
      adminNotes: `CONFIRMED: Self-Drive reservation confirmed. Perodua Alza (${alzaVehicle.plateNumber}) allocated. No driver required.`,
      emailNotifications: {
        requester: {
          to: requesterEmail,
          subject: `[CONFIRMED] Self-Drive Booking Confirmed: ${destination}`,
          body: `Hello ${requesterName},\n\nYour Self-Drive reservation has been SUCCESSFULLY CONFIRMED!\n\n📅 Date: ${bookingDate}\n⏰ Time: ${startTime12} - ${endTime12}\n📍 Pickup Location: ${getPickupLocationDisplay(pickupPoint, address)}\n🎯 Destination: ${destination}\n🚗 Vehicle: ${alzaVehicle.name} (${alzaVehicle.plateNumber})\n👤 Service: Self-Drive\n\nPlease collect the vehicle keys from the administration office prior to departure.\n\nFleetFlow`,
        },
      },
    };
  }

  // ==========================================
  // STEP 5: IF DRIVER NEEDED — AUTO-ASSIGN LOGIC
  // ==========================================
  const activeDrivers = users.filter(u => u.role === 'driver' && u.status === 'active');

  // Pull driver schedules for date
  const schedulesOnDate = driverSchedules.filter(s => normalizeDate(s.Date) === bookingDate);

  // Match active drivers with schedules
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

  // If no drivers on duty on this date
  if (workingDrivers.length === 0) {
    const reason = `No active drivers are scheduled on duty for this date (${bookingDate}).`;
    return {
      status: 'Conflict',
      driverId: null,
      vehicleId: null,
      calendarEventTitle: `[CONFLICT] ${requesterName} → ${destination} (No Driver Scheduled)`,
      calendarColor: 'grey',
      calendarEventId: `evt-no-driver-${Date.now()}`,
      conflictReason: reason,
      adminNotes: `CONFLICT: ${reason}`,
      emailNotifications: {
        requester: {
          to: requesterEmail,
          subject: `[CONFLICT] No Driver On Duty: ${destination} (${bookingDate})`,
          body: `Hello ${requesterName},\n\nYour booking request to ${destination} on ${bookingDate} could not be confirmed because no drivers are scheduled on duty for that date.\n\nPlease contact Admin (${adminAin.name} at ${adminAin.email}) for manual assistance.\n\nFleetFlow`,
        },
        admin: {
          to: adminAin.email,
          subject: `[MANUAL ACTION REQUIRED] No Driver Scheduled: ${requesterName}`,
          body: `Admin,\n\nBooking request from ${requesterName} on ${bookingDate} could not be auto-assigned because there are no active driver duty schedules for this date. Please check the Driver Schedules tab.`,
        },
      },
    };
  }

  // b. Filter drivers whose shift has started
  let eligible = workingDrivers.filter(w => w.shiftStart <= startTime && w.shiftEnd > startTime);
  let isPreWorkingHour = false;

  if (eligible.length === 0) {
    const sortedByEarliestShift = [...workingDrivers].sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
    const earliestShiftTime = sortedByEarliestShift[0].shiftStart;

    if (startTime < earliestShiftTime) {
      isPreWorkingHour = true;
    }

    eligible = sortedByEarliestShift.filter(w => w.shiftStart === earliestShiftTime);
  }

  // c. Check calendar for available drivers without clash
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

  // d. If no drivers available
  if (availableDrivers.length === 0) {
    const reason = `All on-duty drivers have conflicting bookings during this time slot (${startTime12} - ${endTime12}).`;
    return {
      status: 'Conflict',
      driverId: null,
      vehicleId: null,
      calendarEventTitle: `[CONFLICT] ${requesterName} → ${destination} (All Drivers Busy)`,
      calendarColor: 'grey',
      calendarEventId: `evt-all-busy-${Date.now()}`,
      conflictReason: reason,
      adminNotes: `CONFLICT: ${reason}`,
      emailNotifications: {
        requester: {
          to: requesterEmail,
          subject: `[CONFLICT] All Drivers Busy: ${destination} (${bookingDate})`,
          body: `Hello ${requesterName},\n\nAll on-duty drivers are already assigned to other trips during ${startTime12} - ${endTime12} on ${bookingDate}.\n\nYour request has been forwarded to the Admin (${adminAin.name} at ${adminAin.email}) for manual review and carpooling coordination.\n\nFleetFlow`,
        },
        admin: {
          to: adminAin.email,
          subject: `[MANUAL ACTION REQUIRED] Driver Schedule Conflict: ${requesterName}`,
          body: `Admin,\n\nAll drivers on duty for ${bookingDate} (${startTime12} - ${endTime12}) are fully booked with existing trips. Please review the schedule for manual reassignment or carpooling opportunities.`,
        },
      },
    };
  }

  // e. Choose driver
  let chosen: WorkingDriverInfo;

  if (isPreWorkingHour) {
    availableDrivers.sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
    chosen = availableDrivers[0];
  } else {
    if (availableDrivers.length === 1) {
      chosen = availableDrivers[0];
    } else {
      const otherDrivers = availableDrivers.filter(w => w.driver.id !== lastDriverAssignedId);
      if (otherDrivers.length > 0) {
        chosen = otherDrivers[0];
      } else {
        chosen = availableDrivers[0];
      }
    }
  }

  // Vehicle Allocation
  let allocatedVehicle: Vehicle | null = null;
  const isFreeChoice = !vehiclePreference || vehiclePreference === 'Bebas' || vehiclePreference === 'Any / No Preference';

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

  // Google Calendar Event formatting
  const deptStr = department ? ` (${department})` : '';
  const calendarEventTitle = `(${chosen.driver.name}) ${requesterName}${deptStr} → ${destination}`;
  const calendarColor = getDriverCalendarColor(chosen.driver.name);

  const preWorkingWarning = isPreWorkingHour
    ? '⚠️ ATTENTION: Booking starts before official driver working hours. Please confirm manually with the on-duty driver and Head of Transportation.'
    : '';

  const vehicleNotice = allocatedVehicle
    ? `Vehicle: ${allocatedVehicle.name} (${allocatedVehicle.plateNumber}).`
    : `Vehicle: Any / Unassigned (Driver will select vehicle upon odometer check-in).`;

  const adminNotes = isPreWorkingHour
    ? `CONFIRMED (Pre-working-hour): Auto-assigned to ${chosen.driver.name} (Earliest shift starts at: ${formatTime12H(chosen.shiftStart)}). ${preWorkingWarning}`
    : `CONFIRMED: Auto-assigned to ${chosen.driver.name} via ${availableDrivers.length > 1 ? 'Round-Robin' : 'Single Eligible Driver'}. ${vehicleNotice}`;

  const totalPassengers = staffCount + kidsCount + teenagersCount;
  const passengerDetails = [
    staffCount > 0 ? `Staff: ${staffCount}` : '',
    kidsCount > 0 ? `Children: ${kidsCount}` : '',
    teenagersCount > 0 ? `Teenagers: ${teenagersCount}` : '',
  ].filter(Boolean).join(', ') || 'No breakdown';

  const vehicleDisplay = allocatedVehicle
    ? `${allocatedVehicle.name} (${allocatedVehicle.plateNumber})`
    : `Any / Unassigned (Driver will select upon trip check-in)`;

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
        subject: `[CONFIRMED] Transportation Booking Confirmed: ${destination}`,
        body: `Hello ${requesterName},\n\nYour transportation booking has been SUCCESSFULLY CONFIRMED!\n\n📅 Date: ${bookingDate}\n⏰ Time: ${startTime12} - ${endTime12}\n📍 Pickup Location: ${getPickupLocationDisplay(pickupPoint, address)}\n🎯 Destination: ${destination}\n👥 Passengers: ${totalPassengers} (${passengerDetails})\n👤 Assigned Driver: ${chosen.driver.name} (Phone: ${chosen.driver.phone})\n🚐 Vehicle: ${vehicleDisplay}\n${shouldWait ? '⏳ Driver Waiting: YES (Driver will wait at destination)\n' : ''}${remarks ? '📝 Notes: ' + remarks + '\n' : ''}${isPreWorkingHour ? '\n' + preWorkingWarning + '\n' : ''}\nThe event has been added to Google Calendar and your email is invited as a guest.\n\nFleetFlow`,
      },
      driver: {
        to: chosen.driver.email,
        subject: `[NEW ASSIGNMENT] Trip to ${destination} (${bookingDate})`,
        body: `Hello ${chosen.driver.name},\n\nYou have been assigned to the following trip:\n\n📅 Date: ${bookingDate}\n⏰ Time: ${startTime12} - ${endTime12}\n👤 Requester: ${requesterName} (${department})\n📞 Requester Email: ${requesterEmail}\n📍 Pickup: ${getPickupLocationDisplay(pickupPoint, address)}\n🎯 Destination: ${destination}\n👥 Passengers: ${totalPassengers} (${passengerDetails})\n🚐 Vehicle: ${vehicleDisplay}\n${shouldWait ? '⏳ Driver Waiting: YES (Please wait for passengers until completion)\n' : ''}${remarks ? '📝 Notes: ' + remarks : ''}\n${isPreWorkingHour ? '\n' + preWorkingWarning : ''}\n\nPlease ensure the vehicle is inspected and ready before departure.\n\nFleetFlow`,
      },
    },
  };
}
