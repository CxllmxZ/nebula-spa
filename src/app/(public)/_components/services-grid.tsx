import Link from "next/link";
import { SectionEyebrow, GoldDivider } from "./section-eyebrow";

type Service = {
  id: number;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
};

export function ServicesGrid({ services }: { services: Service[] }) {
  return (
    <section
      id="services"
      className="relative bg-background px-[clamp(1.5rem,5vw,6rem)] py-20 md:py-32"
    >
      <div className="mx-auto max-w-[1600px]">
        {/* Section header */}
        <div className="mb-20 text-center">
          <SectionEyebrow number="01" label="Services" />
          <h2 className="mt-5 font-serif text-4xl font-medium leading-[1.5] tracking-wide text-foreground md:text-5xl">
            บริการของเรา
          </h2>
          <GoldDivider className="mx-auto mt-8" />
        </div>

        {/* Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s, idx) => (
            <div
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border border-primary/10 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 md:p-8"
            >
              {/* Corner glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 h-32 w-32"
                style={{
                  background:
                    "radial-gradient(circle, rgba(123,108,168,0.15), transparent 70%)",
                }}
              />

              {/* Number */}
              <div className="font-serif text-sm font-medium tracking-[0.24em] text-primary">
                {String(idx + 1).padStart(2, "0")}
              </div>

              {/* Name + duration */}
              <div className="mt-5 min-h-[76px]">
                <h3 className="font-serif text-xl font-medium leading-[1.5] tracking-wide text-foreground">
                  {s.name}
                </h3>
                <div className="mt-2 text-xs tracking-widest text-foreground/50">
                  {s.durationMin} นาที
                </div>
              </div>

              {/* Price */}
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-xs text-foreground/50">฿</span>
                <span className="font-serif text-2xl font-medium text-foreground">
                  {s.price.toLocaleString()}
                </span>
              </div>

              {/* CTA */}
              <Link
                href={`/book?service=${s.id}`}
                className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition-opacity hover:opacity-70"
              >
                จองบริการนี้ <span>→</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
