const fs = require('fs');
const path = require('path');

const ADMIN_DIR = '/Users/tawanberkfah/Documents/GitHub/lawslane-admin';
const MAIN_APP_DIR = '/Users/tawanberkfah/Documents/GitHub/Lawslane';

// 1. Copy upload-cloudflare-images.ts
const cfActionSource = path.join(MAIN_APP_DIR, 'src/app/actions/upload-cloudflare-images.ts');
const cfActionDest = path.join(ADMIN_DIR, 'src/app/actions/upload-cloudflare-images.ts');

if (fs.existsSync(cfActionSource)) {
    fs.copyFileSync(cfActionSource, cfActionDest);
    console.log('✅ Copied upload-cloudflare-images.ts');
}

// 2. Copy cloudflare-images.ts helper
const cfHelperSource = path.join(MAIN_APP_DIR, 'src/lib/cloudflare-images.ts');
const cfHelperDest = path.join(ADMIN_DIR, 'src/lib/cloudflare-images.ts');
if (fs.existsSync(cfHelperSource)) {
    fs.copyFileSync(cfHelperSource, cfHelperDest);
    console.log('✅ Copied cloudflare-images.ts helper');
}

// 3. Update the 6 pages
const pagesToUpdate = [
    'src/app/ads/new/page.tsx',
    'src/app/ads/[id]/edit/page.tsx',
    'src/app/forms/new/page.tsx',
    'src/app/forms/[id]/edit/page.tsx',
    'src/app/landing-pages/new/page.tsx',
    'src/app/landing-pages/[id]/edit/page.tsx'
];

pagesToUpdate.forEach(pagePath => {
    const fullPath = path.join(ADMIN_DIR, pagePath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/import \{ uploadToR2 \} from '([^']+upload-r2)'/g, "import { uploadToCloudflareImages } from '@/app/actions/upload-cloudflare-images'");
        content = content.replace(/await uploadToR2\(/g, "await uploadToCloudflareImages(");
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Updated ${pagePath}`);
    }
});

// 4. Harden upload-r2.ts
const uploadR2Path = path.join(ADMIN_DIR, 'src/app/actions/upload-r2.ts');
if (fs.existsSync(uploadR2Path)) {
    const hardenedContent = `'use server';

import { uploadToCloudflareImages } from '@/app/actions/upload-cloudflare-images';

/**
 * @deprecated DO NOT USE — R2 public storage is permanently disabled for security.
 * All uploads now route through Cloudflare Images (private, CDN-backed).
 */
export async function uploadToR2(formData: FormData, folder: string = 'uploads') {
    console.warn(\`[SECURITY] uploadToR2 called with folder="\${folder}" — redirecting to Cloudflare Images\`);
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }
    return await uploadToCloudflareImages(formData);
}
`;
    fs.writeFileSync(uploadR2Path, hardenedContent);
    console.log('✅ Hardened upload-r2.ts');
}

// 5. Harden next.config.ts
const nextConfigPath = path.join(ADMIN_DIR, 'next.config.ts');
if (fs.existsSync(nextConfigPath)) {
    let configContent = fs.readFileSync(nextConfigPath, 'utf8');
    // Remove the r2 remote pattern block
    configContent = configContent.replace(/\{\s*protocol:\s*'https',\s*hostname:\s*'\*\.r2\.dev',[\s\S]*?pathname:\s*'\/\*\*',\s*\},/g, '');
    
    // Remove r2 from CSP img-src
    configContent = configContent.replace(/https:\/\/\*\.r2\.dev\s*/g, '');
    
    // Ensure imagedelivery.net is in CSP img-src
    if (!configContent.includes('imagedelivery.net')) {
        configContent = configContent.replace(/(img-src [^;]+)/, "$1 https://imagedelivery.net ");
    }
    
    fs.writeFileSync(nextConfigPath, configContent);
    console.log('✅ Hardened next.config.ts');
}
