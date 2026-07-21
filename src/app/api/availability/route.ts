import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");
  const date = searchParams.get("date");

  return NextResponse.json({
    ok: true,
    message: "Availability endpoint — coming soon",
    query: { serviceId, date },
    slots: [],
  });
}
