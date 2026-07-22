/**
 * Cloudflare Turnstile verification
 *
 * Verifies that a Turnstile token (from the client widget) is valid.
 * Used in public booking Server Action to prevent bot spam.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const TURNSTILE_VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// ============================================
// TODO: Verify Turnstile token server-side
// ============================================
// export async function verifyTurnstile(token: string): Promise<boolean>

export {};
