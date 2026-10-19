'use server';

import { initAdmin } from '@/lib/firebase-admin';
import {
    SEARCHABLE_STATUSES,
    toPublicRegistryLawyer,
    type PublicRegistryLawyer,
} from '@/lib/verified-lawyers-server';

const MAX_INPUT = 100;

/**
 * ค้นทะเบียนทนาย (verifiedLawyers) สำหรับหน้า /verify-lawyer — ผ่าน Admin SDK
 * เพราะ rules ปิด list จาก browser แล้ว (ดู src/lib/verified-lawyers-server.ts)
 *
 * ค้นได้เฉพาะแบบระบุตรง ๆ: เลขใบอนุญาต หรือ ชื่อ/สกุลแบบ exact match
 * ไม่มีทางดึงรายชื่อทั้งก้อน · ผลลัพธ์จำกัด 5–10 รายการต่อคำค้น
 */
export async function searchRegistryAction(params: {
    licenseNumber?: string;
    name?: string;
}): Promise<PublicRegistryLawyer[]> {
    const licenseNumber = String(params.licenseNumber || '').trim().slice(0, MAX_INPUT);
    const name = String(params.name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_INPUT);
    if (!licenseNumber && !name) return [];

    try {
        const adminApp = await initAdmin();
        if (!adminApp) return [];
        const col = adminApp.firestore().collection('verifiedLawyers');

        if (licenseNumber) {
            const snap = await col
                .where('licenseNumber', '==', licenseNumber)
                .where('status', '==', 'active')
                .limit(5)
                .get();
            return snap.docs.map((d) => toPublicRegistryLawyer(d.id, d.data()));
        }

        const names = name.split(' ');
        const queries = names.length >= 2
            ? [col.where('firstName', '==', names[0]).where('lastName', '==', names.slice(1).join(' '))]
            : [col.where('firstName', '==', names[0]), col.where('lastName', '==', names[0])];

        const snaps = await Promise.all(
            queries.map((q) => q.where('status', 'in', SEARCHABLE_STATUSES).limit(10).get()),
        );
        const seen = new Set<string>();
        const results: PublicRegistryLawyer[] = [];
        for (const snap of snaps) {
            for (const d of snap.docs) {
                if (seen.has(d.id)) continue;
                seen.add(d.id);
                results.push(toPublicRegistryLawyer(d.id, d.data()));
            }
        }
        return results;
    } catch (error) {
        console.error('Error searching registry:', error);
        return [];
    }
}
