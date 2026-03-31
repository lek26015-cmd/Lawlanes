
import * as dotenv from 'dotenv';
import path from 'path';
import { initAdmin } from '../src/lib/firebase-admin';

// Load environment variables from .env or .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verify() {
    console.log("--- Verifying Firebase Admin Initialization ---");
    try {
        const app = await initAdmin();
        if (app) {
            console.log("✅ SUCCESS: Firebase Admin initialized successfully.");
            process.exit(0);
        } else {
            console.error("❌ FAIL: initAdmin returned null.");
            process.exit(1);
        }
    } catch (err: any) {
        console.error("❌ CRITICAL ERROR during initialization:");
        console.error(err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    }
}

verify();
