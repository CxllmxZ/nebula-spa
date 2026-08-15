"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/#services", label: "บริการ" },
  { href: "/#about", label: "เรื่องเรา" },
  { href: "/#visit", label: "เยี่ยมเรา" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/70 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-[clamp(1.5rem,5vw,6rem)] lg:h-20">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-baseline gap-2"
        >
          <span className="font-serif text-xl font-semibold tracking-wider md:text-2xl lg:text-3xl">
            Nebula
          </span>
          <span className="font-serif text-xl font-light tracking-widest text-primary md:text-2xl lg:text-3xl">
            Spa
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm tracking-wide text-foreground/70 transition-colors hover:text-foreground md:text-base lg:text-lg"
            >
              {link.label}
            </Link>
          ))}
          <Button asChild size="sm" className="tracking-wider">
            <Link href="/book">จองเลย</Link>
          </Button>
        </nav>

        {/* Mobile: CTA + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <Button
            asChild
            size="default"
            className="tracking-wider lg:text-base"
          >
            <Link href="/book">จองเลย</Link>
          </Button>
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            className="rounded-md p-1.5 text-foreground/70 transition-colors hover:text-foreground"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-primary/10 bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1 px-[clamp(1.5rem,5vw,6rem)] py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md py-3 text-base tracking-wide text-foreground/70 transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
