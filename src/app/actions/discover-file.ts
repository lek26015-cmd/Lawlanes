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
        
        if (files.length === 0) {
            console.log(`[Discover] No files found in chats/${chatId}/`);
            return { success: false, error: 'No files in this chat folder.' };
        }

        let foundFilePath = '';
        const extension = fileName.split('.').pop()?.toLowerCase();

        // Step 1: Exact name match (Fast)
        const exactMatch = files.find(f => f.name.split('/').pop() === fileName);
        if (exactMatch) {
            foundFilePath = exactMatch.name;
        } 
        
        // Step 2 & 3: Metadata and Temporal match (Requires fetching metadata)
        if (!foundFilePath) {
            console.log(`[Discover] Fetching metadata for ${files.length} files...`);
            
            // Optimization: Fetch metadata in parallel for efficiency
            // Limit to most recent 100 files to avoid massive overhead
            const recentFiles = files.slice(-100); 
            const metadataResults = await Promise.all(
                recentFiles.map(async (file) => {
                    try {
                        const [metadata] = await file.getMetadata();
                        return { file, metadata };
                    } catch (e) {
                        return { file, metadata: null };
                    }
                })
            );

            // Check metadata matches
            for (const { file, metadata } of metadataResults) {
                if (!metadata) continue;
                const originalName = metadata.metadata?.originalName;
                if (originalName === fileName || (typeof originalName === 'string' && originalName.toLowerCase() === fileName.toLowerCase())) {
                    foundFilePath = file.name;
                    break;
                }
            }

            // Check temporal matches
            if (!foundFilePath && messageTimestamp) {
                for (const { file, metadata } of metadataResults) {
                    if (!metadata || !metadata.timeCreated) continue;
                    
                    const fileCreated = new Date(metadata.timeCreated).getTime();
                    const diffSeconds = Math.abs(fileCreated - messageTimestamp) / 1000;
                    const fileExtension = file.name.split('.').pop()?.toLowerCase();

                    if (diffSeconds < 60 && fileExtension === extension) {
                        foundFilePath = file.name;
                        break;
                    }
                }
            }
            
            // Step 4: Ultimate Fallback (Most recent file with matching extension)
            if (!foundFilePath) {
                console.log(`[Discover] All specific matches failed. Looking for most recent .${extension} file.`);
                let mostRecentFile = null;
                let latestTime = 0;
                
                for (const { file, metadata } of metadataResults) {
                    if (!metadata || !metadata.timeCreated) continue;
                    const fileExtension = file.name.split('.').pop()?.toLowerCase();
                    if (fileExtension === extension) {
                        const fileCreated = new Date(metadata.timeCreated).getTime();
                        if (fileCreated > latestTime) {
                            latestTime = fileCreated;
                            mostRecentFile = file;
                        }
                    }
                }
                
                if (mostRecentFile) {
                    console.log(`[Discover] Ultimate fallback match found: ${mostRecentFile.name}`);
                    foundFilePath = mostRecentFile.name;
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

            return { 
                success: true, 
                filePath: foundFilePath,
                debug: {
                    filesCount: files.length,
                    filesList: files.slice(0, 5).map(f => f.name.split('/').pop())
                }
            };
        }

        return { 
            success: false, 
            error: 'File not found in storage.',
            debug: {
                filesCount: files.length,
                filesList: files.slice(0, 10).map(f => f.name.split('/').pop())
            }
        };

    } catch (error: any) {
        console.error("Error discovering file path:", error);
        return { success: false, error: error.message };
    }
}
