import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "./_components/site-header";
import Link from "next/link";

const navLinks = [
  { href: "/#services", label: "บริการ" },
  { href: "/#about", label: "เรื่องเรา" },
  { href: "/#visit", label: "เยี่ยมเรา" },
];

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="cosmic min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>{children}</main>

      <footer className="border-t border-primary/10 bg-card/40 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center text-xs tracking-widest text-muted-foreground sm:flex-row sm:justify-center sm:gap-4">
          <span>© 2026 Nebula Spa — Demo project</span>
          <span aria-hidden className="hidden sm:inline">
            ·
          </span>
          <Link
            href="/privacy"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            นโยบายความเป็นส่วนตัว
          </Link>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
