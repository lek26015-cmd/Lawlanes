/**
 * หนังสือมอบอำนาจ / ใบแต่งทนายความ — ลูกความมอบอำนาจให้ทนายของห้องคดี (PLAN-11)
 *
 * `powersOfAttorney/{id}` เขียน/อ่านผ่าน Admin SDK เท่านั้น (power-of-attorney-actions.ts)
 * ทนายกรอกเรื่องที่มอบ → ลูกความกรอกข้อมูลตัวเอง + เลือกอำนาจพิเศษ → พร้อมพิมพ์
 *
 * ไฟล์นี้ import ได้ทั้ง client และ server
 */

export type PoaStatus = 'awaiting_client' | 'ready' | 'cancelled';

/** ฐานะของลูกความในคดี (ใบแต่งทนายความ แบบ (๔) ของศาล — บรรทัดบนฝ่ายโจทก์/ผู้ร้อง บรรทัดล่างฝ่ายจำเลย/ผู้คัดค้าน) */
export type PoaClientSide = 'plaintiff' | 'defendant' | 'petitioner' | 'objector';

export const POA_CLIENT_SIDE_LABEL: Record<PoaClientSide, string> = {
    plaintiff: 'โจทก์',
    defendant: 'จำเลย',
    petitioner: 'ผู้ร้อง',
    objector: 'ผู้คัดค้าน',
};

/** ฐานะของคู่ความอีกฝ่าย และลูกความอยู่บรรทัดบน (ฝ่ายผู้ฟ้อง) หรือไม่ */
export const POA_SIDE_LAYOUT: Record<PoaClientSide, { opposing: string; clientOnTop: boolean }> = {
    plaintiff: { opposing: 'จำเลย', clientOnTop: true },
    defendant: { opposing: 'โจทก์', clientOnTop: false },
    petitioner: { opposing: 'ผู้คัดค้าน', clientOnTop: true },
    objector: { opposing: 'ผู้ร้อง', clientOnTop: false },
};

/**
 * อำนาจที่ทนายทำแทนไม่ได้ เว้นแต่ตัวความมอบไว้โดยชัดแจ้ง (ป.วิ.พ. มาตรา 62)
 * ทนายเลือกได้ว่าขออะไร แต่ลูกความเป็นคนติ๊กให้จริงตอนยืนยัน
 */
export const POA_SPECIAL_POWERS = [
    { id: 'admit', label: 'ยอมรับตามที่คู่ความอีกฝ่ายหนึ่งเรียกร้อง' },
    { id: 'withdraw', label: 'ถอนฟ้อง' },
    { id: 'compromise', label: 'ประนีประนอมยอมความ' },
    { id: 'waive', label: 'สละสิทธิ' },
    { id: 'appeal', label: 'ใช้สิทธิในการอุทธรณ์หรือฎีกา' },
    { id: 'retrial', label: 'ขอให้พิจารณาคดีใหม่' },
] as const;

export type PoaSpecialPower = (typeof POA_SPECIAL_POWERS)[number]['id'];

export const POA_SPECIAL_POWER_IDS = POA_SPECIAL_POWERS.map(p => p.id) as PoaSpecialPower[];

/** ส่วนที่ทนายกรอก */
export type PoaLawyerInput = {
    /** หนังสือมอบอำนาจทั่วไป (ทำการนอกศาล) */
    poa: boolean;
    /** ใบแต่งทนายความ (คดีในศาล) */
    courtAppointment: boolean;
    /** เรื่องที่มอบอำนาจ — เช่น "ติดต่อสถานีตำรวจภูธร... เพื่อแจ้งความ ร้องทุกข์ ..." */
    matter: string;
    /** ทำที่ (สถานที่ทำหนังสือ) */
    madeAt: string;
    /** ที่อยู่สำนักงานทนาย (ค่าเริ่มต้นจากโปรไฟล์) */
    lawyerAddress: string;
    court: {
        courtName: string;
        /** คดีหมายเลขดำ — ว่างได้ถ้ายังไม่ยื่นฟ้อง */
        blackCaseNo: string;
        /** ความแพ่ง / ความอาญา */
        caseKind: 'civil' | 'criminal';
        clientSide: PoaClientSide;
        opposingParty: string;
        /** อำนาจพิเศษที่ทนายขอ */
        requestedPowers: PoaSpecialPower[];
    };
};

/** ส่วนที่ลูกความกรอกเอง */
export type PoaClientInput = {
    fullName: string;
    age: string;
    nationality: string;
    idType: 'thai_id' | 'passport';
    idNumber: string;
    address: string;
    phone: string;
    /** อำนาจพิเศษที่ลูกความให้จริง (ต้องเป็นส่วนหนึ่งของที่ทนายขอ) */
    grantedPowers: PoaSpecialPower[];
};

