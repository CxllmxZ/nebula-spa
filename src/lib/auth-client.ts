// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // baseURL ไม่ต้องระบุ — Better Auth infer จาก window.location origin
  // (client-side runtime), server-side ไม่ใช้ตัวนี้
});

export const { signIn, signOut, signUp, useSession } = authClient;
