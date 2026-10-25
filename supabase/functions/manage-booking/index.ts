import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const malaysiaNowString = () =>
  new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19);

const bookingStart = (booking: Record<string, any>) => {
  const raw = booking.date_time || (
    booking.start_date && booking.start_time ? `${booking.start_date}T${booking.start_time}:00` : ""
  );
  if (!raw) return null;
  const hasZone = /(?:Z|[+-]\d\d:\d\d)$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isPastStart = (booking: Record<string, any>) => {
  const start = bookingStart(booking);
  return !start || Date.now() >= start.getTime();
};

const unavailable = (booking: Record<string, any>) =>
  booking.status === "Completed" || isPastStart(booking);

const toPublicBooking = (row: Record<string, any>) => ({
  id: row.id,
  tenantId: row.tenant_id,
  status: row.status,
  dateTime: row.date_time || (
    row.start_date && row.start_time ? `${row.start_date}T${row.start_time}:00` : ""
  ),
  finishDateTime: row.finish_date_time || (
    row.end_date && row.end_time ? `${row.end_date}T${row.end_time}:00` : undefined
  ),
  destination: row.destination || "",
  stops: Array.isArray(row.stops) && row.stops.length
    ? row.stops
    : (row.destination ? [{ id: "legacy-stop", sequence: 1, name: row.destination, address: row.destination }] : []),
  purpose: row.purpose || "",
  requesterName: row.requester_name || "",
  requesterEmail: row.requester_email || "",
  department: row.department || "",
  pickupPoint: row.pickup_point || "",
  address: row.address || "",
  serviceType: row.service_type || "Perlu Driver",
  driverId: row.driver_id || null,
  vehicleId: row.vehicle_id || null,
  calendarEventId: row.calendar_event_id || row.google_calendar_event_id || undefined,
  calendarEventTitle: row.calendar_event_title || undefined,
  calendarColor: row.calendar_color || undefined,
  passengers: row.passengers || [],
  shouldWait: row.should_wait === true,
  remarks: row.remarks || "",
});

const getBookingForToken = async (token: string, tenantId: string) => {
  if (!token || token.length < 32 || !tenantId) return { error: "Invalid management link.", status: 404 };
  const tokenHash = await hashToken(token);
  const { data: tokenRow, error: tokenError } = await supabase
    .from("booking_manage_tokens")
    .select("booking_id, tenant_id, revoked_at")
    .eq("token_hash", tokenHash)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (tokenError || !tokenRow || tokenRow.revoked_at) {
    return { error: "This management link is invalid or no longer available.", status: 404 };
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", tokenRow.booking_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (bookingError || !booking) return { error: "Booking not found.", status: 404 };
  await supabase.from("booking_manage_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  if (unavailable(booking)) {
    return { error: "This booking can no longer be managed because it has started or is completed.", status: 410 };
  }

  return { booking, tokenHash };
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await request.json();
    const action = String(body?.action || "");
    const tenantId = String(body?.tenantId || "").trim();

    if (!tenantId) return json({ error: "Missing tenant." }, 400);

    if (action === "create") {
      // Create the booking and its secret management token together on the server.
      // This prevents anonymous callers from minting a management token for someone else's known Booking ID.
      const input = body?.booking;
      if (!input || typeof input !== "object") return json({ error: "Missing booking details." }, 400);
      const bookingId = String(input.id || "").trim();
      const requesterName = String(input.requesterName || "").trim().slice(0, 200);
      const requesterEmail = String(input.requesterEmail || "").trim().slice(0, 320);
      const dateTime = String(input.dateTime || "").trim();
      const finishDateTime = String(input.finishDateTime || "").trim();
      const destination = String(input.destination || "").trim().slice(0, 3000);
      if (!bookingId || !requesterName || !requesterEmail.includes("@") || !dateTime || !destination) {
        return json({ error: "Required booking details are missing or invalid." }, 400);
      }
      const proposed = { date_time: dateTime, start_date: dateTime.slice(0, 10), start_time: dateTime.includes("T") ? dateTime.split("T")[1].slice(0, 5) : "" };
      if (isPastStart(proposed)) return json({ error: "Booking start time must be in the future." }, 400);

      const status = ["Pending", "Assigned", "Confirmed"].includes(String(input.status)) ? String(input.status) : "Pending";
      const stops = Array.isArray(input.stops) ? input.stops.slice(0, 5).map((stop: Record<string, any>, index: number) => ({
        id: String(stop.id || crypto.randomUUID()).slice(0, 100),
        sequence: index + 1,
        name: String(stop.name || "").trim().slice(0, 160),
        address: String(stop.address || "").trim().slice(0, 1000),
        notes: String(stop.notes || "").trim().slice(0, 500) || undefined,
      })) : [];

      const dbRow: Record<string, any> = {
        id: bookingId,
        tenant_id: tenantId,
        requester_name: requesterName,
        requester_email: requesterEmail,
        department: String(input.department || "").slice(0, 160),
        purpose: String(input.purpose || "").slice(0, 1000),
        destination,
        stops,
        date_time: dateTime,
        finish_date_time: finishDateTime || null,
        start_date: dateTime.slice(0, 10),
        start_time: dateTime.includes("T") ? dateTime.split("T")[1].slice(0, 5) : "",
        end_date: finishDateTime ? finishDateTime.slice(0, 10) : dateTime.slice(0, 10),
        end_time: finishDateTime && finishDateTime.includes("T") ? finishDateTime.split("T")[1].slice(0, 5) : "",
        pickup_point: String(input.pickupPoint || "").slice(0, 300),
        address: String(input.address || "").slice(0, 1000),
        passengers: Array.isArray(input.passengers) ? input.passengers : [],
        should_wait: input.shouldWait === true,
        status,
        driver_id: input.driverId || null,
        vehicle_id: input.vehicleId || null,
        service_type: input.serviceType === "Self-Drive" ? "Self-Drive" : "Perlu Driver",
        vehicle_preference: input.vehiclePreference || null,
        ic_number: input.icNumber || null,
        remarks: String(input.remarks || "").slice(0, 2000),
        calendar_event_title: input.calendarEventTitle || null,
        calendar_color: input.calendarColor || null,
        admin_notes: input.adminNotes || null,
        conflict_reason: input.conflictReason || null,
        is_pre_working_hour: input.isPreWorkingHour === true,
        warning_notes: input.warningNotes || null,
      };

      const { data: created, error: createError } = await supabase
        .from("bookings")
        .insert(dbRow)
        .select("*")
        .single();
      if (createError || !created) {
        console.error("[manage-booking] booking insert failed", createError);
        return json({ error: "Unable to save the booking. Please try again." }, 500);
      }

      const token = randomToken();
      const tokenHash = await hashToken(token);
      const { error: tokenError } = await supabase.from("booking_manage_tokens").insert({
        booking_id: bookingId,
        tenant_id: tenantId,
        token_hash: tokenHash,
      });
      if (tokenError) {
        await supabase.from("bookings").delete().eq("id", bookingId).eq("tenant_id", tenantId);
        console.error("[manage-booking] token insert failed", tokenError);
        return json({ error: "Unable to create a secure management link. The booking was not retained; please try again." }, 500);
      }

      return json({ token, booking: toPublicBooking(created) });
    }

    // There is deliberately no public "issue token for existing booking" action.
    const token = String(body?.token || "");
    const resolved = await getBookingForToken(token, tenantId);
    if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

    const booking = resolved.booking as Record<string, any>;
    const tokenHash = resolved.tokenHash as string;

    if (action === "get") {
      const canManage = booking.status !== "Cancelled";
      return json({ booking: toPublicBooking(booking), canManage });
    }

    if (booking.status === "Cancelled") {
      return json({ error: "This booking has already been cancelled." }, 409);
    }

    if (action === "update") {
      const incoming = body?.stops;
      if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 5) {
        return json({ error: "A route must contain between 1 and 5 stops." }, 400);
      }

      const stops = incoming.map((stop: Record<string, any>, index: number) => ({
        id: typeof stop.id === "string" && stop.id ? stop.id.slice(0, 100) : crypto.randomUUID(),
        sequence: index + 1,
        name: String(stop.name || "").trim().slice(0, 160),
        address: String(stop.address || "").trim().slice(0, 1000),
        notes: String(stop.notes || "").trim().slice(0, 500) || undefined,
      }));

      if (stops.some((stop: { address: string }) => !stop.address)) {
        return json({ error: "Every stop must have a full address." }, 400);
      }

      const destination = stops.map((stop: { name: string; address: string }) => stop.name || stop.address).join(" → ");
      const nowLocal = malaysiaNowString();
      const { data: updated, error } = await supabase
        .from("bookings")
        .update({ stops, destination })
        .eq("id", booking.id)
        .eq("tenant_id", tenantId)
        .eq("status", booking.status)
        .gt("date_time", nowLocal)
        .select("*")
        .maybeSingle();

      if (error || !updated) return json({ error: "The booking may have started or changed. Refresh and try again." }, 409);

      await supabase.from("booking_manage_activity_logs").insert({
        booking_id: booking.id,
        tenant_id: tenantId,
        action: "updated_route",
        changes: { before: { destination: booking.destination, stops: booking.stops }, after: { destination, stops } },
      });

      return json({ booking: toPublicBooking(updated), canManage: true });
    }

    if (action === "cancel") {
      const reason = String(body?.reason || "").trim().slice(0, 500);
      if (!reason) return json({ error: "Please provide a cancellation reason." }, 400);

      const nowLocal = malaysiaNowString();
      const { data: updated, error } = await supabase
        .from("bookings")
        .update({ status: "Cancelled", cancellation_reason: reason })
        .eq("id", booking.id)
        .eq("tenant_id", tenantId)
        .eq("status", booking.status)
        .gt("date_time", nowLocal)
        .select("*")
        .maybeSingle();

      if (error || !updated) return json({ error: "The booking may have started or changed and could not be cancelled." }, 409);

      await supabase.from("booking_manage_activity_logs").insert({
        booking_id: booking.id,
        tenant_id: tenantId,
        action: "cancelled",
        reason,
        changes: { beforeStatus: booking.status, afterStatus: "Cancelled" },
      });

      return json({ booking: toPublicBooking(updated), cancelled: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("[manage-booking] unexpected error", error);
    return json({ error: "Unexpected error while managing this booking." }, 500);
  }
});
