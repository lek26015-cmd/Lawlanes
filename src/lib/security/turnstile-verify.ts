/**
 * Server-side utility to validate Cloudflare Turnstile tokens.
 */
export async function validateTurnstileToken(token: string) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing TURNSTILE_SECRET_KEY");
  }

  if (!token) {
    return { success: false, error: "Missing token" };
  }

  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);

  const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  
  try {
    const result = await fetch(url, {
      body: formData,
      method: 'POST',
    });

    const outcome = await result.json() as any;
    
    // Outcome includes: 
    // success: true|false
    // error-codes: []
    // challenge_ts: timestamp
    // hostname: string
    
    return {
      success: outcome.success,
      error: outcome['error-codes']?.[0] || null,
    };
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return { success: false, error: "Verification request failed" };
  }
}
