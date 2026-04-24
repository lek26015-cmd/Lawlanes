'use server';

export async function uploadFileAction(formData: FormData, idToken: string, chatId: string) {
    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    try {
        console.log(`[Chat Upload] Securing attachment for chat ${chatId} using Firebase Storage`);
        
        // Store in a scoped path for the chat using Firebase Storage (Secure)
        const { uploadToFirebaseSecure } = await import('@/app/actions/upload-secure');
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
