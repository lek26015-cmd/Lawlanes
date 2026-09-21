'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { Case, Milestone, CaseStatus, CaseEvidence, CaseWitness } from '@/lib/types/billing-types';
import { revalidatePath } from 'next/cache';
import { callTyphoonAI } from '@/lib/typhoon';
import { NotificationService } from '@/services/notification-service';
import { requireUser, requireChatRole, AuthError } from '@/lib/auth-guard';
import { uploadToR2 } from '@/app/actions/upload';
import { generateWitnessListPdf } from '@/lib/witness-list-pdf';
import { v4 as uuidv4 } from 'uuid';

/**
 * ผู้เรียกต้องเป็นทนายเจ้าของเคสใน legalCases (หรือแอดมิน)
 * legalCases เก็บเจ้าของไว้ที่ฟิลด์ lawyer_id ซึ่งเป็น auth uid
 */
async function requireCaseOwner(caseId: string) {
    const { uid, token, adminApp } = await requireUser();
    const db = adminApp.firestore();
    const isAdmin = token.admin === true || token.role === 'admin';

    const snap = await db.collection('legalCases').doc(caseId).get();
    if (!snap.exists) {
        throw new AuthError('Case not found', 404);
    }
    const data = snap.data() || {};
    if (!isAdmin && data.lawyer_id !== uid && data.lawyerId !== uid) {
        throw new AuthError('Forbidden: not your case', 403);
    }
    return { uid, isAdmin, adminApp, db, caseData: data };
}

// ============================================================================
// Evidence — เดิม case/[id]/page.tsx โชว์รายการพยานหลักฐานแบบ hardcode ทั้งหมด
// (ทั้งในแท็บ "พยานหลักฐาน" และในตัวข้อเท็จจริงของวิซาร์ดจัดทำบัญชีพยาน เช่น
// "EV-1021"/"EV-1045") ไม่เคยมีการอัปโหลดไฟล์จริงเลย ตอนนี้เก็บเป็น subcollection จริง
// `legalCases/{caseId}/evidence` พร้อมไฟล์จริงบน R2 (โฟลเดอร์ case_evidence/{caseId})
// ============================================================================

