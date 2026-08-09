import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getBookingsWithFilter,
  type AdminBookingListItem,
} from "@/lib/db/queries/bookings";
import { getActiveServices } from "@/lib/db/queries/services";
import { adminBookingFilterSchema } from "@/lib/validations";
import { BookingsFilterBar } from "@/components/admin/bookings-filter-bar";
import { BookingsTable } from "@/components/admin/bookings-table";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;

  // ─── Normalize + validate query params ─────────────────────
  // adminBookingFilterSchema expects flat strings — flatten arrays first
  const flatParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") flatParams[key] = value;
    else if (Array.isArray(value) && value[0]) flatParams[key] = value[0];
  }

  const parsed = adminBookingFilterSchema.safeParse(flatParams);

  // Invalid params → fall back to defaults (don't 400 — bad URL should still show list)
  const filter = parsed.success
    ? parsed.data
    : adminBookingFilterSchema.parse({});

  // ─── Parallel fetch ────────────────────────────────────────
  const [result, activeServices] = await Promise.all([
    getBookingsWithFilter(filter),
    getActiveServices(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับแดชบอร์ด
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">การจอง</h1>
          <p className="text-muted-foreground">
            จัดการการจองทั้งหมด — ตัวกรอง + ค้นหา + เปลี่ยนสถานะ
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ตัวกรอง</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingsFilterBar initialFilter={filter} services={activeServices} />
        </CardContent>
      </Card>

      {/* Table + pagination */}
      <Card>
        <CardContent className="pt-6">
          <BookingsTable
            bookings={result.bookings}
            meta={result.meta}
            currentFilter={filter}
          />
        </CardContent>
      </Card>
    </div>
  );
}
