---
description: How to deploy the Lawlanes application to Vercel
---

# Deploying to Vercel

This guide explains how to deploy the Lawlanes Next.js application to Vercel.

## Prerequisites

1.  **GitHub Repository**: Ensure your code is pushed to GitHub (already done).
2.  **Vercel Account**: You need an account at [vercel.com](https://vercel.com).

## Steps

1.  **Log in to Vercel**: Go to [vercel.com](https://vercel.com) and log in (recommend using GitHub login).
2.  **Add New Project**:
    *   Click **"Add New..."** -> **"Project"**.
    *   Select **"Continue with GitHub"**.
    *   Find the `Lawlanes` repository and click **"Import"**.

3.  **Configure Project**:
    *   **Framework Preset**: It should automatically detect `Next.js`.
    *   **Root Directory**: Leave as `./`.
    *   **Build and Output Settings**: Leave default.

4.  **Environment Variables (Crucial)**:
    *   Expand the **"Environment Variables"** section.
    *   You need to copy all values from your local `.env` file here.
    *   Open your local `.env` file and add each key-value pair.
    *   **Important**: For `FIREBASE_SERVICE_ACCOUNT_KEY`, if it's a JSON string, ensure it's pasted correctly. If you are using individual keys (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`), add them all.

    **Required Variables:**
    *   `NEXT_PUBLIC_FIREBASE_API_KEY`
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`
    *   `GOOGLE_GENAI_API_KEY` (for AI features)

5.  **Deploy**:
    *   Click **"Deploy"**.
    *   Vercel will build your project. This might take a minute or two.

6.  **Verify**:
    *   Once completed, you will get a deployment URL (e.g., `lawlanes.vercel.app`).
    *   Click the screenshot to visit your live site.

## Troubleshooting

*   **Build Failures**: Check the "Logs" tab in Vercel deployment details. Common issues are missing environment variables or type errors (run `npm run typecheck` locally to verify).
*   **Firebase Issues**: If you see permission errors, ensure your Firestore/Storage rules allow the domain, or check if the API keys are correct.
