'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import emblem from '@/pic/National Emblem of Thailand.jpg';
import {
    POA_CLIENT_SIDE_LABEL, POA_SIDE_LAYOUT, POA_SPECIAL_POWERS, formatThaiId,
    type PoaView,
} from '@/lib/power-of-attorney';

/**
 * ตัวเอกสาร A4 ของหนังสือมอบอำนาจ / ใบแต่งทนายความ — ใช้ทั้งพรีวิวในห้องคดีและหน้าพิมพ์
 * ช่องที่ยังไม่มีข้อมูลเป็นเส้นให้เขียนด้วยมือ (ไม่เดาข้อมูลแทน) · วันที่เว้นไว้เขียนตอนลงนามจริง
 * ใบแต่งทนายความเรียงตามแบบ (๔) ของศาล: หน้า 1 ใบแต่ง · หน้า 2 คำรับเป็นทนายความ + คำสั่ง
 *
 * หน้ากระดาษกว้าง A4 คงที่เสมอ — จอแคบกว่าใช้ย่อทั้งหน้า (scale) แทนการจัดบรรทัดใหม่
 * มือถือกับคอมจึงเห็นการตัดบรรทัดเหมือนกันและเหมือนตอนพิมพ์
 */


/** 210mm ที่ 96dpi */
const A4_WIDTH_PX = 794;

/** ข้อความในช่อง "ให้มีอำนาจ" — ข้อความเต็มตามแบบฟอร์มเมื่อให้ครบทุกข้อ */
function grantedPowersText(granted: string[]): string {
    if (granted.length === 0) return '';
    if (granted.length === POA_SPECIAL_POWERS.length) {
        return 'ดำเนินกระบวนพิจารณาใด ๆ ไปในทางจำหน่ายสิทธิของข้าพเจ้าได้ด้วย เช่น การยอมรับตามที่คู่ความอีกฝ่ายหนึ่งเรียกร้อง การถอนฟ้อง การประนีประนอมยอมความ การสละสิทธิหรือใช้สิทธิในการอุทธรณ์หรือฎีกาหรือขอให้พิจารณาคดีใหม่';
    }
    const labels = POA_SPECIAL_POWERS.filter(p => granted.includes(p.id)).map(p => p.label);
    return `ดำเนินกระบวนพิจารณาไปในทางจำหน่ายสิทธิของข้าพเจ้าได้ เฉพาะ${labels.join(' ')}`;
}

function Blank({ value, min = '8em', solid }: { value?: string | null; min?: string; solid?: boolean }) {
    if (value) return <span>{value}</span>;
    return <span className={cn('inline-block border-b border-black align-baseline', !solid && 'border-dotted')} style={{ minWidth: min }}>&nbsp;</span>;
}

/** บรรทัดเติมข้อความยาวเต็มบรรทัดแบบแบบฟอร์มศาล */
function Line({ label, value, className }: { label?: React.ReactNode; value?: string | null; className?: string }) {
    return (
        <div className={cn('flex items-end gap-2', className)}>
            {label && <span className="whitespace-nowrap">{label}</span>}
            <span className="flex-1 border-b border-black min-h-[1.5em]">{value || ' '}</span>
        </div>
    );
}

function SignatureLine({ role, name }: { role: string; name?: string }) {
    return (
        <div className="text-center space-y-1 break-inside-avoid">
            <p className="whitespace-nowrap">ลงชื่อ <span className="inline-block w-40 border-b border-dotted border-black">&nbsp;</span> {role}</p>
            <p>( <Blank value={name} min="12em" /> )</p>
        </div>
    );
}

function Page({ children, draft }: { children: React.ReactNode; draft: boolean }) {
    return (
        <section
            className={cn(
                'poa-page font-th-sarabun relative mx-auto bg-white text-black shadow-xl',
                'w-[210mm] min-h-[297mm] px-[18mm] py-[20mm] text-[16pt] leading-[1.5]',
                'print:shadow-none print:w-auto print:min-h-0 print:p-0',
            )}
        >
            {draft && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                    <span className="-rotate-[30deg] text-[90px] font-bold text-red-500/10 select-none">ร่าง</span>
                </div>
            )}
            {children}
        </section>
    );
}

