"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "แดชบอร์ด", match: "exact" as const },
  { href: "/admin/bookings", label: "การจอง", match: "prefix" as const },
  { href: "/admin/settings", label: "ตั้งค่า", match: "prefix" as const },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string, match: "exact" | "prefix") {
    if (match === "exact") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = isActive(link.href, link.match);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
