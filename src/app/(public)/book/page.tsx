import { getActiveServices } from "@/lib/db/queries/services";
import { BookingFlow } from "./_components/booking-flow";

type PageProps = {
  searchParams: Promise<{ service?: string }>;
};

export default async function BookPage({ searchParams }: PageProps) {
  const services = await getActiveServices();
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
      />
    </div>
  );
}
