import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FooterCta() {
  return (
    <section
      className="relative overflow-hidden px-[clamp(1.5rem,5vw,6rem)] py-24 text-center md:py-40"
      style={{
        background:
          "radial-gradient(ellipse 70% 100% at 50% 50%, #1A1B2E 0%, #0F1024 80%)",
      }}
    >
      {/* Deep starfield */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          animation: "twinkle 8s ease-in-out infinite",
          backgroundImage: [
            "radial-gradient(1px 1px at 15% 30%, #F5E6C8, transparent)",
            "radial-gradient(1.5px 1.5px at 82% 25%, #C9A961, transparent)",
            "radial-gradient(1px 1px at 45% 70%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 70% 80%, #7B6CA8, transparent)",
            "radial-gradient(1px 1px at 25% 85%, #F5E6C8, transparent)",
            "radial-gradient(1px 1px at 90% 60%, #F5E6C8, transparent)",
          ].join(", "),
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-8 text-sm uppercase tracking-[0.32em] text-primary md:text-base">
          ✦ Reserve your journey
        </div>
        <h2 className="mb-14 font-serif text-3xl font-medium leading-[1.55] tracking-wide text-foreground sm:text-4xl md:text-6xl">
          พร้อมสัมผัส
          <br />
          <span className="font-normal italic text-primary">
            ประสบการณ์แล้วหรือยัง?
          </span>
        </h2>

        <Button
          asChild
          size="lg"
          className="rounded-full px-10 py-6 text-sm tracking-[0.16em] sm:px-14 sm:py-7 sm:text-base"
          style={{ animation: "glow 3.5s ease-in-out infinite" }}
        >
          <Link href="/book">
            จองเลย <span className="ml-2">→</span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
