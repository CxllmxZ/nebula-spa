import { initAuth } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await initAuth(request);
  return auth.handler(request);
}

export async function GET(request: Request) {
  const auth = await initAuth(request);
  return auth.handler(request);
}
