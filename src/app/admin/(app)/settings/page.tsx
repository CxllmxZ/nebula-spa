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

import { getAllUsers } from "@/lib/db/queries/users";
import { UsersManager } from "@/components/admin/ีusers-manager";
import { requireRoleAction } from "@/lib/auth-guard";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const session = await requireRoleAction(["admin", "staff"]);
  const currentUserRole = (session.user as { role?: string }).role ?? "staff";
  const isAdmin = currentUserRole === "admin";

  const { tab } = await searchParams;
  const defaultTab = tab ?? "services";

  const [services, hours, blockedSlotsRaw, users] = await Promise.all([
    getAllServices(),
    getAllHours(),
    getUpcomingBlockedSlots(),
    isAdmin ? getAllUsers() : Promise.resolve([]),
  ]);

  const blockedSlots = blockedSlotsRaw.map((s) => ({
    id: s.id,
    startsAt: toBangkokIsoString(s.startsAt),
    endsAt: toBangkokIsoString(s.endsAt),
    reason: s.reason,
    createdAt: toBangkokIsoString(s.createdAt),
  }));

  // Serialize users createdAt to ISO for client
  const usersDTO = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">ตั้งค่า</h1>
        <p className="text-muted-foreground">
          จัดการบริการ เวลาทำการ และวันหยุด
          {isAdmin && " · ทีมงาน"}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">บริการ</TabsTrigger>
          <TabsTrigger value="hours">เวลาทำการ</TabsTrigger>
          <TabsTrigger value="blocked">วันหยุด</TabsTrigger>
          {isAdmin && <TabsTrigger value="team">ทีมงาน</TabsTrigger>}
        </TabsList>

        <TabsContent value="services">
          <ServicesManager initialServices={services} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="hours">
          <HoursManager initialHours={hours} canEdit={isAdmin} />
        </TabsContent>

        <TabsContent value="blocked">
          <BlockedSlotsManager initialSlots={blockedSlots} canEdit={isAdmin} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="team">
            <UsersManager
              initialUsers={usersDTO}
              currentUserId={session.user.id}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
