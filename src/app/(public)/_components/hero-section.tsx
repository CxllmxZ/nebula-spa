import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden px-[clamp(1.5rem,5vw,6rem)] py-16 text-center md:py-20"
    >
      {/* Base gradient — Sun-like radial ที่มุมขวาบน */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 88% 15%, #241D2E 0%, #0F1024 60%), #0F1024",
        }}
      />

      {/* Nebula clouds */}
      <div
        aria-hidden
        className="absolute inset-0 blur-sm"
        style={{
          background:
            "radial-gradient(ellipse 45% 40% at 70% 20%, rgba(75,63,114,0.32), transparent 70%), radial-gradient(ellipse 35% 30% at 85% 55%, rgba(91,123,184,0.18), transparent 70%), radial-gradient(ellipse 40% 35% at 20% 30%, rgba(123,108,168,0.15), transparent 70%)",
        }}
      />

      {/* Starfield with twinkle */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-75"
        style={{
          animation: "twinkle 7s ease-in-out infinite",
          backgroundImage: [
            "radial-gradient(1px 1px at 8% 12%, #F5E6C8, transparent)",
            "radial-gradient(1.5px 1.5px at 18% 28%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 32% 8%, #C9A961, transparent)",
            "radial-gradient(1px 1px at 48% 22%, #F5E6C8, transparent)",
            "radial-gradient(1.5px 1.5px at 62% 6%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 74% 38%, #F5E6C8, transparent)",
            "radial-gradient(1.5px 1.5px at 88% 14%, #C9A961, transparent)",
            "radial-gradient(1px 1px at 92% 42%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 55% 48%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 78% 62%, #7B6CA8, transparent)",
            "radial-gradient(1.5px 1.5px at 42% 68%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 68% 78%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 88% 82%, #C9A961, transparent)",
            "radial-gradient(1px 1px at 25% 55%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 12% 72%, #F5E6C8, transparent)",
          ].join(", "),
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Location pill */}
        <div className="mb-12 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/50 px-4 py-2 text-xs tracking-widest backdrop-blur-md">
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary"
            style={{ boxShadow: "0 0 8px #C9A961" }}
          />
          <span>BANGKOK · EST. 2024</span>
        </div>

        {/* Headline */}
        <h1
          className="mb-8 font-serif text-4xl font-medium leading-[1.55] tracking-wide text-foreground text-balance sm:text-5xl md:text-7xl"
          style={{ textShadow: "0 2px 30px rgba(15,16,36,0.75)" }}
        >
          หยุดเวลา ปล่อยใจ
          <br />
          <span className="font-normal italic text-primary">ให้ดวงดาวดูแล</span>
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mb-12 max-w-xl text-lg font-normal leading-[1.85] tracking-wide text-foreground/80">
          นวดไทย · นวดน้ำมัน · สปาหน้า
          <br />
          <span className="opacity-70">จองง่ายใน 3 ขั้นตอน</span>
        </p>

        {/* CTA */}
        <Button
          asChild
          size="lg"
          className="rounded-full px-10 py-6 text-sm tracking-[0.14em] sm:px-12 sm:text-base"
          style={{ animation: "glow 3.5s ease-in-out infinite" }}
        >
          <Link href="/book">
            จองเลย <span className="ml-2">→</span>
          </Link>
        </Button>

        {/* Meta */}
        <div className="mt-16 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.2em] text-foreground/40">
          <span>Open Daily</span>
          <span className="text-primary">·</span>
          <span>By Appointment</span>
          <span className="text-primary">·</span>
          <span>Central Bangkok</span>
        </div>
      </div>
    </section>
  );
}