export async function getCaseEvidenceAction(caseId: string): Promise<CaseEvidence[]> {
    const { db } = await requireCaseOwner(caseId);
    const snap = await db.collection('legalCases').doc(caseId).collection('evidence')
        .orderBy('createdAt', 'desc')
        .get();
    return JSON.parse(JSON.stringify(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function addEvidenceAction(caseId: string, formData: FormData) {
    const { uid, db } = await requireCaseOwner(caseId);

    const title = String(formData.get('title') || '').trim();
    const fact = String(formData.get('fact') || '').trim();
    const file = formData.get('file') as File | null;

    if (!title || !file) {
        return { success: false, error: 'กรุณาระบุชื่อพยานหลักฐานและเลือกไฟล์' };
    }

    try {
        const fileUrl = await uploadToR2(formData, `case_evidence/${caseId}`);
        const docRef = await db.collection('legalCases').doc(caseId).collection('evidence').add({
            title,
            fact,
            fileUrl,
            fileType: file.type || 'application/octet-stream',
            uploadedBy: uid,
            createdAt: Date.now(),
        });
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error('Error adding case evidence:', error);
        return { success: false, error: error.message || 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function updateEvidenceFactAction(caseId: string, evidenceId: string, fact: string) {
    const { db } = await requireCaseOwner(caseId);
    try {
        await db.collection('legalCases').doc(caseId).collection('evidence').doc(evidenceId).update({ fact });
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        return { success: true };
    } catch (error) {
        console.error('Error updating evidence fact:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function deleteEvidenceAction(caseId: string, evidenceId: string) {
    const { db } = await requireCaseOwner(caseId);
    try {
        // ไม่ลบไฟล์บน R2 ด้วย — เก็บไว้เป็นหลักฐานว่าเคยมีการอัปโหลดจริง แค่ลบออกจากบัญชีที่ใช้งานอยู่
        await db.collection('legalCases').doc(caseId).collection('evidence').doc(evidenceId).delete();
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        return { success: true };
    } catch (error) {
        console.error('Error deleting case evidence:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

// ============================================================================
// Witnesses — เดิมเก็บเป็น React state ล้วนใน case/[id]/page.tsx (`witnessPersons`)
// รีเฟรชหน้าแล้วหายหมด ตอนนี้เก็บเป็น subcollection จริง `legalCases/{caseId}/witnesses`
// ============================================================================

export async function getCaseWitnessesAction(caseId: string): Promise<CaseWitness[]> {
    const { db } = await requireCaseOwner(caseId);
    const snap = await db.collection('legalCases').doc(caseId).collection('witnesses')
        .orderBy('createdAt', 'asc')
        .get();
    return JSON.parse(JSON.stringify(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function addWitnessAction(caseId: string, name: string, role: string) {
    const { db } = await requireCaseOwner(caseId);
    if (!name.trim() || !role.trim()) {
        return { success: false, error: 'กรุณากรอกชื่อและบทบาทของพยาน' };
    }
    try {
        const docRef = await db.collection('legalCases').doc(caseId).collection('witnesses').add({
            name: name.trim(),
            role: role.trim(),
            createdAt: Date.now(),
        });
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding witness:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function updateWitnessAction(caseId: string, witnessId: string, name: string, role: string) {
    const { db } = await requireCaseOwner(caseId);
    if (!name.trim() || !role.trim()) {
        return { success: false, error: 'กรุณากรอกชื่อและบทบาทของพยาน' };
    }
    try {
        await db.collection('legalCases').doc(caseId).collection('witnesses').doc(witnessId).update({
            name: name.trim(),
            role: role.trim(),
        });
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        return { success: true };
    } catch (error) {
        console.error('Error updating witness:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

export async function deleteWitnessAction(caseId: string, witnessId: string) {
    const { db } = await requireCaseOwner(caseId);
    try {
        await db.collection('legalCases').doc(caseId).collection('witnesses').doc(witnessId).delete();
        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        return { success: true };
    } catch (error) {
        console.error('Error deleting witness:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

// ============================================================================
// Witness list finalize — เดิมกด "ยืนยันและประกาศใช้" ในขั้นที่ 3 ของวิซาร์ดแล้ว
// แค่ toast + reset state ไม่เคยสร้างเอกสารจริงหรือบันทึกอะไรเลย ตอนนี้สร้าง PDF จริง
// (ฟอนต์ Sarabun ผ่าน fontkit เพราะฟอนต์มาตรฐานของ pdf-lib ไม่รองรับภาษาไทย) อัปโหลดขึ้น R2
// แล้วบันทึกผลไว้ที่ legalCases/{caseId}.witnessList
// ============================================================================

export async function finalizeWitnessListAction(caseId: string, evidenceIds: string[], witnessIds: string[]) {
    const { uid, db, caseData } = await requireCaseOwner(caseId);

    try {
        const [evidenceSnap, witnessSnap, lawyerDoc] = await Promise.all([
            db.collection('legalCases').doc(caseId).collection('evidence').get(),
            db.collection('legalCases').doc(caseId).collection('witnesses').get(),
            db.collection('lawyerProfiles').where('userId', '==', uid).limit(1).get(),
        ]);

        const evidenceMap = new Map(evidenceSnap.docs.map(d => [d.id, d.data()]));
        const witnessMap = new Map(witnessSnap.docs.map(d => [d.id, d.data()]));
        const lawyerName = lawyerDoc.docs[0]?.data()?.name || 'ทนายความผู้รับผิดชอบคดี';

        const selectedEvidence = evidenceIds
            .map(id => evidenceMap.get(id))
            .filter((e): e is FirebaseFirestore.DocumentData => !!e)
            .map(e => ({ title: e.title as string, fact: (e.fact as string) || '' }));

        const selectedWitnesses = witnessIds
            .map(id => witnessMap.get(id))
            .filter((w): w is FirebaseFirestore.DocumentData => !!w)
            .map(w => ({ name: w.name as string, role: w.role as string }));

        const signedAt = new Date();
        const pdfBuffer = await generateWitnessListPdf({
            caseTitle: caseData.title || 'เคสไม่มีชื่อ',
            lawyerName,
            evidence: selectedEvidence,
            witnesses: selectedWitnesses,
            signedAt,
        });

        const { r2 } = await import('@/lib/r2');
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const key = `witness_lists/${caseId}/${uuidv4()}.pdf`;
        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
        }));
        const pdfUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

        await db.collection('legalCases').doc(caseId).update({
            witnessList: {
                evidenceIds,
                witnessIds,
                pdfUrl,
                signedAt: signedAt.getTime(),
                signedBy: uid,
                signedByName: lawyerName,
            },
            updatedAt: Date.now(),
        });

        revalidatePath(`/[locale]/lawyer-dashboard/case/${caseId}`, 'page');
        return { success: true, pdfUrl };
    } catch (error: any) {
        console.error('Error finalizing witness list:', error);
        return { success: false, error: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * เปิดสำนวนคดีใหม่ลง `legalCases` จริง
 *
 * เดิม `lawyer-dashboard/cases/page.tsx` กด "เปิดสำนวนคดีใหม่" แล้วแค่ `setCases([newCase, ...cases])`
 * ใน React state — ปิด/รีเฟรชหน้าแล้วหายหมด ไม่เคยมี action เขียน Firestore มาก่อน
 *
 * ตั้งใจให้เบากว่า `createManualCaseAction` (ที่สร้าง `chats` + สัญญา + ใบแจ้งหนี้เต็มรูปแบบ) —
 * นี่คือการ "จดสำนวนคดี" อย่างเร็วโดยไม่ผูกกับบัญชีลูกความในระบบ จึงเก็บชื่อลูกความ/ศาล/ค่าจ้าง
 * ไว้ใน `metadata` (JSON string ตามที่ type `Case.metadata` ออกแบบไว้อยู่แล้ว) แทนที่จะเพิ่ม field ใหม่
 */
export async function createLegalCaseAction(data: {
    title: string;
    clientName: string;
    category?: string;
    court?: string;
    fee?: number;
}) {
    const { uid: lawyerId, adminApp } = await requireUser();
    const db = adminApp.firestore();

    if (!data.title?.trim() || !data.clientName?.trim()) {
        return { success: false, error: 'กรุณากรอกชื่อคดีและชื่อลูกความให้ครบถ้วน' };
    }

    try {
        const now = Date.now();
        const metadata = JSON.stringify({
            clientName: data.clientName.trim(),
            category: data.category || '',
            court: data.court || '',
            fee: Number(data.fee) || 0,
            paid: 0,
        });

        const docRef = await db.collection('legalCases').add({
            lawyer_id: lawyerId,
            client_id: '',
            title: data.title.trim(),
            status: 'pending' as CaseStatus,
            createdAt: now,
            updatedAt: now,
            metadata,
        });

        revalidatePath('/[locale]/lawyer-dashboard/cases', 'page');
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error creating legal case:', error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Fetch all legal cases for a specific lawyer
 */
export async function getLawyerLegalCases(): Promise<Case[]> {
    // uid มาจาก session — เดิมรับ lawyerId เป็น argument จึงดูเคสของทนายคนอื่นได้
    const { uid: lawyerId, adminApp } = await requireUser();
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
            query = query.where('case_id', '==', caseId).orderBy('order', 'asc');
        } else if (lawyerId) {
            // ...
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
    // ต้องเป็นทนายเจ้าของเคส — เดิมใครก็เปลี่ยนสถานะเคสไหนก็ได้
    let db;
    try {
        ({ db } = await requireCaseOwner(caseId));
    } catch (e) {
        return { success: false, error: e instanceof AuthError ? e.message : 'เกิดข้อผิดพลาด' };
    }

    try {
        await db.collection('legalCases').doc(caseId).update({
            status: newStatus,
            updatedAt: Date.now()
        });
        
        revalidatePath('/[locale]/lawyer-dashboard/pipeline', 'page');
        return { success: true };
    } catch (error) {
        console.error("Error updating case status:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Add a new milestone to a case
 */
export async function addCaseMilestoneAction(caseId: string, title: string, order: number = 0) {
    // ต้องเป็นทนายเจ้าของเคส
    const { db } = await requireCaseOwner(caseId);

    try {
        const newMilestone = {
            case_id: caseId,
            title,
            status: 'pending',
            order,
            createdAt: Date.now(),
            dueDate: Date.now() + 86400000 * 7 // Default 1 week
        };

        const docRef = await db.collection('milestones').add(newMilestone);
        
        revalidatePath('/[locale]/lawyer-dashboard/pipeline', 'page');
        revalidatePath(`/[locale]/chat/${caseId}`, 'page');
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding milestone:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Toggle milestone status
 */
export async function toggleMilestoneStatusAction(milestoneId: string, caseId: string) {
    // ต้องเป็นทนายเจ้าของเคสที่ milestone นี้สังกัดอยู่
    const { db } = await requireCaseOwner(caseId);

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
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Generate strategic advice for a case using AI
 */
export async function generateCaseStrategicAdviceAction(caseId: string, caseTitle: string, milestones: Milestone[]) {
    // ต้องเป็นทนายเจ้าของเคส — endpoint นี้เรียก LLM ซึ่งมีค่าใช้จ่ายต่อครั้ง
    try {
        await requireCaseOwner(caseId);
    } catch (e) {
        return { success: false, error: e instanceof AuthError ? e.message : 'เกิดข้อผิดพลาด' };
    }

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
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Close a case: update chat document with summary, final fee, and status.
 * If finalFee > originalFee, sends an additional fee request to the client.
 */
export async function closeCaseAction(caseId: string, data: {
    lawyerId: string;
    summary: string;
    finalFee: number;
    originalFee: number;
}) {
    const adminApp = await initAdmin();
    if (!adminApp) throw new Error('Firebase Admin not initialized.');
    const db = adminApp.firestore();

    try {
        const chatRef = db.collection('chats').doc(caseId);
        const chatDoc = await chatRef.get();
        
        if (!chatDoc.exists) {
            return { success: false, error: 'ไม่พบเคสนี้ในระบบ' };
        }

        const requiresApproval = data.finalFee > data.originalFee;

        if (requiresApproval) {
            // Additional fee requested — don't close yet, just send request
            await chatRef.update({
                additionalFeeRequest: {
                    amount: data.finalFee - data.originalFee,
                    totalAmount: data.finalFee,
                    reason: data.summary,
                    requestedAt: new Date(),
                    status: 'pending'
                },
                lastMessage: `ทนายความขอเรียกเก็บค่าบริการเพิ่มเติม ฿${(data.finalFee - data.originalFee).toLocaleString()}`,
                lastMessageAt: new Date(),
                updatedAt: new Date(),
            });

            // Send email notification for additional fee request
            try {
                const chatData = chatDoc.data();
                const clientId = chatData?.clientId || chatData?.userId;
                if (clientId) {
                    const clientDoc = await db.collection('users').doc(clientId).get();
                    const lawyerDoc = await db.collection('lawyerProfiles').doc(data.lawyerId).get();
                    if (clientDoc.exists) {
                        const clientData = clientDoc.data();
                        await NotificationService.notifyAdditionalFeeFromCloseCase({
                            clientName: clientData?.name || 'ลูกความ',
                            clientEmail: clientData?.email || '',
                            lawyerName: lawyerDoc?.exists ? lawyerDoc.data()?.name : 'ทนายความ',
                            caseTitle: chatData?.caseTitle || 'เคส',
                            additionalAmount: data.finalFee - data.originalFee,
                            totalAmount: data.finalFee,
                            reason: data.summary,
                            chatId: caseId,
                        });
                    }
                }
            } catch (emailError) {
                console.error('Email notification failed (non-blocking):', emailError);
            }

            return { success: true, requiresApproval: true };
        } else {
            // Close the case immediately
            const batch = db.batch();
            batch.update(chatRef, {
                status: 'closed',
                closedAt: new Date(),
                caseSummary: data.summary,
                finalFee: data.finalFee,
                lastMessage: `เคสถูกปิดเรียบร้อยแล้ว — สรุป: ${data.summary.substring(0, 50)}...`,
                lastMessageAt: new Date(),
                updatedAt: new Date(),
            });

            // Also add summary as a system message
            const summaryMsgRef = chatRef.collection('messages').doc();
            batch.set(summaryMsgRef, {
                text: `📋 **สรุปเคส:**\n${data.summary}`,
                senderId: 'system',
                timestamp: new Date(),
                type: 'case_summary'
            });

            await batch.commit();

            // Send email notification to client
            try {
                const chatData = chatDoc.data();
                const clientId = chatData?.clientId || chatData?.userId;
                if (clientId) {
                    const clientDoc = await db.collection('users').doc(clientId).get();
                    const lawyerDoc = await db.collection('lawyerProfiles').doc(data.lawyerId).get();
                    if (clientDoc.exists) {
                        const clientData = clientDoc.data();
                        await NotificationService.notifyCaseClosed({
                            clientName: clientData?.name || 'ลูกความ',
                            clientEmail: clientData?.email || '',
                            lawyerName: lawyerDoc.exists ? lawyerDoc.data()?.name : 'ทนายความ',
                            caseTitle: chatData?.caseTitle || 'เคส',
                            summary: data.summary,
                            chatId: caseId,
                            lawyerId: data.lawyerId,
                        });
                    }
                }
            } catch (emailError) {
                console.error('Email notification failed (non-blocking):', emailError);
            }

            return { success: true, requiresApproval: false };
        }
    } catch (error: any) {
        console.error("Error closing case:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Cancel a case: update chat status and mark refund as pending.
 */
export async function cancelCaseAction(caseId: string) {
    // caseId ตรงนี้คือ chatId — ต้องเป็นทนายของเคสนี้จริง
    // เดิมรับ lawyerId เป็น argument แล้วเชื่อเลย
    const { uid: actorUid, role, chatData: caseChatData, adminApp } = await requireChatRole(caseId);
    if (role !== 'lawyer' && role !== 'admin') {
        return { success: false, error: 'เฉพาะทนายผู้รับผิดชอบเท่านั้นที่ยกเลิกเคสได้' };
    }
    const db = adminApp.firestore();

    try {
        const chatRef = db.collection('chats').doc(caseId);
        const chatDoc = await chatRef.get();
        
        if (!chatDoc.exists) {
            return { success: false, error: 'ไม่พบเคสนี้ในระบบ' };
        }

        const chatData = chatDoc.data();
        const paidAmount = chatData?.paidAmount || chatData?.amount || 0;

        const batch = db.batch();
        batch.update(chatRef, {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: actorUid,
            refundStatus: paidAmount > 0 ? 'pending_refund' : 'no_refund_needed',
            refundAmount: paidAmount,
            lastMessage: '❌ เคสถูกยกเลิกโดยทนายความ',
            lastMessageAt: new Date(),
            updatedAt: new Date(),
        });

        // Add system message
        const systemMsgRef = chatRef.collection('messages').doc();
        batch.set(systemMsgRef, {
            text: `❌ เคสถูกยกเลิกโดยทนายความ${paidAmount > 0 ? ` — ระบบจะดำเนินการคืนเงิน ฿${paidAmount.toLocaleString()} ให้ลูกความ` : ''}`,
            senderId: 'system',
            timestamp: new Date(),
            type: 'case_cancelled'
        });

        await batch.commit();

        // Send email notification to client
        try {
            const clientId = chatData?.clientId || chatData?.userId;
            if (clientId) {
                const clientDoc = await db.collection('users').doc(clientId).get();
                // lawyerId ในเอกสารแชทเป็น id ของ lawyerProfiles ไม่ใช่ auth uid
                const lawyerProfileId = caseChatData?.lawyerId || caseChatData?.lawyer_id || '';
                const lawyerDoc = lawyerProfileId
                    ? await db.collection('lawyerProfiles').doc(lawyerProfileId).get()
                    : null;
                if (clientDoc.exists) {
                    const clientDocData = clientDoc.data();
                    await NotificationService.notifyCaseCancelled({
                        clientName: clientDocData?.name || 'ลูกความ',
                        clientEmail: clientDocData?.email || '',
                        lawyerName: lawyerDoc?.exists ? lawyerDoc.data()?.name : 'ทนายความ',
                        caseTitle: chatData?.caseTitle || 'เคส',
                        refundAmount: paidAmount,
                    });
                }
            }
        } catch (emailError) {
            console.error('Email notification failed (non-blocking):', emailError);
        }

        return { success: true, refundAmount: paidAmount };
    } catch (error: any) {
        console.error("Error cancelling case:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

/**
 * Fetch case details from chat document for close-case page
 */
export async function getCaseDetailsAction(caseId: string) {
    // ต้องเป็นคู่กรณีของเคสนี้ (caseId คือ chatId)
    const { adminApp } = await requireChatRole(caseId);
    const db = adminApp.firestore();

    try {
        const chatDoc = await db.collection('chats').doc(caseId).get();
        if (!chatDoc.exists) {
            return { success: false, error: 'ไม่พบเคสนี้' };
        }
        
        const data = chatDoc.data();
        return { 
            success: true, 
            data: JSON.parse(JSON.stringify({
                caseTitle: data?.caseTitle || '',
                amount: data?.amount || 0,
                paidAmount: data?.paidAmount || data?.amount || 0,
                status: data?.status || '',
                clientId: data?.clientId || data?.userId || '',
                lawyerId: data?.lawyerId || '',
                description: data?.description || '',
            }))
        };
    } catch (error: any) {
        console.error("Error getting case details:", error);
        return { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
    }
}

