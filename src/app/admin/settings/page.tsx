import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllServices } from "@/lib/db/queries/services";
import { ServicesManager } from "@/components/admin/services-manager";
import { getAllHours } from "@/lib/db/queries/business-hours";
import { HoursManager } from "@/components/admin/hours-manager";

import { getUpcomingBlockedSlots } from "@/lib/db/queries/blocked-slots";
import { toBangkokIsoString } from "@/lib/datetime";
import { BlockedSlotsManager } from "@/components/admin/blocked-slots-manager";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const { tab } = await searchParams;
  const defaultTab = tab ?? "services";

  // Parallel fetch — hours/blocked-slots ทำใน 7F, ตอนนี้ services เท่านั้น
  const [services, hours, blockedSlotsRaw] = await Promise.all([
    getAllServices(),
    getAllHours(),
    getUpcomingBlockedSlots(),
  ]);

  // Serialize Date → Bangkok ISO for client component (matches API response shape)
  const blockedSlots = blockedSlotsRaw.map((s) => ({
    id: s.id,
    startsAt: toBangkokIsoString(s.startsAt),
    endsAt: toBangkokIsoString(s.endsAt),
    reason: s.reason,
    createdAt: toBangkokIsoString(s.createdAt),
  }));

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
          <h1 className="text-3xl font-semibold tracking-tight">ตั้งค่า</h1>
          <p className="text-muted-foreground">
            จัดการบริการ เวลาทำการ และวันหยุด
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">บริการ</TabsTrigger>
          <TabsTrigger value="hours">เวลาทำการ</TabsTrigger>
          <TabsTrigger value="blocked">วันหยุด</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <ServicesManager initialServices={services} />
        </TabsContent>

        <TabsContent value="hours">
          <HoursManager initialHours={hours} />
        </TabsContent>

        <TabsContent value="blocked">
          <BlockedSlotsManager initialSlots={blockedSlots} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
