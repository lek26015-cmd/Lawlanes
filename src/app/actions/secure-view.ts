'use server';

import { requireUser, requireChatRole } from '@/lib/auth-guard';

/**
 * Generates a temporary signed URL for a file in Firebase Storage.
 * This should be used to display private documents to authorized users (Admins/Lawyers/Clients).
 * 
 * @param path The storage path of the file
 * @param chatId Optional chatId to verify access rights (Participant check)
 * @param expiresAt Optional expiration time (default 1 hour)
 * @returns The signed URL
 */
/**
 * Generates a temporary signed URL for a file in Firebase Storage.
 * This should be used to display private documents to authorized users (Admins/Lawyers/Clients).
 * 
 * @param path The storage path of the file
 * @param chatId Optional chatId to verify access rights (Participant check)
 * @param expiresAt Optional expiration time (default 1 hour)
 * @param disposition 'inline' (view in browser) or 'attachment' (download)
 * @returns The signed URL
 */
/** เอกสารมีค่า string ที่ "เท่ากับ" value ตรงตัวอยู่ที่ใดสักแห่ง (ไม่ใช่แค่เป็น substring) */
function docReferences(data: unknown, value: string, depth = 0): boolean {
    if (depth > 8 || data == null) return false;
    if (typeof data === 'string') return data === value;
    if (Array.isArray(data)) return data.some(v => docReferences(v, value, depth + 1));
    if (typeof data === 'object') return Object.values(data as Record<string, unknown>).some(v => docReferences(v, value, depth + 1));
    return false;
}

