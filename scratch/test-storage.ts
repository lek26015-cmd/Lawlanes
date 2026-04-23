import { initAdmin } from './src/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';

async function test() {
    try {
        const app = await initAdmin();
        if (!app) {
            console.error('App init failed');
            return;
        }
        console.log('App init success');
        const bucket = getStorage(app).bucket();
        console.log('Bucket name:', bucket.name);
        
        const [files] = await bucket.getFiles({ maxResults: 1 });
        console.log('Successfully listed files. Bucket is accessible.');
    } catch (err: any) {
        console.error('Test failed:', err.message);
    }
}

test();
