'use server';

import * as admin from 'firebase-admin';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth-guard';
import { INTERPRETER_LANGUAGE_CODES, INTERPRETER_SERVICES } from '@/lib/interpreter-types';

/**
 * ขอใช้บริการล่าม — ลูกค้าทักแอดมินก่อนเสมอ (ไม่มีรายชื่อล่าม/ราคา/การจองเองบนเว็บแล้ว)
 *
 * สร้างตั๋วซัพพอร์ต (tickets) ผ่าน Admin SDK พร้อมข้อความแรกสรุปคำขอ แล้วลูกค้าคุยต่อกับ
 * แอดมินที่ /support/{ticketId} (support-chat-box เดิม) · แอดมินเห็นในหลังบ้าน /tickets
 */

const MAX_TEXT = 1000;

export interface InterpreterRequestInput {
    service: string;
    languageFrom: string;
    languageTo: string;
    date: string;      // YYYY-MM-DD หรือ '' ถ้ายังไม่แน่นอน
    mode: 'onsite' | 'remote';
    location: string;
    details: string;
    phone: string;
    /** ทนายที่ขอล่ามให้เคสของตัวเอง (มาจาก ?lawyerId= เดิม) */
    lawyerId?: string;
}

function clip(v: unknown, max = 200): string {
    return String(v ?? '').trim().slice(0, max);
}

export async function createInterpreterRequestAction(input: InterpreterRequestInput): Promise<{ ticketId: string }> {
    const { uid, token, adminApp } = await requireUser();

    const service = (INTERPRETER_SERVICES as readonly string[]).includes(input.service) ? input.service : '';
    const langs = INTERPRETER_LANGUAGE_CODES as readonly string[];
    const languageFrom = langs.includes(input.languageFrom) ? input.languageFrom : '';
    const languageTo = langs.includes(input.languageTo) ? input.languageTo : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : '';
    const mode = input.mode === 'remote' ? 'remote' : 'onsite';
    const location = clip(input.location);
    const details = clip(input.details, MAX_TEXT);
    const phone = clip(input.phone, 30);
    const lawyerId = /^[A-Za-z0-9_-]{1,64}$/.test(input.lawyerId || '') ? input.lawyerId! : '';

    if (!service || !languageFrom || !languageTo) {
        throw new Error('กรุณาเลือกบริการและภาษา');
    }

    const db = adminApp.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userSnap = await db.collection('users').doc(uid).get();
    const clientName = clip(userSnap.get('name') || token.name || 'ผู้ใช้งาน', 100);

    // สรุปเป็นภาษาไทยให้แอดมินอ่าน (ชื่อบริการ/ภาษาจาก messages ไม่ใช่ code)
    const t = await getTranslations({ locale: 'th', namespace: 'Interpreters' });
    const summary = [
        'ขอใช้บริการล่าม',
        `บริการ: ${t(`serviceNames.${service}` as any)}`,
        `ภาษา: ${t(`languageNames.${languageFrom}` as any)} → ${t(`languageNames.${languageTo}` as any)}`,
        `วันที่: ${date || 'ยังไม่แน่นอน'}`,
        `รูปแบบ: ${mode === 'remote' ? 'ออนไลน์' : 'ไปที่สถานที่'}${location ? ` · ${location}` : ''}`,
        phone ? `เบอร์ติดต่อ: ${phone}` : '',
        lawyerId ? `ขอให้เคสของทนาย: ${lawyerId}` : '',
        details ? `รายละเอียด: ${details}` : '',
    ].filter(Boolean).join('\n');

    const ticketRef = db.collection('tickets').doc();
    const batch = db.batch();
    batch.set(ticketRef, {
        userId: uid,
        caseId: '',
        problemType: 'ขอใช้บริการล่าม',
        description: summary,
        status: 'pending',
        reportedAt: now,
        clientName,
        email: token.email || '',
        // ข้อมูลแบบมีโครงสร้างไว้ให้แอดมินคัด/ค้น
        interpreterRequest: { service, languageFrom, languageTo, date, mode, location, details, phone, lawyerId },
    });
    batch.set(ticketRef.collection('messages').doc(), {
        text: summary,
        senderId: uid,
        senderName: clientName,
        role: 'user',
        createdAt: now,
        avatarUrl: null,
    });
    batch.set(db.collection('notifications').doc(), {
        type: 'ticket',
        title: 'คำขอใช้บริการล่าม',
        message: `${clientName} ขอล่าม ${t(`languageNames.${languageFrom}` as any)} → ${t(`languageNames.${languageTo}` as any)} (${t(`serviceNames.${service}` as any)})`,
        createdAt: now,
        read: false,
        recipient: 'admin',
        link: `/admin/tickets/${ticketRef.id}`,
        relatedId: ticketRef.id,
    });
    await batch.commit();

    return { ticketId: ticketRef.id };
}
