'use server';

import { requireChatRole } from '@/lib/auth-guard';

export async function uploadFileAction(formData: FormData, idToken: string, chatId: string) {
    // ต้องเป็นคู่กรณีของห้องนี้ — เดิมเช็คแค่ว่าล็อกอิน (ใน uploadToFirebaseSecure) ใครก็อัปไฟล์
    // เข้าโฟลเดอร์ chats/{chatId} ของห้องคนอื่นได้ แล้ว discoverFilePathAction ของห้องนั้น
    // จะ "ซ่อม" ไฟล์แปลกปลอมเข้า files ของห้องให้เอง (idToken ไม่ได้ใช้ — ตัวตนมาจาก session)
    await requireChatRole(chatId);

    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    try {
        console.log(`[Chat Upload] Securing attachment for chat ${chatId} using Firebase Storage`);
        
        // Store in a scoped path for the chat using Firebase Storage (Secure)
        const { uploadToFirebaseSecure } = await import('@/app/actions/upload');
        const filePath = await uploadToFirebaseSecure(formData, `chats/${chatId}`);

        return {
            name: file.name,
            fullPath: filePath, // Store the path, client will use getSecureDownloadUrl
            isLocal: false
        };

    } catch (error: any) {
        console.error("Chat Upload Error (Firebase):", error);
        throw new Error(`Failed to upload file: ${error.message}`);
    }
}
