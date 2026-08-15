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
        <div className="mx-auto max-w-6xl px-6 text-center text-xs tracking-widest text-muted-foreground">
          © 2026 Nebula Spa — Demo project
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
