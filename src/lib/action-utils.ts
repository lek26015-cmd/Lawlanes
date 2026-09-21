'use server';

import { initAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Standard error message for server actions.
 */
export const DEFAULT_ERROR_MESSAGE = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

/**
 * Returns a standardized error result for server actions.
 */
export function errorResult(message: string = DEFAULT_ERROR_MESSAGE) {
    return { success: false as const, error: message };
}

/**
 * Returns a standardized success result for server actions.
 */
export function successResult<T extends Record<string, any>>(data?: T) {
    return { success: true as const, ...data };
}

/**
 * Initializes Firebase Admin and returns the Firestore instance.
 * Throws if initialization fails.
 */
export async function getAdminDb() {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    return adminApp.firestore();
}

/**
 * Initializes Firebase Admin and returns both the app and db.
 * Use when you need access to Auth, Storage, etc.
 */
export async function getAdminApp() {
    const adminApp = await initAdmin();
    if (!adminApp) {
        throw new Error('Firebase Admin not initialized.');
    }
    return { app: adminApp, db: adminApp.firestore() };
}

/**
 * Safely serializes Firestore data for client consumption.
 * Handles Timestamps and circular references.
 */
export function serializeData<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
}

/**
 * Calculates installment totals from an installments array.
 * Consolidates the parseFloat(String(inst.amount).replace(...)) pattern
 * that was duplicated 8 times across the codebase.
 */
export function calculateInstallmentTotals(installments: any[]) {
    const paidInstallments = installments.filter((inst: any) => inst.status === 'paid').length;
    const totalPaid = installments
        .filter((inst: any) => inst.status === 'paid')
        .reduce((sum: number, inst: any) => {
            const amt = parseFloat(String(inst.amount).replace(/,/g, ''));
            return sum + (isNaN(amt) ? 0 : amt);
        }, 0);
    return { paidInstallments, totalPaid };
}

/**
 * Parses an installment amount string to a number.
 */
export function parseInstallmentAmount(amount: any): number {
    const amt = parseFloat(String(amount).replace(/,/g, ''));
    return isNaN(amt) ? 0 : amt;
}
