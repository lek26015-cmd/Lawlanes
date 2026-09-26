/**
 * บริการล่ามทนาย (Legal Interpreter) — type และค่าคงที่ที่ใช้ร่วมกันทั้ง client/server
 *
 * แยกจาก *-actions.ts เพราะไฟล์ 'use server' export ได้แค่ async function
 *
 * เงินทุกตัวเก็บเป็น "สตางค์" (integer) — ห้ามใช้ทศนิยมกับเงิน
 * ราคาที่ล่ามตั้ง = ราคาที่ลูกค้าจ่าย (gross) ล่ามได้รับ gross − GP
 */

import type { LawyerSchedule } from './types';

export const INTERPRETER_LANGUAGE_CODES = [
    'th', 'en', 'zh', 'ja', 'ko', 'fr', 'de', 'ru', 'ar', 'my', 'km', 'lo', 'vi', 'hi',
] as const;
export type InterpreterLanguageCode = (typeof INTERPRETER_LANGUAGE_CODES)[number];

export const INTERPRETER_LANGUAGE_LEVELS = ['native', 'fluent', 'professional'] as const;
export type InterpreterLanguageLevel = (typeof INTERPRETER_LANGUAGE_LEVELS)[number];

/** งานล่ามพูด — คิดราคาต่อชั่วโมง */
export const INTERPRETATION_SERVICES = ['court', 'police', 'lawyer_meeting', 'business_meeting'] as const;
/** งานแปลเอกสาร — คิดราคาต่อหน้า */
export const TRANSLATION_SERVICES = ['doc_translation', 'certified_translation'] as const;
export const INTERPRETER_SERVICES = [...INTERPRETATION_SERVICES, ...TRANSLATION_SERVICES] as const;
export type InterpreterService = (typeof INTERPRETER_SERVICES)[number];
export type InterpreterBookingKind = 'interpretation' | 'translation';

export function serviceKind(service: InterpreterService): InterpreterBookingKind {
    return (TRANSLATION_SERVICES as readonly string[]).includes(service) ? 'translation' : 'interpretation';
}

/**
 * หน่วยของรายการในเรทการ์ด — กำหนดว่าจองแบบไหนและล็อกปฏิทินอย่างไร
 *   hour    ต่อชั่วโมง   เลือกวัน + เวลาเริ่ม + จำนวนชั่วโมง (>= minQty) → ล็อกตามชั่วโมง
 *   session เหมาต่อครั้ง เลือกวัน + เวลาเริ่ม → ล็อก sessionHours ชั่วโมง
 *   day     เหมาวัน     เลือกวันเริ่ม + จำนวนวัน → ล็อกเวลาทำงานทั้งวันของทุกวัน
 *   page    ต่อหน้า     จำนวนหน้า + แนบเอกสาร → ไม่ล็อกปฏิทิน
 *   case    เหมาทั้งคดี  จ่ายครั้งเดียว นัดวันกันในแชท → ไม่ล็อกปฏิทิน
 */
export const RATE_UNITS = ['hour', 'session', 'day', 'page', 'case'] as const;
export type RateUnit = (typeof RATE_UNITS)[number];

/** หน่วยที่ต้องเลือกวันเวลาและล็อกปฏิทิน */
export const SCHEDULED_UNITS: RateUnit[] = ['hour', 'session', 'day'];

/**
 * ขอบเขตค่า (ราคาหน่วยบาท) — กันล่ามพิมพ์ผิด และกันยอดชำระที่ SlipOK/PromptPay รับไม่ได้
 */
export const RATE_LIMITS = {
    maxItems: 20,
    price: { min: 100, max: 500000 },
    name: 80,
    description: 500,
    minQty: { min: 1, max: 100 },
    sessionHours: { min: 1, max: 12 },
    /** จองติดกันได้กี่วันสำหรับเหมาวัน */
    maxDays: 14,
} as const;

/** ยอดของใบเสนอราคาในแชท (บาท) */
export const OFFER_LIMITS = { amount: { min: 100, max: 2000000 }, validDays: 7 } as const;

export const BOOKING_LIMITS = {
    maxHours: 12,
    maxPages: 500,
    /** จองล่วงหน้าได้ไม่เกินกี่วัน — เท่ากับหน้าจองนัดทนาย */
    maxDaysAhead: 60,
    /** ต้องจองล่วงหน้าอย่างน้อยกี่ชั่วโมง */
    minLeadHours: 24,
    /** ถือ slot ไว้ให้กี่นาทีระหว่างรอแอดมินตรวจสลิป */
    holdMinutes: 24 * 60,
} as const;

