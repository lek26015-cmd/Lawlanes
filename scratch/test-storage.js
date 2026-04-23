const { initAdmin } = require('../src/lib/firebase-admin');
const { getStorage } = require('firebase-admin/storage');

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
        
        try {
            const [files] = await bucket.getFiles({ maxResults: 1 });
            console.log('Successfully listed files. Bucket is accessible.');
        } catch (storageErr) {
            console.error('Storage access failed:', storageErr.message);
        }
    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

test();
