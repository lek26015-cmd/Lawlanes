'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Attempts to find a file path in a chat's storage folder if the metadata is missing.
 * This is a "healing" function for when metadata propagation fails.
 */
export async function discoverFilePathAction(chatId: string, fileName: string) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const storage = adminApp.storage().bucket();
        const db = adminApp.firestore();

        console.log(`[Discover] Searching for "${fileName}" in chats/${chatId}`);

        // 1. Search in the dedicated chat folder
        const [files] = await storage.getFiles({ prefix: `chats/${chatId}/` });
        
        // Find exact or partial match
        const foundFile = files.find(f => {
            const name = f.name.split('/').pop();
            return name === fileName || name?.toLowerCase() === fileName.toLowerCase();
        });

        if (foundFile) {
            console.log(`[Discover] Found match: ${foundFile.name}`);
            
            // OPTIONAL: Repair the chat's vault (files array) if missing
            const chatRef = db.collection('chats').doc(chatId);
            const chatSnap = await chatRef.get();
            if (chatSnap.exists) {
                const data = chatSnap.data();
                const existingFiles = data?.files || [];
                const alreadyInVault = existingFiles.some((f: any) => f.url === foundFile.name);
                
                if (!alreadyInVault) {
                    await chatRef.update({
                        files: admin.firestore.FieldValue.arrayUnion({
                            name: fileName,
                            url: foundFile.name,
                            uploadedAt: Date.now(),
                            isHealed: true
                        })
                    });
                }
            }

            return { success: true, filePath: foundFile.name };
        }

        // 2. Fallback search (broad search if specific folder failed)
        // This is expensive but useful for debugging
        return { success: false, error: 'File not found in storage.' };

    } catch (error: any) {
        console.error("Error discovering file path:", error);
        return { success: false, error: error.message };
    }
}