export const GP_LIMITS = { min: 0, max: 50 } as const;
/** ใช้เมื่อแอดมินยังไม่เคยตั้ง settings/interpreterFees */
export const DEFAULT_GP_PERCENT = 15;

/** รายการในเรทการ์ดของล่าม — ราคาหน่วยบาทเพื่อให้ล่ามกรอกง่าย (แปลงเป็นสตางค์ตอนคิดยอด) */
export interface RateItem {
    id: string;
    name: string;
    description: string;
    unit: RateUnit;
    price: number;
    /** ขั้นต่ำ (ชั่วโมง / หน้า) — ใช้กับ hour, page */
    minQty: number;
    /** ความยาวงานต่อครั้ง — ใช้กับ session */
    sessionHours: number;
    /** บริการที่รายการนี้ใช้ได้ — ว่าง = ทุกบริการที่ล่ามรับ */
    services: InterpreterService[];
}

export interface InterpreterLanguage {
    code: InterpreterLanguageCode;
    level: InterpreterLanguageLevel;
}

export type InterpreterStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

/** ข้อมูลที่ส่งออกสู่สาธารณะได้ — allowlist (ดู toPublicInterpreter) */
export interface PublicInterpreter {
    id: string;
    name: string;
    imageUrl: string;
    description: string;
    descriptionEn?: string;
    descriptionZh?: string;
    languages: InterpreterLanguage[];
    languageCodes: InterpreterLanguageCode[];
    services: InterpreterService[];
    specialties: string[];
    serviceProvinces: string[];
    remoteAvailable: boolean;
    rateCard: RateItem[];
    schedule?: LawyerSchedule;
    /** แอดมินตรวจเอกสารแล้วเท่านั้น — ใช้แสดงป้าย ห้ามแสดงป้ายจากสิ่งที่ล่ามกรอกเอง */
    verifiedCredentials: string[];
    averageRating?: number;
    reviewCount?: number;
    status: InterpreterStatus;
    joinedAt: string | null;
}

/** โปรไฟล์ของล่ามเองในแดชบอร์ด (รวมข้อมูล private) */
export interface MyInterpreterProfile extends PublicInterpreter {
    rejectionReason?: string;
    private: {
        phone: string;
        email: string;
        lineId?: string;
        idCardPath?: string;
        certificatePaths: string[];
        bankName?: string;
        bankAccountNumber?: string;
        bankAccountName?: string;
    };
}

export type InterpreterBookingStatus =
    | 'pending_payment'
    | 'paid'
    | 'accepted'
    | 'completed'
    | 'declined'
    | 'cancelled'
    | 'expired'
    | 'refund_pending'
    | 'refunded';

export type InterpreterPayoutStatus = 'not_due' | 'due' | 'paid';

/** สถานะที่ยังกิน slot อยู่ — สถานะอื่นปล่อย slot แล้ว */
export const SLOT_HOLDING_STATUSES: InterpreterBookingStatus[] = ['pending_payment', 'paid', 'accepted'];

/** ราคา snapshot ตอนจอง — แก้ GP หรือเรทการ์ดทีหลังไม่กระทบ booking เก่า */
export interface InterpreterQuote {
    /** ชื่อรายการในเรทการ์ด หรือหัวข้อใบเสนอราคา */
    itemName: string;
    unitType: RateUnit | 'offer';
    units: number;
    /** สตางค์ */
    unitRate: number;
    /** สตางค์ — ยอดที่ลูกค้าจ่าย */
    grossAmount: number;
    gpPercent: number;
    /** สตางค์ */
    gpAmount: number;
    /** สตางค์ */
    netToInterpreter: number;
}

