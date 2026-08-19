import { toZonedTime } from "date-fns-tz";
import { getMonth, getYear, subMonths, addMonths } from "date-fns";
import Link from "next/link";

import {
  getBookedDatesInMonth,
  getBookingStats,
} from "@/lib/db/queries/bookings";
import { BANGKOK_TZ } from "@/lib/datetime";
import { DashboardCalendar } from "@/components/admin/dashboard-calendar";
import { getRecentBookings } from "@/lib/db/queries/bookings";
import { RecentBookings } from "@/components/admin/recent-bookings";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCount, formatCurrency } from "@/lib/format";

export default async function AdminDashboardPage() {
  // ─── Bangkok calendar: prev / current / next month ────────
  const nowBkk = toZonedTime(new Date(), BANGKOK_TZ);
  const prevBkk = subMonths(nowBkk, 1);
  const nextBkk = addMonths(nowBkk, 1);

  const [stats, prevDates, currDates, nextDates, recentBookings] =
    await Promise.all([
      getBookingStats(),
      getBookedDatesInMonth(getYear(prevBkk), getMonth(prevBkk) + 1),
      getBookedDatesInMonth(getYear(nowBkk), getMonth(nowBkk) + 1),
      getBookedDatesInMonth(getYear(nextBkk), getMonth(nextBkk) + 1),
      getRecentBookings(5),
    ]);

  const bookedDates = [...prevDates, ...currDates, ...nextDates];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">แดชบอร์ด</h1>
        <p className="text-muted-foreground">ภาพรวมการจอง Nebula Spa</p>
      </div>

      {/* Hero — upcoming today */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardDescription className="text-primary-foreground/80">
            คิวถัดไปวันนี้
          </CardDescription>
          <CardTitle className="text-4xl">
            {formatCount(stats.today.upcomingCount)}
            <span className="ml-2 text-lg font-normal text-primary-foreground/80">
              รายการ
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* 6 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="จองวันนี้"
          value={formatCount(stats.today.count)}
          unit="รายการ"
        />
        <StatCard
          label="รายได้คาดการณ์ วันนี้"
          value={formatCurrency(stats.today.revenue)}
        />
        <StatCard
          label="จองสัปดาห์นี้"
          value={formatCount(stats.week.count)}
          unit="รายการ"
        />
        <StatCard
          label="รายได้คาดการณ์ สัปดาห์นี้"
          value={formatCurrency(stats.week.revenue)}
        />
        <StatCard
          label="จองเดือนนี้"
          value={formatCount(stats.month.count)}
          unit="รายการ"
        />
        <StatCard
          label="รายได้คาดการณ์ เดือนนี้"
          value={formatCurrency(stats.month.revenue)}
        />
      </div>

      {/* Calendar + Recent */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>ปฏิทิน</CardTitle>
            <CardDescription>คลิกวันที่มีการจองเพื่อดูรายการ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <DashboardCalendar bookedDates={bookedDates} />
            </div>
            <div className="flex flex-wrap justify-center gap-4 border-t pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-primary/15" />
                มีการจอง
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-primary" />
                วันนี้
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent — placeholder ค้างไว้สำหรับ 7C.5 */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>การจองล่าสุด</CardTitle>
            <CardDescription>5 รายการล่าสุด</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentBookings bookings={recentBookings} />
            <div className="mt-4 border-t pt-3 text-center">
              <Link
                href="/admin/bookings"
                className="text-sm text-primary hover:underline"
              >
                ดูการจองทั้งหมด →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">
          {value}
          {unit && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