function PowerOfAttorneyPage({ poa }: { poa: PoaView }) {
    const c = poa.client;
    const i = poa.input;
    return (
        <Page draft={poa.status !== 'ready'}>
            <div className="absolute right-[18mm] top-[16mm] flex h-[22mm] w-[22mm] items-center justify-center border border-dashed border-black text-center text-[12pt] leading-tight print:right-0 print:top-0">
                ติด<br />อากรแสตมป์
            </div>
            <h1 className="mb-6 text-center text-[20pt] font-bold">หนังสือมอบอำนาจ</h1>
            <div className="ml-auto w-fit space-y-0.5">
                <p>ทำที่ <Blank value={i.madeAt} min="14em" /></p>
                <p>วันที่ <Blank min="14em" /></p>
            </div>

            <p className="mt-6 indent-12">
                ข้าพเจ้า <Blank value={c?.fullName} min="14em" /> อายุ <Blank value={c?.age} min="3em" /> ปี
                สัญชาติ <Blank value={c?.nationality} min="5em" /> ถือ{c?.idType === 'passport' ? 'หนังสือเดินทาง' : 'บัตรประจำตัวประชาชน'}เลขที่{' '}
                <Blank value={c ? formatThaiId(c.idNumber) : ''} min="12em" /> อยู่บ้านเลขที่ <Blank value={c?.address} min="24em" />{' '}
                ซึ่งต่อไปในหนังสือนี้เรียกว่า &quot;ผู้มอบอำนาจ&quot;
            </p>
            <p className="indent-12">
                ขอมอบอำนาจให้ <Blank value={poa.lawyer.name} min="14em" /> ทนายความ ใบอนุญาตเลขที่{' '}
                <Blank value={poa.lawyer.licenseNumber} min="8em" /> สำนักงานตั้งอยู่ที่ <Blank value={i.lawyerAddress} min="24em" />{' '}
                ซึ่งต่อไปในหนังสือนี้เรียกว่า &quot;ผู้รับมอบอำนาจ&quot; เป็นผู้มีอำนาจกระทำการแทนข้าพเจ้าในเรื่องดังต่อไปนี้
            </p>
            <p className="ml-12 whitespace-pre-line">{i.matter}</p>
            <p className="indent-12">
                การใดที่ผู้รับมอบอำนาจได้กระทำไปภายในขอบอำนาจตามหนังสือมอบอำนาจนี้ ให้มีผลผูกพันผู้มอบอำนาจเสมือนว่าผู้มอบอำนาจได้กระทำด้วยตนเอง
            </p>
            <p className="indent-12">เพื่อเป็นหลักฐาน ข้าพเจ้าจึงได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน</p>

            <div className="mt-10 grid grid-cols-2 gap-8">
                <SignatureLine role="ผู้มอบอำนาจ" name={c?.fullName} />
                <SignatureLine role="ผู้รับมอบอำนาจ" name={poa.lawyer.name} />
                <SignatureLine role="พยาน" />
                <SignatureLine role="พยาน" />
            </div>
        </Page>
    );
}

/** แบบ (๔) หน้า 1 — ใบแต่งทนายความ */
function CourtAppointmentPage({ poa }: { poa: PoaView }) {
    const c = poa.client;
    const k = poa.input.court;
    const side = POA_SIDE_LAYOUT[k.clientSide];
    const sideLabel = POA_CLIENT_SIDE_LABEL[k.clientSide];
    const clientName = c?.fullName ?? '';
    const [top, bottom] = side.clientOnTop
        ? [{ name: clientName, label: sideLabel }, { name: k.opposingParty, label: side.opposing }]
        : [{ name: k.opposingParty, label: side.opposing }, { name: clientName, label: sideLabel }];
    const powers = c ? grantedPowersText(c.grantedPowers) : '';

    return (
        <Page draft={poa.status !== 'ready'}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start">
                <div className="leading-tight">
                    <p>(๔)</p>
                    <p>ใบแต่งทนายความ</p>
                </div>
                <Image src={emblem} alt="ตราครุฑ" className="h-[30mm] w-auto" priority />
                <p className="mt-[18mm] justify-self-end whitespace-nowrap">คดีหมายเลขดำที่ <Blank value={k.blackCaseNo} min="7em" solid /></p>
            </div>

            <div className="mt-2 ml-auto w-[68%] space-y-1">
                <Line label="ศาล" value={k.courtName} />
                <div className="flex items-end gap-2">
                    <span>วันที่</span><span className="w-16 border-b border-black">&nbsp;</span>
                    <span>เดือน</span><span className="flex-1 border-b border-black">&nbsp;</span>
                    <span>พุทธศักราช</span><span className="w-16 border-b border-black">&nbsp;</span>
                </div>
                <Line label="ความ" value={k.caseKind === 'criminal' ? 'อาญา' : 'แพ่ง'} />
            </div>

            <div className="mt-8 flex items-stretch gap-2">
                <span className="self-center font-bold">ระหว่าง</span>
                <span className="w-3 border-y border-l border-black rounded-l-full" />
                <div className="flex-1 flex flex-col justify-between gap-10">
                    <Line value={top.name} />
                    <Line value={bottom.name} />
                </div>
                <div className="flex flex-col justify-between gap-10 pb-0.5">
                    <span className="self-end">{top.label}</span>
                    <span className="self-end">{bottom.label}</span>
                </div>
            </div>

            <div className="mt-6 space-y-1">
                <Line label={<span className="ml-12">ข้าพเจ้า</span>} value={clientName && `${clientName} ${sideLabel}`} />
                <Line />
                <Line label="ขอแต่งให้" value={poa.lawyer.name} />
                <p>
                    เป็นทนายความของข้าพเจ้าในคดีเรื่องนี้และให้มีอำนาจ{' '}
                    {powers ? <span className="underline underline-offset-4">{powers}</span> : <span className="inline-block w-[60%] border-b border-black">&nbsp;</span>}
                </p>
                <Line label="ข้าพเจ้ายอมรับผิดชอบตามที่" value={poa.lawyer.name} />
                <p>ทนายความจะได้ดำเนินกระบวนพิจารณาต่อไปตามกฎหมาย</p>
            </div>

            <div className="mt-8 leading-snug">
                <p>ขอรับรองว่าเป็นลายมือชื่อผู้แต่งทนาย</p>
                <p>ลงนามต่อหน้าข้าพเจ้าจริง</p>
            </div>
            <p className="mt-10 text-center">
                <span className="inline-block w-56 border-b border-black">&nbsp;</span>ผู้แต่งทนายความ
            </p>
        </Page>
    );
}

