---
description: How to deploy the Lawlanes application to Netlify
---

# Deploying to Netlify

This guide explains how to deploy the Lawlanes Next.js application to Netlify.

## Prerequisites

1.  **GitHub Repository**: Ensure your code is pushed to GitHub (already done).
2.  **Netlify Account**: You need an account at [netlify.com](https://www.netlify.com).

## Steps

1.  **Log in to Netlify**: Go to [netlify.com](https://www.netlify.com) and log in (recommend using GitHub login).
2.  **Add New Site**:
    *   Click **"Add new site"** -> **"Import from an existing project"**.
    *   Select **"GitHub"**.
    *   Authorize Netlify to access your GitHub repositories if asked.
    *   Search for and select the `Lawlanes` repository.

3.  **Configure Build Settings**:
    *   **Branch to deploy**: `main`
    *   **Base directory**: (Leave empty)
    *   **Build command**: `npm run build` (Netlify usually detects this automatically)
    *   **Publish directory**: `.next` (Netlify usually detects this automatically)
    *   **Framework Preset**: It should automatically detect `Next.js`.

4.  **Environment Variables (Crucial)**:
    *   Click on **"Show advanced"** or go to **"Site configuration" > "Environment variables"** after the site is created.
    *   You need to add all variables from your local `.env` file.
    *   **Tip**: Netlify has a "Bulk Import" feature. You can copy the entire content of your `.env` file and paste it there.

    **Required Variables:**
    *   `NEXT_PUBLIC_FIREBASE_API_KEY`
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`
    *   `GOOGLE_GENAI_API_KEY`

5.  **Deploy**:
    *   Click **"Deploy site"**.
    *   Netlify will start building. It might take a few minutes.

6.  **Verify**:
    *   Once the "Production: master" badge turns green, click the URL provided (e.g., `lawlanes.netlify.app`).

## Troubleshooting

*   **Build Failures**: Check the "Deploys" tab -> click on the failed build to see logs.
*   **Next.js Runtime**: Netlify uses a plugin called `@netlify/plugin-nextjs` to run Next.js on their platform. Usually, it's installed automatically. If you see errors related to "Runtime", check if the plugin was auto-installed in the logs.
