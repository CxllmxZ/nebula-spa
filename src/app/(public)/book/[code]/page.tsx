import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, Check, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBookingByCode } from "@/lib/db/queries/bookings";
import { LineConnectCard } from "@/app/(public)/book/[code]/_components/line-connect-card";

type PageProps = {
  params: Promise<{ code: string }>;
};

function formatThaiDateFull(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatBangkokTime(d: Date): string {
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function toGoogleCalendarUrl(b: {
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  code: string;
}) {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Nebula Spa — ${b.serviceName}`,
    dates: `${fmt(b.startsAt)}/${fmt(b.endsAt)}`,
    details: `Booking code: ${b.code}\nจองผ่าน Nebula Spa`,
    location: "Nebula Spa, Bangkok",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default async function ConfirmationPage({ params }: PageProps) {
  const { code } = await params;
  const booking = await getBookingByCode(code);

  if (!booking) {
    notFound();
  }

  const calendarUrl = toGoogleCalendarUrl({
    serviceName: booking.serviceName,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    code: booking.code,
  });

  return (
    <div className="mx-auto max-w-2xl px-[clamp(1.5rem,5vw,6rem)] py-16 md:py-24">
      {/* Hero */}
      <div className="text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
          <Check className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </div>
        <div className="text-sm font-medium uppercase tracking-[0.32em] text-primary md:text-base">
          Booking Confirmed
        </div>
        <h1 className="mt-5 font-serif text-4xl font-medium leading-[1.55] tracking-wide text-foreground md:text-5xl">
          จองเรียบร้อยแล้ว
        </h1>
        <div className="mx-auto mt-8 h-px w-10 bg-primary" />

        {/* Code */}
        <div className="mt-10">
          <div className="text-xs uppercase tracking-[0.32em] text-primary/70">
            Booking Code
          </div>
          <div className="mt-3 font-serif text-5xl font-medium tracking-[0.32em] text-primary md:text-6xl">
            {booking.code}
          </div>
          <p className="mt-3 text-xs tracking-wide text-foreground/50">
            เก็บโค้ดนี้ไว้ใช้อ้างอิงกับทางร้าน
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="mt-12 rounded-2xl border border-primary/15 bg-card p-8 md:p-10">
        <dl className="space-y-5 text-sm tracking-wide">
          <div className="flex items-baseline justify-between gap-4 border-b border-primary/10 pb-4">
            <dt className="text-foreground/60">บริการ</dt>
            <dd className="text-right font-serif text-base text-foreground">
              {booking.serviceName}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-primary/10 pb-4">
            <dt className="text-foreground/60">วัน</dt>
            <dd className="text-right text-foreground">
              {formatThaiDateFull(booking.startsAt)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-primary/10 pb-4">
            <dt className="text-foreground/60">เวลา</dt>
            <dd className="text-right text-foreground">
              {formatBangkokTime(booking.startsAt)} –{" "}
              {formatBangkokTime(booking.endsAt)} น.
              <span className="ml-2 text-xs text-foreground/50">
                ({booking.durationMin} นาที)
              </span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-primary/10 pb-4">
            <dt className="text-foreground/60">ราคา</dt>
            <dd className="text-right font-serif text-lg text-foreground">
              ฿{booking.price.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-primary/10 pb-4">
            <dt className="text-foreground/60">ผู้จอง</dt>
            <dd className="text-right text-foreground">
              {booking.customerName}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-foreground/60">เบอร์โทร</dt>
            <dd className="text-right font-mono text-foreground">
              {booking.customerPhone}
            </dd>
          </div>
        </dl>
      </div>

      <LineConnectCard />

      {/* CTAs */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button
          asChild
          size="lg"
          className="flex-1 rounded-full py-6 text-sm tracking-[0.14em]"
        >
          <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
            <CalendarPlus className="mr-2 h-4 w-4" />
            เพิ่มลง Google Calendar
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="flex-1 rounded-full border-primary/30 py-6 text-sm tracking-[0.14em]"
        >
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            กลับหน้าแรก
          </Link>
        </Button>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-center text-xs tracking-wide text-foreground/50">
        ต้องการแก้ไขหรือยกเลิก โทรติดต่อร้านโดยตรง
      </p>
    </div>
  );
}
