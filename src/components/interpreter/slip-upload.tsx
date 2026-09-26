'use client';

/**
 * แนบสลิปการโอน — สแกน QR ในสลิปแล้วส่งให้ /api/verify-slip (SlipOK) ตรวจ
 * ได้ verificationId กลับมา ซึ่ง server ใช้ตัดสินเองว่าจ่ายแล้วหรือไม่ (ดู lib/slip-verification.ts)
 * ยอดที่แสดงตรงนี้เป็นแค่ UX — ห้ามใช้ตัดสินเรื่องเงินฝั่ง client
 *
 * ดัดแปลงจากหน้า /payment (ไม่ import จากหน้านั้น เพราะกำลังจะถูกรื้อใน branch remove-money)
 */

import { useState } from 'react';
import jsQR from 'jsqr';
import { CheckCircle2, Loader2, Upload, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type SlipState = {
    file: File | null;
    verificationId: string | null;
    status: 'none' | 'checking' | 'verified' | 'mismatch' | 'manual';
};

const MAX_MB = 10;

function scanSlipQR(file: File): Promise<string | null> {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) return resolve(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);
                const data = ctx.getImageData(0, 0, image.width, image.height);
                const code = jsQR(data.data, data.width, data.height);
                resolve(code ? code.data : null);
            };
            image.onerror = () => resolve(null);
            image.src = e.target?.result as string;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

export function SlipUpload({ expectedBaht, value, onChange }: {
    expectedBaht: number;
    value: SlipState;
    onChange: (s: SlipState) => void;
}) {
    const t = useTranslations('Interpreters.book');
    const [preview, setPreview] = useState<string | null>(null);
    const [slipAmount, setSlipAmount] = useState<number | null>(null);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        if (file.size > MAX_MB * 1024 * 1024) return;
        setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
        setSlipAmount(null);
        onChange({ file, verificationId: null, status: 'checking' });

        const qr = await scanSlipQR(file);
        if (!qr) return onChange({ file, verificationId: null, status: 'manual' });
        try {
            const res = await fetch('/api/verify-slip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: qr }),
            });
            const result = await res.json();
            if (!result.success) return onChange({ file, verificationId: null, status: 'manual' });
            const amount = Number(result.data?.amount);
            setSlipAmount(amount);
            onChange({
                file,
                verificationId: result.verificationId ?? null,
                status: Math.abs(amount - expectedBaht) > 0.01 ? 'mismatch' : 'verified',
            });
        } catch {
            onChange({ file, verificationId: null, status: 'manual' });
        }
    };

    return (
        <div className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-6 cursor-pointer hover:bg-slate-50 text-center">
                {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="slip" className="max-h-56 rounded-lg object-contain" />
                ) : (
                    <Upload className="w-8 h-8 text-slate-400" />
                )}
                <span className="text-sm font-medium">{value.file ? value.file.name : t('uploadSlip')}</span>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onChange={e => handleFile(e.target.files?.[0])}
                />
            </label>
            {value.status === 'checking' && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /></p>
            )}
            {value.status === 'verified' && (
                <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> {t('slipVerified')}</p>
            )}
            {value.status === 'mismatch' && (
                <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="w-4 h-4" /> {t('slipAmountMismatch', { slip: slipAmount ?? 0 })}</p>
            )}
            {value.status === 'manual' && (
                <p className="flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="w-4 h-4" /> {t('slipManual')}</p>
            )}
        </div>
    );
}
