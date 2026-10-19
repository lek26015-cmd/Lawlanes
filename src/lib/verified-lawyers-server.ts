import 'server-only';
import { initAdmin } from '@/lib/firebase-admin';
import type { RegistryLawyer } from '@/lib/types';

/**
 * อ่านทะเบียนทนาย (verifiedLawyers) ผ่าน Admin SDK เท่านั้น
 *
 * firestore.rules ปิด `list` ของ verifiedLawyers แล้ว — เดิมเปิด `read: if true`
 * ใครก็ดึงรายชื่อทั้ง collection ได้ในครั้งเดียว (ยิ่งนำเข้ารายชื่อจากประกาศสภาทนายความ
 * หลายพันคน ยิ่งเสี่ยง) ฝั่งหน้าเว็บจึงเหลือแค่การค้นแบบระบุชื่อ/เลข (verify-registry-actions.ts)
 * และตัวเลขสรุปที่ server คำนวณให้
 */

// status ที่แสดงบนหน้าเว็บ: active = มีเลขจากทะเบียน · announced = มีชื่อในประกาศรับใบอนุญาต (ไม่มีเลข)
export const SEARCHABLE_STATUSES = ['active', 'announced'];

/** ฟิลด์ที่ส่งออกสู่สาธารณะ — allowlist สร้างทีละฟิลด์ ไม่ spread */
export interface PublicRegistryLawyer {
    id: string;
    prefix: string;
    firstName: string;
    lastName: string;
    licenseNumber: string;
    licenseType: string;
    province: string;
    status: string;
    announcementDate: string;
    sourceUrl: string;
}

export function toPublicRegistryLawyer(id: string, d: FirebaseFirestore.DocumentData): PublicRegistryLawyer {
    return {
        id,
        prefix: String(d.prefix || ''),
        firstName: String(d.firstName || ''),
        lastName: String(d.lastName || ''),
        licenseNumber: String(d.licenseNumber || '').trim(),
        licenseType: String(d.licenseType || ''),
        province: String(d.province || ''),
        status: String(d.status || 'active'),
        announcementDate: String(d.announcementDate || ''),
        sourceUrl: typeof d.sourceUrl === 'string' && d.sourceUrl.startsWith('https://') ? d.sourceUrl : '',
    };
}

/**
 * ทนายจากทะเบียนที่มีเลขใบอนุญาตแต่ยังไม่ได้สมัคร Lawslane — แสดงในหน้า /lawyers
 * (แทน getRegistryLawyers ใน src/lib/data.ts ที่ยิง client SDK)
 */
export async function getRegistryLawyersForDirectory(
    approvedLicenseNumbers: Set<string>,
    limitCount = 100,
): Promise<RegistryLawyer[]> {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return [];
        const snap = await adminApp.firestore().collection('verifiedLawyers')
            .where('status', '==', 'active')
            .limit(limitCount + approvedLicenseNumbers.size)
            .get();

        const results: RegistryLawyer[] = [];
        for (const doc of snap.docs) {
            const p = toPublicRegistryLawyer(doc.id, doc.data());
            if (!p.licenseNumber || approvedLicenseNumbers.has(p.licenseNumber)) continue;
            results.push({
                id: p.id,
                prefix: p.prefix,
                firstName: p.firstName,
                lastName: p.lastName,
                licenseNumber: p.licenseNumber,
                licenseType: p.licenseType,
                province: p.province,
                status: p.status,
                source: String(doc.get('source') || 'document_import'),
            });
            if (results.length >= limitCount) break;
        }
        return results;
    } catch (error) {
        console.error('Error fetching registry lawyers:', error);
        return [];
    }
}

/** จำนวนรายชื่อในทะเบียน + เวลาที่อัปเดตล่าสุด (ISO) สำหรับหัวหน้าตรวจสอบทนาย */
export async function getRegistryStats(): Promise<{ count: number; lastUpdated: string | null }> {
    try {
        const adminApp = await initAdmin();
        if (!adminApp) return { count: 0, lastUpdated: null };
        const col = adminApp.firestore().collection('verifiedLawyers');
        const [countSnap, latestSnap] = await Promise.all([
            col.where('status', 'in', SEARCHABLE_STATUSES).count().get(),
            col.orderBy('updatedAt', 'desc').limit(1).get(),
        ]);
        const raw = latestSnap.docs[0]?.get('updatedAt');
        const date = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
        return {
            count: countSnap.data().count,
            lastUpdated: date && !isNaN(date.getTime()) ? date.toISOString() : null,
        };
    } catch (error) {
        console.error('Error fetching registry stats:', error);
        return { count: 0, lastUpdated: null };
    }
}