/** ข้อมูลที่หน้าจอ/หน้าพิมพ์ได้รับ */
export type PoaView = {
    id: string;
    chatId: string;
    status: PoaStatus;
    caseTitle: string;
    input: PoaLawyerInput;
    lawyer: { name: string; licenseNumber: string; phone: string };
    client: PoaClientInput | null;
    clientConfirmedAt: number | null;
    createdAt: number;
    updatedAt: number;
};

export const EMPTY_LAWYER_INPUT: PoaLawyerInput = {
    poa: true,
    courtAppointment: false,
    matter: '',
    madeAt: '',
    lawyerAddress: '',
    court: { courtName: '', blackCaseNo: '', caseKind: 'civil', clientSide: 'plaintiff', opposingParty: '', requestedPowers: [] },
};

const MAX = { short: 200, long: 3000 };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** ตรวจเลขบัตรประชาชนไทย 13 หลัก (หลักสุดท้ายเป็นเลขตรวจสอบ) */
export function isValidThaiId(id: string): boolean {
    if (!/^\d{13}$/.test(id)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
    return (11 - (sum % 11)) % 10 === Number(id[12]);
}

export function sanitizeLawyerInput(raw: unknown): { ok: true; value: PoaLawyerInput } | { ok: false; error: string } {
    const r = (raw ?? {}) as Record<string, any>;
    const c = (r.court ?? {}) as Record<string, any>;
    const value: PoaLawyerInput = {
        poa: r.poa === true,
        courtAppointment: r.courtAppointment === true,
        matter: str(r.matter, MAX.long),
        madeAt: str(r.madeAt, MAX.short),
        lawyerAddress: str(r.lawyerAddress, MAX.short * 2),
        court: {
            courtName: str(c.courtName, MAX.short),
            blackCaseNo: str(c.blackCaseNo, MAX.short),
            caseKind: c.caseKind === 'criminal' ? 'criminal' : 'civil',
            clientSide: (Object.keys(POA_CLIENT_SIDE_LABEL) as PoaClientSide[]).includes(c.clientSide) ? c.clientSide : 'plaintiff',
            opposingParty: str(c.opposingParty, MAX.short),
            requestedPowers: Array.isArray(c.requestedPowers)
                ? POA_SPECIAL_POWER_IDS.filter(id => c.requestedPowers.includes(id))
                : [],
        },
    };
    if (!value.poa && !value.courtAppointment) return { ok: false, error: 'เลือกเอกสารอย่างน้อย 1 อย่าง' };
    if (value.poa && value.matter.length < 10) return { ok: false, error: 'กรุณาระบุเรื่องที่มอบอำนาจ' };
    if (value.courtAppointment && !value.court.courtName) return { ok: false, error: 'กรุณาระบุชื่อศาล' };
    if (!value.courtAppointment) value.court.requestedPowers = [];
    return { ok: true, value };
}

export function sanitizeClientInput(raw: unknown, requested: PoaSpecialPower[]): { ok: true; value: PoaClientInput } | { ok: false; error: string } {
    const r = (raw ?? {}) as Record<string, any>;
    const idType = r.idType === 'passport' ? 'passport' : 'thai_id';
    const idNumber = idType === 'thai_id' ? str(r.idNumber, 20).replace(/[\s-]/g, '') : str(r.idNumber, 30).toUpperCase();
    const value: PoaClientInput = {
        fullName: str(r.fullName, MAX.short),
        age: str(r.age, 3).replace(/\D/g, ''),
        nationality: str(r.nationality, 50) || 'ไทย',
        idType,
        idNumber,
        address: str(r.address, MAX.short * 2),
        phone: str(r.phone, 30),
        grantedPowers: Array.isArray(r.grantedPowers)
            ? requested.filter(id => r.grantedPowers.includes(id))
            : [],
    };
    if (value.fullName.length < 3) return { ok: false, error: 'กรุณากรอกชื่อ-นามสกุล' };
    const age = Number(value.age);
    if (!age || age < 1 || age > 120) return { ok: false, error: 'กรุณากรอกอายุ' };
    if (idType === 'thai_id' && !isValidThaiId(idNumber)) return { ok: false, error: 'เลขบัตรประชาชนไม่ถูกต้อง' };
    if (idType === 'passport' && idNumber.length < 5) return { ok: false, error: 'กรุณากรอกเลขหนังสือเดินทาง' };
    if (value.address.length < 10) return { ok: false, error: 'กรุณากรอกที่อยู่ตามบัตร' };
    return { ok: true, value };
}

/** วันที่แบบไทย เช่น 25 ตุลาคม 2569 */
export function thaiDate(ms: number): string {
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(ms));
}

/** เลขบัตรแบบมีขีด 1-2345-67890-12-3 */
export function formatThaiId(id: string): string {
    return /^\d{13}$/.test(id) ? `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}` : id;
}
