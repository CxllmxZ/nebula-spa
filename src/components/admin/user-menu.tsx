"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

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
import { authClient } from "@/lib/auth-client";

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแล",
  staff: "พนักงาน",
  manager: "หัวหน้า",
};

interface Props {
  name: string;
  email: string;
  role: string;
}

export function UserMenu({ name, email, role }: Props) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      // Full reload = clear client state + middleware picks up empty session
      window.location.href = "/admin/login";
    } catch (err) {
      toast.error("ออกจากระบบไม่สำเร็จ");
      setIsSigningOut(false);
    }
  }

  const initial = name.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {initial}
          </div>
          <span className="hidden md:inline text-sm font-medium">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
            <Badge variant="outline" className="w-fit text-xs">
              {roleLabel}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          disabled={isSigningOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isSigningOut ? "กำลังออก..." : "ออกจากระบบ"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
