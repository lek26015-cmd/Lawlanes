'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Attempts to find a file path in a chat's storage folder if the metadata is missing.
 * This is a "healing" function for when metadata propagation fails.
 */
export async function discoverFilePathAction(chatId: string, fileName: string, messageTimestamp?: number) {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { success: false, error: 'Firebase Admin not initialized.' };
        const storage = adminApp.storage().bucket();
        const db = adminApp.firestore();

        console.log(`[Discover] Searching for "${fileName}" in chats/${chatId} (Msg TS: ${messageTimestamp})`);

        // 1. Search in the dedicated chat folder
        const [files] = await storage.getFiles({ prefix: `chats/${chatId}/` });
        
        let foundFilePath = '';
        const extension = fileName.split('.').pop()?.toLowerCase();

        // Step 1: Exact name match
        const exactMatch = files.find(f => f.name.split('/').pop() === fileName);
        if (exactMatch) {
            foundFilePath = exactMatch.name;
        } 
        
        // Step 2: Metadata match
        if (!foundFilePath) {
            for (const file of files) {
                const [metadata] = await file.getMetadata();
                const originalName = metadata.metadata?.originalName;
                if (originalName === fileName || (typeof originalName === 'string' && originalName.toLowerCase() === fileName.toLowerCase())) {
                    foundFilePath = file.name;
                    break;
                }
            }
        }

        // Step 3: Temporal match (Fallback for UUID files without metadata)
        if (!foundFilePath && messageTimestamp) {
            console.log(`[Discover] Trying temporal match for ${extension} around ${new Date(messageTimestamp).toISOString()}`);
            
            for (const file of files) {
                const [metadata] = await file.getMetadata();
                const fileCreated = new Date(metadata.timeCreated).getTime();
                const diffSeconds = Math.abs(fileCreated - messageTimestamp) / 1000;
                const fileExtension = file.name.split('.').pop()?.toLowerCase();

                // If created within 60 seconds and same extension, it's a very strong candidate
                if (diffSeconds < 60 && fileExtension === extension) {
                    console.log(`[Discover] Temporal match found: ${file.name} (Diff: ${diffSeconds}s)`);
                    foundFilePath = file.name;
                    break;
                }
            }
        }

        if (foundFilePath) {
            console.log(`[Discover] Found match: ${foundFilePath}`);
            
            // OPTIONAL: Repair the chat's vault (files array) if missing
            const chatRef = db.collection('chats').doc(chatId);
            const chatSnap = await chatRef.get();
            if (chatSnap.exists) {
                const data = chatSnap.data();
                const existingFiles = data?.files || [];
                const alreadyInVault = existingFiles.some((f: any) => f.url === foundFilePath);
                
                if (!alreadyInVault) {
                    await chatRef.update({
                        files: admin.firestore.FieldValue.arrayUnion({
                            name: fileName,
                            url: foundFilePath,
                            uploadedAt: Date.now(),
                            isHealed: true
                        })
                    });
                }
            }

            return { success: true, filePath: foundFilePath };
        }

        // 2. Fallback search (broad search if specific folder failed)
        // This is expensive but useful for debugging
        return { success: false, error: 'File not found in storage.' };

    } catch (error: any) {
        console.error("Error discovering file path:", error);
        return { success: false, error: error.message };
    }
}
