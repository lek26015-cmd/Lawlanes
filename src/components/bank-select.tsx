'use client';

import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { THAI_BANKS } from '@/lib/thai-banks';
import { cn } from '@/lib/utils';

/**
 * ดรอปดาวน์เลือกธนาคารพร้อมโลโก้ — value คือชื่อธนาคารภาษาไทย
 * ค่าเดิมที่พิมพ์เองและไม่อยู่ในรายการ ยังแสดงเป็นตัวเลือก ไม่ให้ข้อมูลเก่าหายตอนเปิดฟอร์ม
 */
export function BankSelect({
    id,
    value,
    onChange,
    placeholder = 'เลือกธนาคาร',
    triggerClassName,
    disabled,
}: {
    id?: string;
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    triggerClassName?: string;
    disabled?: boolean;
}) {
    const legacy = value && !THAI_BANKS.some(b => b.name === value) ? value : null;
    return (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger id={id} className={cn('h-12', triggerClassName)}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-[350px]">
                {legacy && (
                    <SelectItem value={legacy} className="py-2">
                        <span className="font-medium">{legacy}</span>
                    </SelectItem>
                )}
                {THAI_BANKS.map(bank => (
                    <SelectItem key={bank.name} value={bank.name} className="py-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 relative rounded-lg overflow-hidden border bg-white shrink-0">
                                <Image src={bank.logo} alt="" fill sizes="32px" className="object-contain p-0.5" />
                            </div>
                            <span className="font-medium text-slate-700">{bank.name}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
