'use server';

import { uploadToFirebaseSecure } from '@/app/actions/upload-secure';

export async function uploadFileAction(formData: FormData, idToken: string, chatId: string) {
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    try {
        console.log(`[Chat Upload] Securing attachment for chat ${chatId}`);
        
        // Store in a scoped path for the chat
        const destination = await uploadToFirebaseSecure(formData, `chats/${chatId}`);

        return {
            name: file.name,
            fullPath: destination, // This is now a storage path, not a public URL
            isLocal: false
        };

    } catch (error) {
        console.error("Secure Chat Upload Error:", error);
        throw new Error('Failed to upload file securely');
    }
}
