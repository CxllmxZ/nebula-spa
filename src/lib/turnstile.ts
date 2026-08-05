/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Flow:
 *   1. Client submits form with turnstileToken (from widget)
 *   2. Server calls this function to verify with Cloudflare
 *   3. If valid → proceed; if not → reject
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

/**
 * Verify Turnstile token against Cloudflare.
 *
 * @param token - Token from client-side widget
 * @param secretKey - Secret key (from env: TURNSTILE_SECRET_KEY)
 * @param remoteip - Optional client IP for extra validation
 * @returns true if valid, false otherwise
 *
 * Uses test key in dev: 1x0000000000000000000000000000000AA (always passes)
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteip?: string,
): Promise<boolean> {
  if (!token) return false;
  if (!secretKey) {
    return false;
  }

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);
  if (remoteip) formData.append("remoteip", remoteip);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      console.error("[Turnstile] Verify request failed", response.status);
      return false;
    }

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (!data.success) {
      console.warn("[Turnstile] Verification failed", data["error-codes"]);
    }

    return data.success;
  } catch (err) {
    console.error("[Turnstile] Verify error", err);
    return false;
  }
}
