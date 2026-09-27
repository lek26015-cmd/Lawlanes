/**
 * ย้ายบัตรประชาชน / ใบอนุญาตทนาย ที่ business.lawslane.com เคยอัปขึ้น R2 (bucket สาธารณะ)
 * ไปไว้ Firebase Storage แบบส่วนตัว lawyer_documents/{uid}/ (storage.rules: เจ้าของ + แอดมิน)
 * แล้วเปลี่ยน lawyerProfiles.idCardUrl / licenseUrl เป็น storage path และลบไฟล์ออกจาก R2
 *
 * ลบจาก R2 เฉพาะไฟล์ที่ คัดลอกเข้า Firebase Storage + อัปเดต Firestore สำเร็จแล้วเท่านั้น
 * ไม่พิมพ์ URL หรือข้อมูลส่วนตัวลง console — แค่ doc id กับจำนวน
 *
 * Usage (จากโฟลเดอร์ repo Lawslane, ใช้ .env.local ที่มี FIREBASE_* และ R2_*):
 *   node scripts/migrate-lawyer-docs-from-r2.js            # dry run: นับอย่างเดียว ไม่แก้อะไร
 *   node scripts/migrate-lawyer-docs-from-r2.js --apply    # ย้ายจริง + ลบจาก R2
 */
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const apply = process.argv.includes('--apply');
const FIELDS = ['idCardUrl', 'licenseUrl'];
const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const required = [
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
    console.error(`Missing env in .env.local: ${missing.join(', ')}`);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim(),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
});
const db = admin.firestore();
const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.replace(/"/g, '').trim());

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

// ไฟล์ที่ business-landing อัปไว้: {R2_PUBLIC_URL}/lawyer-documents/{uid}/{id-card|license}/{ts}_{uuid}.{ext}
function r2KeyOf(url) {
    if (typeof url !== 'string' || !url.startsWith('http')) return null;
    try {
        const key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
        return key.startsWith('lawyer-documents/') ? key : null;
    } catch {
        return null;
    }
}

async function main() {
    console.log(apply ? '=== APPLY: ย้ายจริง + ลบจาก R2 ===' : '=== DRY RUN: นับอย่างเดียว (ใส่ --apply เพื่อย้ายจริง) ===');
    const snap = await db.collection('lawyerProfiles').get();
    let found = 0, moved = 0, failed = 0;
    const otherHttp = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        const fieldUpdates = {};
        const r2Keys = [];

        for (const field of FIELDS) {
            const value = data[field];
            const key = r2KeyOf(value);
            if (!key) {
                if (typeof value === 'string' && value.startsWith('http')) otherHttp.push(`${doc.id}.${field}`);
                continue;
            }
            found++;
            if (!apply) {
                console.log(`would move ${doc.id}.${field}`);
                continue;
            }
            try {
                const obj = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
                const body = Buffer.from(await obj.Body.transformToByteArray());
                const contentType = obj.ContentType || 'application/octet-stream';
                const dest = `lawyer_documents/${doc.id}/${crypto.randomUUID()}.${EXT[contentType] || 'bin'}`;
                await bucket.file(dest).save(body, {
                    metadata: { contentType, metadata: { migratedFrom: 'r2', field } },
                    public: false,
                });
                fieldUpdates[field] = dest;
                r2Keys.push(key);
            } catch (e) {
                failed++;
                console.error(`FAILED copy ${doc.id}.${field}: ${e.name || 'Error'}`);
            }
        }

        if (Object.keys(fieldUpdates).length === 0) continue;

        try {
            await doc.ref.update({ ...fieldUpdates, documentsMigratedAt: admin.firestore.FieldValue.serverTimestamp() });
        } catch (e) {
            failed += r2Keys.length;
            console.error(`FAILED update ${doc.id}: ${e.name || 'Error'} (ไม่ลบไฟล์บน R2)`);
            continue;
        }
        for (const key of r2Keys) {
            try {
                await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
                moved++;
            } catch (e) {
                failed++;
                console.error(`FAILED delete from R2 ${doc.id}: ${e.name || 'Error'} (คัดลอก + อัปเดตแล้ว ลบซ้ำได้ภายหลัง)`);
            }
        }
        console.log(`moved ${doc.id} (${Object.keys(fieldUpdates).join(', ')})`);
    }

    console.log(`\nทนายทั้งหมด: ${snap.size} · เอกสารบน R2: ${found} · ย้ายและลบแล้ว: ${moved} · ล้มเหลว: ${failed}`);
    if (otherHttp.length) {
        console.log(`\n⚠️ ช่องเอกสารที่เป็นลิงก์ http แต่ไม่ใช่ lawyer-documents/ บน R2 (ตรวจด้วยมือ): ${otherHttp.length}`);
        otherHttp.forEach((x) => console.log(`  ${x}`));
    }
}

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
