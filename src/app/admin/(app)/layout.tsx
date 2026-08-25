import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { initAuth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { UserMenu } from "@/components/admin/user-menu";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch session — middleware guards this route but we need user data for UserMenu
  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/admin/login");
  }

  const user = session.user;
  const role = (user as { role?: string }).role ?? "staff";

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between gap-3 md:gap-6 px-4 md:px-6 py-3 md:py-4">
          <Link
            href="/admin"
            className="text-base md:text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            <span className="md:hidden">Nebula Spa</span>
            <span className="hidden md:inline">Nebula Spa Admin</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <AdminNav />
            <UserMenu name={user.name} email={user.email} role={role} />
          </div>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
