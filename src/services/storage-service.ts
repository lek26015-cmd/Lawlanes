/**
 * Secure Storage Service (Next.js side)
 */

const FILE_WORKER_URL = process.env.FILE_MANAGER_WORKER_URL;
const AUTH_SECRET = process.env.FILE_MANAGER_AUTH_SECRET;

export const StorageService = {
  /**
   * Request a short-lived URL to view or upload a file.
   */
  async getPresignedUrl(path: string, method: "GET" | "PUT" = "GET", expiry: number = 3600) {
    if (!FILE_WORKER_URL || !AUTH_SECRET) {
      throw new Error("Missing storage configuration");
    }

    const response = await fetch(
      `${FILE_WORKER_URL}/presigned-url?path=${encodeURIComponent(path)}&method=${method}&expiry=${expiry}`,
      {
        headers: {
          "Authorization": `Bearer ${AUTH_SECRET}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get presigned URL: ${await response.text()}`);
    }

    return await response.json() as { url: string; expiry: number };
  }
};
