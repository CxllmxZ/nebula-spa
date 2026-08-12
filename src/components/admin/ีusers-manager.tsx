"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserFormDialog } from "./user-form-dialog";

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string; // ISO
}

interface Props {
  initialUsers: UserDTO[];
  currentUserId: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแล",
  staff: "พนักงาน",
  manager: "หัวหน้า",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  manager: "secondary",
  staff: "outline",
};

const ROLES_ORDERED = ["admin", "staff", "manager"] as const;

export function UsersManager({ initialUsers, currentUserId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const adminCount = initialUsers.filter((u) => u.role === "admin").length;

  async function changeRole(user: UserDTO, newRole: string) {
    if (user.role === newRole) return;
    setPendingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "เปลี่ยน role ไม่สำเร็จ");
      }
      toast.success(
        `เปลี่ยน role ของ ${user.name} เป็น "${ROLE_LABELS[newRole]}" แล้ว`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(message);
    } finally {
      setPendingId(null);
    }
  }

  async function deleteUser(user: UserDTO) {
    if (!confirm(`ลบ ${user.name} (${user.email}) ใช่หรือไม่?`)) return;

    setPendingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "ลบไม่สำเร็จ");
      }
      toast.success(`ลบ ${user.name} แล้ว`);
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">ทีมงาน</h2>
            <p className="text-sm text-muted-foreground">
              {initialUsers.length} คน · ผู้ดูแล {adminCount} คน
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มทีมงาน
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>เพิ่มเมื่อ</TableHead>
                <TableHead className="w-24 text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                const isLastAdmin = u.role === "admin" && adminCount <= 1;
                const isRowPending = pendingId === u.id;
                const canModify = !isSelf && !isRowPending;

                return (
                  <TableRow
                    key={u.id}
                    className={isRowPending ? "opacity-50" : undefined}
                  >
                    <TableCell>
                      <div className="font-medium">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (คุณ)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ROLE_VARIANTS[u.role] ?? "outline"}
                        className="text-xs"
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(u.createdAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* Change role dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              disabled={!canModify}
                            >
                              บทบาท <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>เปลี่ยนบทบาท</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {ROLES_ORDERED.map((r) => {
                              const isCurrent = r === u.role;
                              const wouldDemoteLastAdmin =
                                isLastAdmin && r !== "admin";
                              return (
                                <DropdownMenuItem
                                  key={r}
                                  disabled={isCurrent || wouldDemoteLastAdmin}
                                  onSelect={() => changeRole(u, r)}
                                >
                                  {ROLE_LABELS[r]}
                                  {isCurrent && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      ปัจจุบัน
                                    </span>
                                  )}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteUser(u)}
                          disabled={!canModify || isLastAdmin}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">ลบ</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <UserFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