export interface InterpreterBookingInput {
    interpreterId: string;
    /** รายการในเรทการ์ด — หรือส่ง offerId แทนเมื่อจ่ายจากใบเสนอราคาในแชท */
    rateItemId?: string;
    offerId?: string;
    conversationId?: string;
    service: InterpreterService;
    languageFrom: InterpreterLanguageCode;
    languageTo: InterpreterLanguageCode;
    /** งานล่าม: วันที่ YYYY-MM-DD ตามเวลาไทย */
    date?: string;
    /** งานล่าม: ชั่วโมงเริ่ม 0-23 ตามเวลาไทย */
    startHour?: number;
    /** จำนวนหน่วย: ชั่วโมง (hour) / วัน (day) / หน้า (page) */
    quantity?: number;
    mode?: 'onsite' | 'remote';
    province?: string;
    address?: string;
    /** งานแปล */
    dueDate?: string;
    documentPaths?: string[];
    notes?: string;
    lawyerId?: string;
    /** ข้อมูลติดต่อลูกค้า — ล่ามเห็นหลังจ่ายเงินแล้วเท่านั้น */
    contactName?: string;
    contactPhone?: string;
    contactLineId?: string;
}

/** ข้อมูลติดต่อที่เปิดเผยได้หลังลูกค้าจ่ายเงินแล้วเท่านั้น (ดู interpreter-chat-utils.ts) */
export interface InterpreterContactInfo {
    name: string;
    phone: string;
    lineId?: string;
    email?: string;
}

export interface InterpreterBookingView {
    id: string;
    /** ห้องแชทของคู่ลูกค้า-ล่ามนี้ */
    conversationId: string;
    /** ข้อมูลติดต่อของอีกฝ่าย — null จนกว่างานจะยืนยันการชำระเงิน */
    contact: InterpreterContactInfo | null;
    customerId: string;
    interpreterId: string;
    interpreterName: string;
    kind: InterpreterBookingKind;
    serviceType: InterpreterService;
    languagePair: { from: InterpreterLanguageCode; to: InterpreterLanguageCode };
    startAt: string | null;
    endAt: string | null;
    durationHours: number | null;
    /** จำนวนวัน (เหมาวัน) */
    days: number | null;
    mode: 'onsite' | 'remote' | null;
    province: string | null;
    address: string | null;
    pageCount: number | null;
    certified: boolean;
    dueDate: string | null;
    notes: string | null;
    lawyerId: string | null;
    quote: InterpreterQuote;
    status: InterpreterBookingStatus;
    payoutStatus: InterpreterPayoutStatus;
    createdAt: string | null;
}

export function bahtToSatang(baht: number): number {
    return Math.round(baht * 100);
}

export function formatSatang(satang: number, locale: string = 'th-TH'): string {
    return (satang / 100).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export type InterpreterOfferStatus = 'open' | 'booked' | 'cancelled';

/** ใบเสนอราคาเฉพาะรายที่ล่ามส่งในแชท — ยอดเหมาก้อนเดียว (บาท) */
export interface InterpreterOffer {
    id: string;
    title: string;
    description: string;
    amount: number;
    service: InterpreterService;
    languageFrom: InterpreterLanguageCode;
    languageTo: InterpreterLanguageCode;
    /** วันเวลางาน (ถ้ามี) → ล็อกปฏิทินตอนลูกค้าจ่าย · ไม่มี = นัดกันในแชท */
    date: string | null;
    startHour: number | null;
    hours: number | null;
    status: InterpreterOfferStatus;
    expiresAt: string | null;
    bookingId: string | null;
}

export interface InterpreterChatMessage {
    id: string;
    /** ข้อความที่แนบใบเสนอราคา */
    offer?: InterpreterOffer;
    /** true = ข้อความของผู้ที่กำลังดู */
    mine: boolean;
    senderRole: 'customer' | 'interpreter' | 'admin';
    text: string;
    /** ระบบปิดข้อมูลติดต่อบางส่วนในข้อความนี้ */
    masked: boolean;
    createdAt: string | null;
}

export interface InterpreterConversationSummary {
    id: string;
    /** มุมมองของผู้ดู: เป็นลูกค้าหรือเป็นล่ามในห้องนี้ */
    viewerRole: 'customer' | 'interpreter';
    interpreterId: string;
    otherName: string;
    otherImageUrl: string;
    lastMessage: string;
    lastMessageAt: string | null;
    unread: number;
}

export interface InterpreterConversationDetail extends InterpreterConversationSummary {
    /** ลูกค้าจ่ายเงินให้ล่ามคนนี้แล้วอย่างน้อย 1 งาน → เห็นข้อมูลติดต่อกัน */
    unlocked: boolean;
    contact: InterpreterContactInfo | null;
    messages: InterpreterChatMessage[];
}

export const CHAT_LIMITS = { maxLength: 2000, pageSize: 200 } as const;
