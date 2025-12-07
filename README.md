# lawlanes

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Deploying to Cloudflare Pages

This project is configured to be deployed to Cloudflare Pages.

1.  **Connect your Git repository to Cloudflare Pages.**
2.  In the build settings, select **Next.js** as the "Framework preset". Cloudflare will automatically configure the build command and output directory.
3.  **Add Environment Variables.** This is a critical step for connecting to your Firebase database.
    *   Go to your Cloudflare Pages project settings: `Settings` > `Environment variables`.
    *   Add "Production" environment variables.
    *   Copy the values from `src/firebase/config.ts` and create the following variables. **Note the `NEXT_PUBLIC_` prefix is required.**
        *   `NEXT_PUBLIC_FIREBASE_API_KEY`
        *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
        *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
        *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
        *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
        *   `NEXT_PUBLIC_FIREBASE_APP_ID`
        *   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (if it exists in your config)
4.  **Deploy.** Cloudflare Pages will automatically build and deploy your site using these variables.
 
