export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">Nebula Spa Admin</h1>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
