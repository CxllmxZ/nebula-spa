import { SectionEyebrow, GoldDivider } from "./section-eyebrow";

export function VisitSection() {
  return (
    <section
      id="visit"
      className="relative overflow-hidden bg-background px-[clamp(1.5rem,5vw,6rem)] py-20 md:py-32"
    >
      {/* Subtle nebula accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(123,108,168,0.15), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1400px]">
        <div className="mb-20 text-center">
          <SectionEyebrow number="03" label="Visit" />
          <h2 className="mt-5 font-serif text-4xl font-medium leading-[1.5] tracking-wide text-foreground md:text-5xl">
            มาเยี่ยมเรา
          </h2>
          <GoldDivider className="mx-auto mt-8" />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Hours card */}
          <div className="rounded-3xl border border-primary/10 bg-card p-6 md:p-10">
            <div className="text-xs uppercase tracking-[0.2em] text-primary">
              Hours
            </div>
            <h3 className="mt-4 font-serif text-2xl font-medium tracking-wide text-foreground">
              เวลาทำการ
            </h3>
            <GoldDivider className="mt-6" />

            <dl className="mt-8 space-y-4 text-sm tracking-wide">
              <div className="flex justify-between border-b border-primary/10 pb-3">
                <dt className="text-foreground/60">จันทร์ - ศุกร์</dt>
                <dd className="text-foreground">10:00 - 21:00</dd>
              </div>
              <div className="flex justify-between border-b border-primary/10 pb-3">
                <dt className="text-foreground/60">เสาร์ - อาทิตย์</dt>
                <dd className="text-foreground">09:00 - 22:00</dd>
              </div>
            </dl>
          </div>

          {/* Contact card */}
          <div className="rounded-3xl border border-primary/10 bg-card p-6 md:p-10">
            <div className="text-xs uppercase tracking-[0.2em] text-primary">
              Contact
            </div>
            <h3 className="mt-4 font-serif text-2xl font-medium tracking-wide text-foreground">
              ติดต่อเรา
            </h3>
            <GoldDivider className="mt-6" />

            <div className="mt-8 space-y-6 text-sm tracking-wide text-foreground/80">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-primary/70">
                  Location
                </div>
                <p className="mt-2">123 ถนน... กรุงเทพ (demo address)</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-primary/70">
                  LINE
                </div>
                <p className="mt-2">@nebulaspa (coming soon)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
