import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { bookingCreateSchema } from "@/lib/validations";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createBooking, BookingError } from "@/lib/db/queries/bookings";
import { sendBookingNotification } from "@/lib/line";
import { toBangkokIsoString } from "@/lib/datetime";

/**
 * POST /api/bookings
 *
 * Public endpoint — customer creates a booking.
 *
 * Flow:
 *   1. Parse JSON body
 *   2. Zod validate
 *   3. Verify Turnstile token
 *   4. Call createBooking() — throws BookingError on business errors
 *   5. Fire-and-forget LINE notification to shop owner
 *   6. Return 201 with booking code
 *
 * Error responses:
 *   400 - Validation failed / Turnstile invalid
 *   404 - Service not found or inactive
 *   409 - Slot already booked (race condition)
 *   422 - Past date / beyond advance limit
 *   500 - Unexpected server error
 */
export async function POST(request: Request) {
  // Step 1: Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Step 2: Zod validate
  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Step 3: Verify Turnstile
  const { env } = await getCloudflareContext({ async: true });
  const clientIp = request.headers.get("cf-connecting-ip") ?? undefined;

  const turnstileValid = await verifyTurnstileToken(
    input.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    clientIp,
  );

  if (!turnstileValid) {
    return NextResponse.json(
      { error: "Turnstile verification failed" },
      { status: 400 },
    );
  }

  // Step 4: Create booking
  let result: Awaited<ReturnType<typeof createBooking>>;
  try {
    result = await createBooking({
      serviceId: input.serviceId,
      date: input.date,
      time: input.time,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      notes: input.notes,
    });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: mapBookingErrorStatus(err.code) },
      );
    }
    console.error("[POST /api/bookings] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // Step 5: Fire-and-forget LINE notification
  sendBookingNotification(
    env.LINE_CHANNEL_ACCESS_TOKEN,
    env.LINE_OWNER_USER_ID,
    {
      code: result.booking.code,
      customerName: result.booking.customerName,
      customerPhone: result.booking.customerPhone,
      serviceName: result.serviceName,
      startsAt: result.booking.startsAt,
      durationMin: result.booking.durationMin,
      price: result.booking.price,
    },
  ).catch((err) => {
    console.error("[LINE push failed]", {
      code: result.booking.code,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // Step 6: Return success
  return NextResponse.json(
    {
      code: result.booking.code,
      serviceName: result.serviceName,
      startsAt: toBangkokIsoString(result.booking.startsAt),
      endsAt: toBangkokIsoString(result.booking.endsAt),
      price: result.booking.price,
      customerName: result.booking.customerName,
      customerPhone: result.booking.customerPhone,
      status: result.booking.status,
    },
    { status: 201 },
  );
}

function mapBookingErrorStatus(code: BookingError["code"]): number {
  switch (code) {
    case "SERVICE_NOT_FOUND":
      return 404;
    case "SLOT_CONFLICT":
      return 409;
    case "PAST_DATE":
    case "BEYOND_ADVANCE_LIMIT":
      return 422;
    case "CODE_GENERATION_FAILED":
      return 500;
  }
}
