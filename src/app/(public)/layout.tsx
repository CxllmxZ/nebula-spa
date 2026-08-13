import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="cosmic min-h-screen bg-background text-foreground">
      {/* Header — sticky, minimal */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="font-serif text-xl font-semibold tracking-wider">
              Nebula
            </span>
            <span className="font-serif text-xl font-light tracking-widest text-primary">
              Spa
            </span>
          </Link>
          <Button asChild size="sm">
            <Link href="/book">จองเลย</Link>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border/40 bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-serif text-lg font-semibold">Nebula Spa</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                นวดไทย · นวดน้ำมัน · สปาหน้า · ประคบสมุนไพร
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">เวลาทำการ</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                จันทร์-ศุกร์: 10:00 - 21:00
                <br />
                เสาร์-อาทิตย์: 09:00 - 22:00
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">ติดต่อ</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                LINE: @nebulaspa (coming soon)
                <br />
                123 ถนน... กรุงเทพ (demo address)
              </p>
            </div>
          </div>
          <div className="mt-8 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
            © 2026 Nebula Spa — Demo project
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
