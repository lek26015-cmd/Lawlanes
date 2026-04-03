'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { Case, Milestone, CaseStatus } from '@/lib/types/billing-types';
import { revalidatePath } from 'next/cache';
import { callTyphoonAI } from '@/lib/typhoon';

/**
 * Fetch all legal cases for a specific lawyer
 */
export async function getLawyerLegalCases(lawyerId: string): Promise<Case[]> {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const casesSnap = await db.collection('legalCases')
            .where('lawyer_id', '==', lawyerId)
            .orderBy('updatedAt', 'desc')
            .get();

        return JSON.parse(JSON.stringify(casesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Case))));
    } catch (error) {
        console.error("Error fetching lawyer legal cases:", error);
        return [];
    }
}

/**
 * Fetch all milestones for a lawyer's cases (or specific case)
 */
export async function getCaseMilestones(caseId?: string, lawyerId?: string): Promise<Milestone[]> {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        let query: FirebaseFirestore.Query = db.collection('milestones');
        
        if (caseId) {
            query = query.where('case_id', '==', caseId);
        } else if (lawyerId) {
            // This requires an index or a different strategy if fetching all milestones for all lawyer's cases
            // For now, let's assume we fetch per case or we need to pass caseIds.
            // If we want all milestones for a lawyer, we might need lawyer_id in milestone doc too.
        }

        const snap = await query.get();
        return JSON.parse(JSON.stringify(snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Milestone))));
    } catch (error) {
        console.error("Error fetching milestones:", error);
        return [];
    }
}

/**
 * Update case status (e.g., for Kanban drag and drop)
 */
export async function updateCaseStatusAction(caseId: string, newStatus: CaseStatus) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        await db.collection('legalCases').doc(caseId).update({
            status: newStatus,
            updatedAt: Date.now()
        });
        
        revalidatePath('/[locale]/lawyer-dashboard/pipeline', 'page');
        return { success: true };
    } catch (error) {
        console.error("Error updating case status:", error);
        return { success: false, error: String(error) };
    }
}

/**
 * Add a new milestone to a case
 */
export async function addCaseMilestoneAction(caseId: string, title: string) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const newMilestone = {
            case_id: caseId,
            title,
            status: 'pending',
            createdAt: Date.now(),
            dueDate: Date.now() + 86400000 * 7 // Default 1 week
        };

        const docRef = await db.collection('milestones').add(newMilestone);
        
        revalidatePath('/[locale]/lawyer-dashboard/pipeline', 'page');
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding milestone:", error);
        return { success: false, error: String(error) };
    }
}

/**
 * Toggle milestone status
 */
export async function toggleMilestoneStatusAction(milestoneId: string, caseId: string) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const docRef = db.collection('milestones').doc(milestoneId);
        const doc = await docRef.get();
        
        if (!doc.exists) throw new Error('Milestone not found');
        
        const currentStatus = doc.data()?.status;
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        
        await docRef.update({ status: newStatus });
        
        revalidatePath('/[locale]/lawyer-dashboard/pipeline', 'page');
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        
        return { success: true, newStatus };
    } catch (error) {
        console.error("Error toggling milestone status:", error);
        return { success: false, error: String(error) };
    }
}

/**
 * Generate strategic advice for a case using AI
 */
export async function generateCaseStrategicAdviceAction(caseId: string, caseTitle: string, milestones: Milestone[]) {
    try {
        const milestoneSummary = milestones.length > 0 
            ? milestones.map(m => `- ${m.title} (${m.status === 'completed' ? 'เสร็จสิ้น' : 'รอดำเนินการ'})`).join('\n')
            : "ยังไม่มี Milestone";
            
        const prompt = `ในฐานะผู้ช่วยทนายความอาวุโส โปรดวิเคราะห์และให้คำแนะนำเชิงกลยุทธ์สำหรับคดี "${caseTitle}" 
โดยพิจารณาจากความคืบหน้าปัจจุบัน (Milestones):\n${milestoneSummary}\n\n
สิ่งที่ต้องการจากคุณ:
1. สรุปสถานะปัจจุบันของคดีสั้นๆ (Status Summary)
2. ระบุความเสี่ยงหรือข้อควรระวังทางกฎหมาย (Risk Assessment)
3. ข้อเสนอแนะ 3 ขั้นตอนถัดไปที่ควรทำ (Strategic Next Steps)

ตอบเป็นภาษาไทยที่เป็นทางการ สุภาพ และให้ข้อมูลที่เป็นประโยชน์มากที่สุดในฐานะพาร์ทเนอร์ของทนายความ`;

        const advice = await callTyphoonAI(prompt, "ตอบในรูปแบบ Markdown โดยมีหัวข้อชัดเจน ไม่ต้องสปอยล์คำตอบยาวเกินไป เน้นเนื้อหาที่นำไปใช้ได้จริง");
        
        return { success: true, advice };
    } catch (error) {
        console.error("Error generating strategic advice:", error);
        return { success: false, error: String(error) };
    }
}
