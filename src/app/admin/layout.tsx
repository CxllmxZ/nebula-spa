export const dynamic = "force-dynamic";
import { Toaster } from "@/components/ui/sonner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-card px-6 py-4">
        <h1 className="text-lg font-semibold">Nebula Spa Admin</h1>
      </header>
      <main className="flex-1 p-6">{children}</main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
