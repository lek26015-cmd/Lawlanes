/**
 * Utility for End-to-End Encryption (E2EE) using Web Crypto API.
 * Uses RSA-OAEP for encrypting messages.
 */

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Generates an RSA-OAEP 2048 key pair.
 */
export async function generateChatKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true, // extractable
        ["encrypt", "decrypt"]
    );
}

/**
 * Exports a public key to Base64 (SPKI format).
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return arrayBufferToBase64(exported);
}

/**
 * Exports a private key to Base64 (PKCS#8 format).
 */
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("pkcs8", key);
    return arrayBufferToBase64(exported);
}

/**
 * Imports a public key from Base64.
 */
export async function importPublicKey(base64: string): Promise<CryptoKey> {
    const binary = base64ToArrayBuffer(base64);
    return await window.crypto.subtle.importKey(
        "spki",
        binary,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["encrypt"]
    );
}

/**
 * Imports a private key from Base64.
 */
export async function importPrivateKey(base64: string): Promise<CryptoKey> {
    const binary = base64ToArrayBuffer(base64);
    return await window.crypto.subtle.importKey(
        "pkcs8",
        binary,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["decrypt"]
    );
}

/**
 * Encrypts a message with a random AES key, then wraps that key with RSA public keys.
 */
export async function encryptHybrid(message: string, publicKeys: { [userId: string]: CryptoKey }): Promise<string> {
    const enc = new TextEncoder();
    const encoded = enc.encode(message);

    // 1. Generate AES key
    const aesKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    // 2. Encrypt message with AES
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encoded
    );

    // 3. Export and wrap AES key with RSA
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const wrappedKeys: { [userId: string]: string } = {};

    for (const [userId, pubKey] of Object.entries(publicKeys)) {
        const wrapped = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            pubKey,
            exportedAesKey
        );
        wrappedKeys[userId] = arrayBufferToBase64(wrapped);
    }

    return JSON.stringify({
        version: "2",
        ciphertext: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv.buffer),
        wrappedKeys
    });
}

/**
 * Decrypts a hybrid-encrypted message.
 */
export async function decryptHybrid(encryptedData: string, userId: string, privateKey: CryptoKey): Promise<string> {
    try {
        const data = JSON.parse(encryptedData);
        if (data.version !== "2") throw new Error("Unsupported E2EE version");

        const wrappedAesKeyBase64 = data.wrappedKeys[userId];
        if (!wrappedAesKeyBase64) throw new Error("Message not encrypted for this user");

        // 1. Unwrap AES key
        const wrappedAesKey = base64ToArrayBuffer(wrappedAesKeyBase64);
        const unwrappedAesKeyBuffer = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            wrappedAesKey
        );

        const aesKey = await window.crypto.subtle.importKey(
            "raw",
            unwrappedAesKeyBuffer,
            "AES-GCM",
            true,
            ["decrypt"]
        );

        // 2. Decrypt message
        const iv = base64ToArrayBuffer(data.iv);
        const ciphertext = base64ToArrayBuffer(data.ciphertext);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            aesKey,
            ciphertext
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (err) {
        console.error("Hybrid decryption failed:", err);
        return "[Message could not be decrypted]";
    }
}
