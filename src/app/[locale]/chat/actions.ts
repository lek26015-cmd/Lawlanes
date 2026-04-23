'use server';

export async function uploadFileAction(formData: FormData, idToken: string, chatId: string) {
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    try {
        console.log(`[Chat Upload] Securing attachment for chat ${chatId} using R2`);
        
        // Store in a scoped path for the chat using R2 (more stable on Vercel)
        const { uploadToR2 } = await import('@/app/actions/upload-r2');
        const publicUrl = await uploadToR2(formData, `chats/${chatId}`);

        return {
            name: file.name,
            fullPath: publicUrl, 
            isLocal: false
        };

    } catch (error: any) {
        console.error("Chat Upload Error (R2):", error);
        throw new Error(`Failed to upload file: ${error.message}`);
    }
}
