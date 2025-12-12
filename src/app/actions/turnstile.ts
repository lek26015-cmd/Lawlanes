'use server';

export async function validateTurnstile(token: string) {
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

    if (!secretKey) {
        console.error('CLOUDFLARE_TURNSTILE_SECRET_KEY is not set');
        // In development/test without keys, you might want to bypass or fail.
        // For security, failing is safer, but for dev experience, maybe bypass if explicitly allowed.
        // Here we fail to ensure keys are set up.
        return { success: false, message: 'Server configuration error' };
    }

    try {
        const formData = new FormData();
        formData.append('secret', secretKey);
        formData.append('response', token);

        const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const result = await fetch(url, {
            body: formData,
            method: 'POST',
        });

        const outcome = await result.json();

        if (outcome.success) {
            return { success: true };
        } else {
            console.error('Turnstile validation failed:', outcome);
            return { success: false, message: 'Invalid captcha' };
        }
    } catch (error) {
        console.error('Turnstile validation error:', error);
        return { success: false, message: 'Validation error' };
    }
}