/** แบบ (๔) หน้า 2 — คำรับเป็นทนายความ + คำสั่ง */
function LawyerAcceptancePage({ poa }: { poa: PoaView }) {
    const sideLabel = POA_CLIENT_SIDE_LABEL[poa.input.court.clientSide];
    const clientName = poa.client?.fullName;
    return (
        <Page draft={poa.status !== 'ready'}>
            <h2 className="text-center text-[18pt] font-bold underline underline-offset-4">คำรับเป็นทนายความ</h2>
            <div className="mt-8 space-y-1">
                <Line label="ข้าพเจ้า" value={poa.lawyer.name} />
                <div className="flex items-end gap-2">
                    <span>ทนายความชั้นที่</span><span className="w-20 border-b border-black">&nbsp;</span>
                    <span>ใบอนุญาตที่</span><span className="flex-1 border-b border-black">{poa.lawyer.licenseNumber || ' '}</span>
                </div>
                <Line label="ได้รับอนุญาตให้ว่าความ" />
                <Line label="สำนักงานอยู่" value={poa.input.lawyerAddress} />
                <Line label="โทรศัพท์" value={poa.lawyer.phone} />
                <Line label="ขอเข้ารับเป็นทนายความของ" value={clientName && `${clientName} ${sideLabel}`} />
                <Line />
                <p>เพื่อดำเนินกระบวนพิจารณาต่อไปตามหน้าที่ในกฎหมาย</p>
            </div>
            <p className="mt-14 text-center">
                <span className="inline-block w-56 border-b border-black">&nbsp;</span>ทนายความ
            </p>

            <h2 className="mt-16 text-center text-[18pt] font-bold underline underline-offset-4">คำสั่ง</h2>
            <div className="mt-8 space-y-10 w-[85%]">
                <Line /><Line /><Line />
            </div>
            <p className="mt-14 text-center">
                <span className="inline-block w-56 border-b border-black">&nbsp;</span>ผู้พิพากษา
            </p>
        </Page>
    );
}

export function PowerOfAttorneyDocument({ poa }: { poa: PoaView }) {
    const outer = useRef<HTMLDivElement>(null);
    const inner = useRef<HTMLDivElement>(null);
    const [fit, setFit] = useState({ scale: 1, height: 0 });

    useLayoutEffect(() => {
        const o = outer.current, i = inner.current;
        if (!o || !i) return;
        const measure = () => {
            const scale = Math.min(1, o.clientWidth / A4_WIDTH_PX);
            setFit({ scale, height: i.offsetHeight * scale });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(o);
        ro.observe(i);
        return () => ro.disconnect();
    }, []);

    return (
        <div ref={outer} className="poa-fit w-full overflow-hidden print:overflow-visible" style={{ height: fit.height || undefined }}>
            <div
                ref={inner}
                className="poa-fit-inner mx-auto space-y-8 print:space-y-0"
                style={{ width: A4_WIDTH_PX, transform: `scale(${fit.scale})`, transformOrigin: 'top left', marginLeft: fit.scale < 1 ? 0 : undefined }}
            >
            {poa.input.poa && <PowerOfAttorneyPage poa={poa} />}
            {poa.input.courtAppointment && <CourtAppointmentPage poa={poa} />}
            {poa.input.courtAppointment && <LawyerAcceptancePage poa={poa} />}
            </div>
        </div>
    );
}