export async function getSecureDownloadUrl(
    path: string, 
    chatId?: string, 
    expiresAt: number = Date.now() + 3600000,
    disposition: 'inline' | 'attachment' = 'inline'
) {
    if (!path || typeof path !== 'string') return null;
    
    // If it's already a full URL (legacy R2 data), return as is
    if (path.startsWith('http')) return path;

    // --- SECURITY CHECK ---
    // เดิมมีช่องโหว่ซ้อนกันสามชั้น:
    //   1. base64_slip_{id} คืนรูปสลิปโอนเงิน (ชื่อ/เลขบัญชี) ได้โดยไม่ต้องล็อกอินเลย
    //   2. ส่ง chatId ของห้องตัวเองมา แล้วขอ path อะไรก็ได้ในบัคเก็ต (บัตรประชาชน/
    //      ใบอนุญาตของทนายคนอื่นใน lawyer_documents/...) — เช็คแค่ว่าอยู่ในห้องนั้น
    //      ไม่เคยเช็คว่าไฟล์เป็นของห้องนั้น และสิทธิ์ห้องดูจาก participants ที่โดนยัดได้
    //   3. expiresAt มาจากผู้เรียก → ขอลิงก์อายุ 7 วันได้
    // ตอนนี้: ต้องล็อกอิน · ไฟล์ต้องอยู่ในโฟลเดอร์ chats/{chatId}/ หรือถูกอ้างถึงใน
    // เอกสารห้องนั้นจริง · สิทธิ์ห้องใช้ requireChatRole · อายุลิงก์ไม่เกิน 1 ชั่วโมง
    let requesterId: string, isAdmin: boolean, app;
    try {
        const session = await requireUser();
        requesterId = session.uid;
        isAdmin = session.token.admin === true || session.token.role === 'admin';
        app = session.adminApp;
    } catch {
        console.warn(`[Security] Unauthorized download attempt: No session for ${path}`);
        return null;
    }
    const db = app.firestore();

    const MAX_TTL_MS = 3600000;
    const now = Date.now();
    const safeExpiresAt = Number.isFinite(expiresAt) ? Math.min(Math.max(expiresAt, now + 60000), now + MAX_TTL_MS) : now + MAX_TTL_MS;

    // path ของไฟล์ในห้องแชทบอก chatId อยู่แล้ว — ใช้ตัวนี้แทน chatId ที่ส่งมา
    // (กระดิ่งแจ้งเตือนเรียกโดยไม่ส่ง chatId เดิมจึงเปิดไฟล์ไม่ได้เลยถ้าไม่ใช่แอดมิน)
    // ชื่อ object ใน GCS ไม่ถูก normalize อยู่แล้ว แต่ปฏิเสธ '..' ไว้ก่อนกันพลาดตอนเทียบโฟลเดอร์
    if (path.includes('..')) return null;
    const normalizedForCheck = path.replace(/^\/+/, '');
    const chatFolderMatch = normalizedForCheck.match(/^chats\/([A-Za-z0-9_-]+)\//);
    if (chatFolderMatch && chatId && chatFolderMatch[1] !== chatId) {
        console.warn(`[Security] Path ${path} does not belong to chat ${chatId}`);
        return null;
    }
    const effectiveChatId = chatFolderMatch ? chatFolderMatch[1] : chatId;

    if (!isAdmin) {
        if (!effectiveChatId) {
            console.warn(`[Security] Non-admin attempt to access generic file without chatId.`);
            return null;
        }
        let chatData: FirebaseFirestore.DocumentData;
        try {
            ({ chatData } = await requireChatRole(effectiveChatId));
        } catch {
            console.error(`[Security] User ${requesterId} is not a party of chat ${effectiveChatId}`);
            return null;
        }
        // ไฟล์นอกโฟลเดอร์ห้อง (สลิป / ไฟล์รุ่นเก่า) ต้องถูกอ้างถึงในเอกสารห้องนั้นจริง
        if (!chatFolderMatch && !docReferences(chatData, path)) {
            console.warn(`[Security] Path ${path} is not referenced by chat ${effectiveChatId}`);
            return null;
        }
    }

    // Handle Base64 from Firestore SlipImages
    if (path.startsWith('base64_slip_')) {
        const id = path.replace('base64_slip_', '');
        try {
            const docSnap = await db.collection('slipImages').doc(id).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                if (data && data.base64Data) {
                    return data.base64Data as string;
                }
            }
        } catch (error) {
            console.error("Error fetching base64 slip:", error);
            return null;
        }
        return null;
    }

    const bucketName = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/"/g, '').trim();
    const bucket = bucketName ? app.storage().bucket(bucketName) : app.storage().bucket();
    
    try {
        // Normalize path: remove leading slash and bucket name if it's a full GS path
        let normalizedPath = path.startsWith('/') ? path.substring(1) : path;
        if (normalizedPath.startsWith(`gs://${bucket.name}/`)) {
            normalizedPath = normalizedPath.replace(`gs://${bucket.name}/`, '');
        } else if (normalizedPath.startsWith(`${bucket.name}/`)) {
            normalizedPath = normalizedPath.replace(`${bucket.name}/`, '');
        }

        let file = bucket.file(normalizedPath);
        let [exists] = await file.exists();

        // Fallback search if not found
        // ค้นต่อเฉพาะในโฟลเดอร์ของห้องนี้ — เดิมไล่ไปหา lawyer_documents/ และ uploads/
        // ด้วย ซึ่งเป็นไฟล์ของคนอื่นที่ไม่ได้ผ่านการตรวจสิทธิ์ข้างบน
        if (!exists && effectiveChatId) {
            console.log(`[Secure View] File not found at ${normalizedPath}, searching fallbacks...`);
            const fileName = normalizedPath.split('/').pop()!;
            const possiblePaths = [
                `chats/${effectiveChatId}/${fileName}`,
            ];

            for (const p of possiblePaths) {
                if (p === normalizedPath) continue;
                const f = bucket.file(p);
                const [ex] = await f.exists();
                if (ex) {
                    console.log(`[Secure View] Found file at fallback path: ${p}`);
                    file = f;
                    exists = true;
                    break;
                }
            }
        }

        if (!exists) {
            console.error(`[Secure View] File not found after all attempts: ${normalizedPath}`);
            return null;
        }

        const [metadata] = await file.getMetadata();
        const contentType = metadata.contentType || 'application/octet-stream';
        const fileName = normalizedPath.split('/').pop() || 'document';

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: new Date(safeExpiresAt),
            queryParams: {
                'response-content-type': contentType,
                'response-content-disposition': disposition === 'attachment' 
                    ? `attachment; filename="${fileName}"` 
                    : 'inline',
            }
        });
        return url;

    } catch (error) {
        console.error("Error generating signed URL:", error);
        return null;
    }
}


