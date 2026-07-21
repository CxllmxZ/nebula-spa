export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">ยืนยันการจอง</h1>
      <p className="mt-2 text-sm text-gray-500">Booking code: {code}</p>
    </main>
  );
}
