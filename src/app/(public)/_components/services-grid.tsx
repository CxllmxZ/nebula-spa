import Link from "next/link";
import {
  HandHelping,
  Droplets,
  Layers,
  Sparkles,
  Footprints,
  Leaf,
  Flower,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { SectionEyebrow, GoldDivider } from "./section-eyebrow";

type Service = {
  id: number;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
};

// Map service name → Lucide icon by keyword
function getServiceIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("อโรม่า") || n.includes("น้ำมัน")) return Droplets;
  if (n.includes("หิน")) return Layers;
  if (n.includes("หน้า")) return Sparkles;
  if (n.includes("เท้า")) return Footprints;
  if (n.includes("ขัด")) return Leaf;
  if (n.includes("สมุนไพร") || n.includes("ประคบ")) return Flower;
  if (n.includes("คู่")) return Heart;
  return HandHelping; // default (นวดไทย + fallback)
}

// 4 gradient variants — cycled through 8 cards for subtle variety
const CARD_GLOWS = [
  "radial-gradient(circle at 100% 0%, rgba(75,63,114,0.35), transparent 70%)", // deep purple
  "radial-gradient(circle at 100% 0%, rgba(91,123,184,0.25), transparent 70%)", // indigo blue
  "radial-gradient(circle at 100% 0%, rgba(123,108,168,0.30), transparent 70%)", // soft purple
  "radial-gradient(circle at 100% 0%, rgba(201,169,97,0.18), transparent 70%)", // gold hint
];

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
          {services.map((s, idx) => {
            const Icon = getServiceIcon(s.name);
            const glowGradient = CARD_GLOWS[idx % CARD_GLOWS.length];

            return (
              <div
                key={s.id}
                className="group relative overflow-hidden rounded-2xl border border-primary/10 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 md:p-8"
              >
                {/* Corner glow — varied per card */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-0 h-40 w-40 transition-opacity duration-500 group-hover:opacity-150"
                  style={{ background: glowGradient }}
                />

                {/* Icon + Number row */}
                <div className="flex items-start justify-between">
                  <div className="rounded-xl border border-primary/20 bg-background/40 p-3 backdrop-blur-sm transition-all duration-300 group-hover:border-primary/50 group-hover:bg-background/60">
                    <Icon
                      className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110"
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className="font-serif text-sm font-medium tracking-[0.24em] text-primary/70">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Name + duration */}
                <div className="mt-8 min-h-[76px]">
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
                  จองบริการนี้ <span aria-hidden>→</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
