import { formatInTimeZone } from "date-fns-tz";
import { getActiveServices } from "@/lib/db/queries/services";
import { getClosuresInRange } from "@/lib/db/queries/availability";
import { BANGKOK_TZ } from "@/lib/datetime";
import { ADVANCE_BOOKING_DAYS } from "@/lib/booking-rules";
import { BookingFlow } from "./_components/booking-flow";

// Skip static prerender — booking page ต้อง render at request time
// เพราะ services/วันปิดจาก D1 = mutable + ?service query param = dynamic
export const dynamic = "force-dynamic";

/** วันนี้ + ADVANCE_BOOKING_DAYS (รวมวันนี้) */
const CALENDAR_DAYS = ADVANCE_BOOKING_DAYS + 1;

type PageProps = {
  searchParams: Promise<{ service?: string }>;
};

export default async function BookPage({ searchParams }: PageProps) {
  const today = formatInTimeZone(new Date(), BANGKOK_TZ, "yyyy-MM-dd");

  const [services, closures] = await Promise.all([
    getActiveServices(),
    getClosuresInRange(today, CALENDAR_DAYS),
  ]);

  const params = await searchParams;
  const preselectedId = params.service ? Number(params.service) : null;
  const validPreselected =
    preselectedId && services.some((s) => s.id === preselectedId)
      ? preselectedId
      : null;

  return (
    <div className="mx-auto max-w-4xl px-[clamp(1.5rem,5vw,6rem)] py-16 md:py-24">
      <div className="mb-12 text-center">
        <div className="text-sm font-medium uppercase tracking-[0.32em] text-primary md:text-base">
          Book Your Journey
        </div>
        <h1 className="mt-5 font-serif text-4xl font-medium leading-[1.55] tracking-wide text-foreground md:text-5xl">
          จองบริการ
        </h1>
        <div className="mx-auto mt-8 h-px w-10 bg-primary" />
      </div>

      <BookingFlow
        services={services}
        preselectedServiceId={validPreselected}
        closedDates={Object.keys(closures)}
      />
    </div>
  );
}
