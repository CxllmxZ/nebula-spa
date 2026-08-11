export const dynamic = "force-dynamic";

import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <Link
            href="/admin"
            className="text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            Nebula Spa Admin
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
